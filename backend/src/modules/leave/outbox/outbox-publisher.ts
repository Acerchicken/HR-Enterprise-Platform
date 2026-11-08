import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown, Optional } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { APP_CONFIG, AppConfig } from '../../../config/config';
import { EVENT_BUS, EventBus } from '../../../messaging/event-bus';
import { createEventBus } from '../../../messaging/factory';
import { OutboxEvent } from './outbox.entity';

const POLL_MS = 1000;
const BATCH = 50;

/**
 * Đọc leave.outbox và đẩy event chưa gửi qua EventBus (RabbitMQ khi local, SQS trên AWS, chọn bằng QUEUE_DRIVER).
 * Chỉ đánh dấu published_at sau khi broker xác nhận đã nhận, nên event không mất khi queue chết;
 * đổi lại có thể gửi trùng, worker tự loại bản trùng theo id dòng outbox.
 * Nhiều instance API chạy song song an toàn nhờ FOR UPDATE SKIP LOCKED.
 */
@Injectable()
export class OutboxPublisher implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxPublisher.name);
  private readonly bus: EventBus | null;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private stopped = false;

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @InjectDataSource() private readonly ds: DataSource,
    @Optional() @Inject(EVENT_BUS) bus?: EventBus,
  ) {
    this.bus = bus ?? createEventBus(cfg);
  }

  onApplicationBootstrap() {
    if (!this.bus) {
      this.logger.warn('Chưa cấu hình queue (QUEUE_DRIVER): không đẩy event outbox (event vẫn được ghi vào leave.outbox)');
      return;
    }
    this.logger.log(`Đẩy event outbox qua ${this.cfg.queue.driver}`);
    this.timer = setInterval(() => void this.tick(), POLL_MS);
  }

  async onApplicationShutdown() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await this.bus?.close().catch(() => undefined);
  }

  /** Một lượt: lấy tối đa BATCH event chưa gửi, gửi lần lượt theo thứ tự id. */
  async tick(): Promise<number> {
    if (this.running || this.stopped || !this.bus) return 0;
    const bus = this.bus;
    this.running = true;
    try {
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
            await bus.publish({ id: row.id, type: row.eventType, payload: row.payload, createdAt: row.createdAt });
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
      return 0;
    } finally {
      this.running = false;
    }
  }
}
