import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import * as amqp from 'amqplib';
import { DataSource } from 'typeorm';
import { APP_CONFIG, AppConfig } from '../../../config/config';
import { EVENTS_EXCHANGE, routingKey } from './leave-events';
import { OutboxEvent } from './outbox.entity';

const POLL_MS = 1000;
const BATCH = 50;

/**
 * Đọc leave.outbox và đẩy event chưa gửi lên RabbitMQ (exchange `hr.events`, routing key `leave.<event>`).
 * Chỉ đánh dấu published_at sau khi broker xác nhận (publisher confirm), nên event không mất khi RabbitMQ chết;
 * đổi lại có thể gửi trùng, worker tự loại bản trùng theo messageId (= id dòng outbox).
 * Nhiều instance API chạy song song an toàn nhờ FOR UPDATE SKIP LOCKED.
 */
@Injectable()
export class OutboxPublisher implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxPublisher.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.ConfirmChannel | null = null;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private stopped = false;

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @InjectDataSource() private readonly ds: DataSource,
  ) {}

  onApplicationBootstrap() {
    if (!this.cfg.rabbitmqUrl) {
      this.logger.warn('RABBITMQ_URL trống: không đẩy event outbox (event vẫn được ghi vào leave.outbox)');
      return;
    }
    this.timer = setInterval(() => void this.tick(), POLL_MS);
  }

  async onApplicationShutdown() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await this.connection?.close().catch(() => undefined);
  }

  /** Một lượt: lấy tối đa BATCH event chưa gửi, gửi lần lượt theo thứ tự id. */
  async tick(): Promise<number> {
    if (this.running || this.stopped) return 0;
    this.running = true;
    try {
      const channel = await this.ensureChannel();
      let failure: unknown = null;
      const sent = await this.ds.transaction(async (m) => {
        const rows: OutboxEvent[] = await m
          .getRepository(OutboxEvent)
          .createQueryBuilder('o')
          .where('o.published_at IS NULL')
          .orderBy('o.id', 'ASC')
          .limit(BATCH)
          .setLock('pessimistic_write')
          .setOnLocked('skip_locked')
          .getMany();
        let count = 0;
        for (const row of rows) {
          try {
            channel.publish(EVENTS_EXCHANGE, routingKey(row.eventType), Buffer.from(JSON.stringify(row.payload)), {
              messageId: row.id,
              type: row.eventType,
              persistent: true,
              contentType: 'application/json',
              timestamp: Math.floor(row.createdAt.getTime() / 1000),
            });
            await channel.waitForConfirms();
            await m.update(OutboxEvent, { id: row.id }, { publishedAt: new Date(), attempts: row.attempts + 1, lastError: null });
            count++;
          } catch (e) {
            // Dừng lượt này để giữ thứ tự; các event đã gửi vẫn được commit, lượt sau thử lại từ event lỗi.
            await m.update(OutboxEvent, { id: row.id }, { attempts: row.attempts + 1, lastError: String(e).slice(0, 500) });
            failure = e;
            break;
          }
        }
        return count;
      });
      if (failure) throw failure;
      return sent;
    } catch (e) {
      this.logger.warn(`Chưa đẩy được outbox: ${e instanceof Error ? e.message : e}`);
      await this.resetConnection();
      return 0;
    } finally {
      this.running = false;
    }
  }

  private async ensureChannel(): Promise<amqp.ConfirmChannel> {
    if (this.channel) return this.channel;
    const connection = await amqp.connect(this.cfg.rabbitmqUrl!);
    connection.on('error', () => undefined);
    connection.on('close', () => {
      this.connection = null;
      this.channel = null;
    });
    const channel = await connection.createConfirmChannel();
    await channel.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });
    this.connection = connection;
    this.channel = channel;
    return channel;
  }

  private async resetConnection() {
    const c = this.connection;
    this.connection = null;
    this.channel = null;
    await c?.close().catch(() => undefined);
  }
}
