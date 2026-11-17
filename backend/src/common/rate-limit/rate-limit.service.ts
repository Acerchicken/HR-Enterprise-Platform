import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { APP_CONFIG, AppConfig } from '../../config/config';
import { limitMessage, limitsOf, RateGroup, RateWindow, retryAfterSeconds, windowStart } from './rate-limit-rules';

/** Lỗi 429 mang số giây chờ để filter gắn header `Retry-After`. */
export class TooManyRequestsException extends HttpException {
  constructor(message: string, readonly retryAfter: number) {
    super({ message, retryAfter }, HttpStatus.TOO_MANY_REQUESTS);
  }
}

const ABUSE_WINDOW_MS = 10 * 60_000;
const ABUSE_THRESHOLD = 20;

/**
 * Đếm theo cửa sổ cố định. Cửa sổ phút, giờ đếm trong bộ nhớ của instance (đủ chặn spam, ADR-07 không dùng Redis); cửa sổ
 * ngày đếm trong PostgreSQL để đúng khi App Runner chạy nhiều instance (UC1 spec 13.4).
 * Vượt ngưỡng: 429, không chạy handler (không đổi dữ liệu, không audit nghiệp vụ), có log để làm metric và cảnh báo.
 */
@Injectable()
export class RateLimitService {
  private readonly logger = new Logger('RateLimit');
  private readonly memory = new Map<string, { start: number; count: number }>();
  private readonly rejected = new Map<string, number[]>();
  private lastSweep = 0;

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    private readonly db: DataSource,
  ) {}

  /** Tính một lượt cho `userId` ở nhóm `group`; vượt ngưỡng thì ném 429. */
  async consume(userId: string, group: RateGroup, now = Date.now()): Promise<void> {
    if (!this.cfg.rateLimit.enabled) return;
    const limits = limitsOf(group, this.cfg.rateLimit.overrides);
    for (const window of ['minute', 'hour', 'day'] as RateWindow[]) {
      const limit = limits[window];
      if (!limit) continue;
      const key = `${userId}:${group}:${window}`;
      const count = window === 'day' ? await this.countInDb(key, now) : this.countInMemory(key, window, now);
      if (count > limit) this.reject(userId, group, window, limit, now);
    }
  }

  private countInMemory(key: string, window: RateWindow, now: number): number {
    const start = windowStart(now, window);
    const cur = this.memory.get(key);
    const next = cur && cur.start === start ? { start, count: cur.count + 1 } : { start, count: 1 };
    this.memory.set(key, next);
    if (now - this.lastSweep > 60_000) this.sweep(now);
    return next.count;
  }

  private async countInDb(key: string, now: number): Promise<number> {
    const start = new Date(windowStart(now, 'day'));
    const [row] = await this.db.query(
      `INSERT INTO iam.rate_limit_counter (key, window_start, count) VALUES ($1, $2, 1)
       ON CONFLICT (key, window_start) DO UPDATE SET count = iam.rate_limit_counter.count + 1
       RETURNING count`,
      [key, start],
    );
    // Dọn cửa sổ cũ thỉnh thoảng, không cần job riêng.
    if (Math.random() < 0.01) {
      await this.db.query(`DELETE FROM iam.rate_limit_counter WHERE window_start < now() - interval '2 days'`);
    }
    return Number(row.count);
  }

  private reject(userId: string, group: RateGroup, window: RateWindow, limit: number, now: number): never {
    const retryAfter = retryAfterSeconds(now, window);
    // Log có cấu trúc để CloudWatch tạo metric filter (AC-1.14.4, AC-1.14.5). Không ghi dữ liệu nghiệp vụ.
    this.logger.warn(JSON.stringify({ event: 'rate_limited', userId, group, window, limit }));
    if (group === 'sensitive-view') {
      this.logger.warn(JSON.stringify({ event: 'sensitive_scrape_suspected', userId }));
    }
    const recent = (this.rejected.get(userId) ?? []).filter((t) => now - t < ABUSE_WINDOW_MS);
    recent.push(now);
    this.rejected.set(userId, recent);
    if (recent.length === ABUSE_THRESHOLD + 1) {
      this.logger.warn(JSON.stringify({ event: 'rate_limit_abuse', userId, rejectedIn10Min: recent.length }));
    }
    throw new TooManyRequestsException(limitMessage(group, window, limit, retryAfter), retryAfter);
  }

  private sweep(now: number) {
    this.lastSweep = now;
    for (const [key, v] of this.memory) {
      if (now - v.start > 3_600_000 * 2) this.memory.delete(key);
    }
    for (const [user, times] of this.rejected) {
      if (!times.some((t) => now - t < ABUSE_WINDOW_MS)) this.rejected.delete(user);
    }
  }
}
