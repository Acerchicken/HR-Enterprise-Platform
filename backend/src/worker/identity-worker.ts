import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { APP_CONFIG, AppConfig } from '../config/config';
import { EventConsumer } from '../messaging/event-bus';
import { createEventConsumer } from '../messaging/factory';
import { IdentityEventType, isIdentityEvent } from '../modules/identity/identity-events';
import { IdentitySync } from './identity-sync';

/**
 * Worker của backend nhận event tài khoản, vai trò (queue `identity.sync` khi local, `SQS_IDENTITY_QUEUE_URL` trên AWS) và
 * đồng bộ sang IdP (UC8, `identity-sync`). Email không còn gửi ở đây: từ ADR-15 bước 1, `services/notification` làm.
 * Chống trùng: id event (= id dòng outbox) ghi vào notification.processed_event sau khi xử lý; lỗi thì ném ra để vào DLQ.
 */
@Injectable()
export class IdentityWorker implements OnApplicationShutdown {
  private readonly logger = new Logger(IdentityWorker.name);
  private consumer: EventConsumer | null = null;

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @InjectDataSource() private readonly ds: DataSource,
    private readonly identity: IdentitySync,
  ) {}

  async start(consumer: EventConsumer = createEventConsumer(this.cfg)) {
    this.consumer = consumer;
    await consumer.start((e) => this.handle(e.id, e.type, e.payload).then(() => undefined));
  }

  /** Trả về true nếu đã xử lý, false nếu bỏ qua (trùng hoặc không phải event tài khoản). */
  async handle(eventId: string, type: string, payload: unknown): Promise<boolean> {
    if (!isIdentityEvent(type)) {
      this.logger.warn(`Bỏ qua event ${type}: không phải event tài khoản`);
      return false;
    }
    const seen = await this.ds.query('SELECT 1 FROM notification.processed_event WHERE event_id = $1', [eventId]);
    if (seen.length) {
      this.logger.log(`Bỏ qua event trùng ${eventId}`);
      return false;
    }
    await this.identity.handle(type as IdentityEventType, payload as never);
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
