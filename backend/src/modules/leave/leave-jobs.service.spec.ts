import { LeaveJobsService } from './leave-jobs.service';

/** Job tính số dư hằng ngày: chỉ đánh dấu ngày sau khi chạy xong, không chạy song song (review #120). */
function setup(opts: { locked?: boolean; marked?: boolean; failOn?: string } = {}) {
  const calls: string[] = [];
  const qr = {
    connect: jest.fn(),
    release: jest.fn(),
    query: jest.fn(async (sql: string) => {
      calls.push(sql.trim().split(/\s+/).slice(0, 3).join(' '));
      if (sql.includes('pg_try_advisory_lock')) return [{ ok: !opts.locked }];
      if (sql.startsWith('SELECT 1 FROM notification.processed_event')) return opts.marked ? [{}] : [];
      if (sql.includes('FROM employee.employee')) return [{ id: 'a' }, { id: 'b' }];
      return [];
    }),
  };
  const ds = {
    createQueryRunner: () => qr,
    transaction: jest.fn(async (fn: (m: unknown) => Promise<void>) => {
      calls.push('transaction');
      await fn({ query: jest.fn() });
    }),
  };
  const balances = {
    ensureYear: jest.fn(),
    recalcAnnual: jest.fn(async (_m: unknown, id: string) => {
      if (id === opts.failOn) throw new Error('lỗi');
    }),
  };
  const jobs = new LeaveJobsService(ds as any, {} as any, balances as any, {} as any);
  return { jobs, calls, qr };
}

describe('LeaveJobsService.dailyBalances', () => {
  it('đánh dấu ngày sau khi tính xong mọi người, rồi nhả khóa', async () => {
    const { jobs, calls, qr } = setup();
    await expect(jobs.dailyBalances(new Date('2026-11-21T01:00:00Z'))).resolves.toBe(2);
    const insert = calls.findIndex((c) => c.startsWith('INSERT INTO notification.processed_event'));
    expect(insert).toBeGreaterThan(calls.lastIndexOf('transaction'));
    expect(calls.at(-1)).toContain('pg_advisory_unlock');
    expect(qr.release).toHaveBeenCalled();
  });

  it('ngày đã chạy xong thì bỏ qua; worker khác đang chạy thì bỏ qua', async () => {
    expect(await setup({ marked: true }).jobs.dailyBalances()).toBeNull();
    const busy = setup({ locked: true });
    expect(await busy.jobs.dailyBalances()).toBeNull();
    expect(busy.calls).not.toContain('transaction');
  });

  it('lỗi một người không dừng cả vòng', async () => {
    await expect(setup({ failOn: 'a' }).jobs.dailyBalances()).resolves.toBe(1);
  });
});
