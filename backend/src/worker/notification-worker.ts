import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as amqp from 'amqplib';
import { createTransport, Transporter } from 'nodemailer';
import { DataSource } from 'typeorm';
import { APP_CONFIG, AppConfig } from '../config/config';
import { EmployeeService } from '../modules/employee/employee.service';
import {
  buildEmail,
  EVENTS_EXCHANGE,
  LeaveEventPayload,
  LeaveEventType,
  recipientOf,
} from '../modules/leave/outbox/leave-events';

export const QUEUE = 'notification.leave';
export const DEAD_LETTER_QUEUE = 'notification.leave.dlq';

/**
 * Worker nhận event nghỉ phép từ RabbitMQ và gửi email (local: Mailpit).
 * Chống trùng: messageId (= id dòng outbox) được ghi vào notification.processed_event sau khi gửi;
 * gặp lại messageId đã xử lý thì chỉ ack. Lỗi gửi → đưa vào hàng đợi chết (DLQ) để xem lại, không lặp vô hạn.
 */
@Injectable()
export class NotificationWorker implements OnApplicationShutdown {
  private readonly logger = new Logger(NotificationWorker.name);
  private connection: amqp.ChannelModel | null = null;
  private readonly mailer: Transporter;

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly employees: EmployeeService,
  ) {
    this.mailer = createTransport({ host: cfg.smtp.host, port: cfg.smtp.port, secure: false });
  }

  async start() {
    if (!this.cfg.rabbitmqUrl) throw new Error('Worker cần RABBITMQ_URL');
    this.connection = await amqp.connect(this.cfg.rabbitmqUrl);
    const ch = await this.connection.createChannel();
    await ch.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });
    await ch.assertQueue(DEAD_LETTER_QUEUE, { durable: true });
    await ch.assertQueue(QUEUE, { durable: true, deadLetterExchange: '', deadLetterRoutingKey: DEAD_LETTER_QUEUE });
    await ch.bindQueue(QUEUE, EVENTS_EXCHANGE, 'leave.*');
    await ch.prefetch(10);
    await ch.consume(QUEUE, (msg) => {
      if (!msg) return;
      this.handle(msg.properties.messageId, msg.properties.type, JSON.parse(msg.content.toString()))
        .then(() => ch.ack(msg))
        .catch((e) => {
          this.logger.error(`Event ${msg.properties.messageId} lỗi, chuyển DLQ: ${e instanceof Error ? e.message : e}`);
          ch.nack(msg, false, false);
        });
    });
    this.logger.log(`Đang nghe hàng đợi ${QUEUE}`);
  }

  /** Trả về true nếu đã gửi email, false nếu bỏ qua vì trùng. */
  async handle(eventId: string, type: LeaveEventType, payload: LeaveEventPayload): Promise<boolean> {
    const seen = await this.ds.query('SELECT 1 FROM notification.processed_event WHERE event_id = $1', [eventId]);
    if (seen.length) {
      this.logger.log(`Bỏ qua event trùng ${eventId}`);
      return false;
    }

    const recipientId =
      recipientOf(type) === 'MANAGER' ? await this.employees.managerIdOf(payload.employeeId) : payload.employeeId;
    if (recipientId) {
      const [recipient, names] = await Promise.all([
        this.employees.contactOf(recipientId),
        this.employees.namesOf([payload.employeeId]),
      ]);
      if (recipient) {
        const mail = buildEmail(type, payload, names.get(payload.employeeId) ?? payload.employeeId);
        await this.mailer.sendMail({ from: this.cfg.smtp.from, to: recipient.email, ...mail });
        this.logger.log(`${type} ${payload.requestId} → ${recipient.email}`);
      }
    } else {
      this.logger.warn(`${type} ${payload.requestId}: nhân viên chưa có quản lý trực tiếp, không gửi email`);
    }

    await this.ds.query(
      'INSERT INTO notification.processed_event (event_id, event_type) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [eventId, type],
    );
    return true;
  }

  async onApplicationShutdown() {
    await this.connection?.close().catch(() => undefined);
  }
}
