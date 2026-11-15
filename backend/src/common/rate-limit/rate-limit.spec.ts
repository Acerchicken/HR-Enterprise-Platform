import { AppConfig } from '../../config/config';
import { limitMessage, limitsOf, retryAfterSeconds, windowStart } from './rate-limit-rules';
import { RateLimitService, TooManyRequestsException } from './rate-limit.service';

const cfg = (overrides = {}, enabled = true) => ({ rateLimit: { enabled, overrides } }) as unknown as AppConfig;
const db = (counts: Map<string, number>) =>
  ({
    query: async (sql: string, params: unknown[]) => {
      if (!sql.startsWith('INSERT')) return [];
      const key = `${params[0]}@${(params[1] as Date).toISOString()}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return [{ count: counts.get(key) }];
    },
  }) as never;

describe('giới hạn tần suất (NFR-5.21, AC-1.14.x)', () => {
  const t0 = Date.UTC(2026, 10, 15, 8, 0, 10);

  it('ngưỡng mặc định theo spec và có thể ghi đè qua RATE_LIMIT_OVERRIDES', () => {
    expect(limitsOf('profile-write')).toEqual({ minute: 30, day: 300 });
    expect(limitsOf('global', { global: { minute: 1000 } })).toEqual({ minute: 1000 });
  });

  it('Retry-After là số giây tới đầu cửa sổ kế tiếp; câu báo nêu đúng giới hạn (AC-1.14.7)', () => {
    expect(windowStart(t0, 'minute')).toBe(t0 - 10_000);
    expect(retryAfterSeconds(t0, 'minute')).toBe(50);
    expect(limitMessage('profile-write', 'minute', 30, 50)).toBe(
      'Bạn thao tác quá nhanh: tối đa 30 lệnh ghi hồ sơ mỗi phút. Thử lại sau 50 giây.',
    );
  });

  it('lệnh ghi thứ 31 trong một phút bị 429; phút sau lại được (AC-1.14.1)', async () => {
    const s = new RateLimitService(cfg(), db(new Map()));
    for (let i = 0; i < 30; i++) await s.consume('u1', 'profile-write', t0);
    await expect(s.consume('u1', 'profile-write', t0)).rejects.toBeInstanceOf(TooManyRequestsException);
    await expect(s.consume('u2', 'profile-write', t0)).resolves.toBeUndefined();
    await expect(s.consume('u1', 'profile-write', t0 + 60_000)).resolves.toBeUndefined();
  });

  it('giới hạn ngày đếm qua database (nhiều instance dùng chung)', async () => {
    const counts = new Map<string, number>();
    const a = new RateLimitService(cfg({ 'profile-write': { minute: 1000, day: 3 } }), db(counts));
    const b = new RateLimitService(cfg({ 'profile-write': { minute: 1000, day: 3 } }), db(counts));
    await a.consume('u1', 'profile-write', t0);
    await b.consume('u1', 'profile-write', t0);
    await a.consume('u1', 'profile-write', t0);
    await expect(b.consume('u1', 'profile-write', t0)).rejects.toMatchObject({ retryAfter: expect.any(Number) });
  });

  it('RATE_LIMIT_ENABLED=false thì không chặn', async () => {
    const s = new RateLimitService(cfg({}, false), db(new Map()));
    for (let i = 0; i < 200; i++) await s.consume('u1', 'global', t0);
  });
});
