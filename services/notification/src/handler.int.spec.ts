/**
 * Chống trùng và gộp email cho HR với PostgreSQL thật (bảng `notification.processed_event`). Chỉ chạy khi có TEST_DB_URL
 * (database đã chạy migration của backend).
 */
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { NotificationHandler } from './handler';

const url = process.env.TEST_DB_URL;
const d = url ? describe : describe.skip;

d('NotificationHandler với PostgreSQL', () => {
  let pool: Pool;
  beforeAll(() => {
    pool = new Pool({ connectionString: url });
  });
  beforeEach(async () => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    await pool.query(`DELETE FROM notification.processed_event WHERE event_type = 'ProfileHrDigest'`);
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(() => pool.end());

  it('ghi dấu event và từng nhóm; giao lại thì bỏ qua', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    const h = new NotificationHandler(pool, { send }, 60);
    const id = randomUUID();
    const e = { id, type: 'LeaveApproved', payload: { mail: [{ group: 'OWNER', to: ['o@x.vn'] }] } };
    expect(await h.handle(e)).toBe('sent');
    expect(await h.handle(e)).toBe('duplicate');
    const { rows } = await pool.query(`SELECT event_id FROM notification.processed_event WHERE event_id LIKE $1 ORDER BY 1`, [`${id}%`]);
    expect(rows.map((r) => r.event_id)).toEqual([id, `${id}#OWNER`]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('10 yêu cầu hồ sơ đến cùng lúc: HR chỉ nhận một email (AC-1.9.13)', async () => {
    const send = jest.fn().mockResolvedValue(undefined);
    const h = new NotificationHandler(pool, { send }, 60);
    await Promise.all(
      Array.from({ length: 10 }, () =>
        h.handle({ id: randomUUID(), type: 'ProfileChangeSubmitted', payload: { mail: [{ group: 'HR', to: ['hr@x.vn'] }] } }),
      ),
    );
    expect(send).toHaveBeenCalledTimes(1);
  });
});
