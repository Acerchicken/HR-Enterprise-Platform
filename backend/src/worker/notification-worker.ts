import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { createTransport, Transporter } from 'nodemailer';
import { DataSource } from 'typeorm';
import { APP_CONFIG, AppConfig } from '../config/config';
import { EmployeeService } from '../modules/employee/employee.service';
import { EventConsumer } from '../messaging/event-bus';
import { createEventConsumer } from '../messaging/factory';
import { buildEmail, LeaveEventPayload, LeaveEventType, recipientOf } from '../modules/leave/outbox/leave-events';

/**
 * Worker nhận event nghỉ phép từ queue (RabbitMQ khi local, SQS trên AWS) và gửi email (local: Mailpit).
 * Chống trùng: id event (= id dòng outbox) được ghi vào notification.processed_event sau khi gửi;
 * gặp lại id đã xử lý thì bỏ qua. Lỗi gửi → DLQ để xem lại, không lặp vô hạn
 * (RabbitMQ: nack ngay; SQS: sau maxReceiveCount lần).
 */
@Injectable()
export class NotificationWorker implements OnApplicationShutdown {
  private readonly logger = new Logger(NotificationWorker.name);
  private consumer: EventConsumer | null = null;
  private readonly mailer: Transporter;

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly employees: EmployeeService,
  ) {
    this.mailer = createTransport({ host: cfg.smtp.host, port: cfg.smtp.port, secure: false });
  }

  async start(consumer: EventConsumer = createEventConsumer(this.cfg)) {
    this.consumer = consumer;
    await consumer.start((e) => this.handle(e.id, e.type as LeaveEventType, e.payload as LeaveEventPayload).then(() => undefined));
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
    await this.consumer?.close().catch(() => undefined);
  }
}
