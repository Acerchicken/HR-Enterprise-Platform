import { Db, mailGroupsOf, NotificationHandler } from './handler';
import { MailMessage } from './mail/sender';

/** Bảng `notification.processed_event` giả trong bộ nhớ, đủ cho các câu SQL của handler. */
class FakeDb implements Db {
  rows = new Map<string, { type: string; at: number }>();
  async query(sql: string, params: unknown[] = []) {
    const [a, b] = params as [string, string | number];
    if (sql.startsWith('SELECT 1 FROM notification.processed_event WHERE event_id')) return { rows: this.rows.has(a) ? [{}] : [] };
    if (sql.includes('make_interval')) {
      const since = Date.now() - (b as number) * 60_000;
      return { rows: [...this.rows.values()].filter((r) => r.type === a && r.at > since).map(() => ({})) };
    }
    if (sql.startsWith('INSERT')) {
      if (this.rows.has(a)) return { rows: [] };
      this.rows.set(a, { type: b as string, at: Date.now() });
      return { rows: [{ event_id: a }] };
    }
    if (sql.startsWith('DELETE')) {
      this.rows.delete(a);
      return { rows: [] };
    }
    throw new Error(`SQL lạ: ${sql}`);
  }
}

const setup = () => {
  const db = new FakeDb();
  const sent: MailMessage[] = [];
  const mailer = { send: jest.fn(async (m: MailMessage) => void sent.push(m)) };
  return { db, sent, mailer, handler: new NotificationHandler(db, mailer, 60) };
};

describe('NotificationHandler (ADR-15 bước 1)', () => {
  beforeEach(() => jest.spyOn(process.stdout, 'write').mockImplementation(() => true));
  afterEach(() => jest.restoreAllMocks());

  const leave = (mail: unknown) => ({ id: 'e-1', type: 'LeaveRequested', payload: { requestId: 'r', employeeId: 'emp', mail } });

  it('gửi email chung cho từng nhóm theo danh sách trong event, không tra cứu dữ liệu khác (BR-15)', async () => {
    const { handler, sent, db } = setup();
    const r = await handler.handle(leave([{ group: 'APPROVERS', to: ['m@x.vn', 'd@x.vn'] }, { group: 'OWNER', to: ['o@x.vn'] }]));
    expect(r).toBe('sent');
    expect(sent.map((m) => m.to)).toEqual([['m@x.vn', 'd@x.vn'], ['o@x.vn']]);
    expect(sent[0].subject).toBe('[HRHelper] Có yêu cầu nghỉ phép cần xử lý');
    expect(sent[1].subject).toBe('[HRHelper] Có đơn nghỉ được tạo cho bạn');
    expect(JSON.stringify(sent)).not.toContain('emp');
    expect(db.rows.has('e-1')).toBe(true);
  });

  it('event trùng (queue giao lại) thì không gửi lại', async () => {
    const { handler, mailer } = setup();
    const e = leave([{ group: 'OWNER', to: ['o@x.vn'] }]);
    await handler.handle(e);
    expect(await handler.handle(e)).toBe('duplicate');
    expect(mailer.send).toHaveBeenCalledTimes(1);
  });

  it('nhóm sau lỗi thì ném ra (DLQ); giao lại chỉ gửi nhóm chưa nhận', async () => {
    const { handler, mailer, db } = setup();
    mailer.send.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('SES down'));
    const e = leave([{ group: 'APPROVERS', to: ['m@x.vn'] }, { group: 'OWNER', to: ['o@x.vn'] }]);
    await expect(handler.handle(e)).rejects.toThrow('SES down');
    expect(db.rows.has('e-1')).toBe(false);
    await handler.handle(e);
    expect(mailer.send).toHaveBeenCalledTimes(3);
    expect(mailer.send.mock.calls[2][0].to).toEqual(['o@x.vn']);
  });

  it('HR nhận tối đa một email báo yêu cầu cập nhật hồ sơ trong 60 phút (AC-1.9.13)', async () => {
    const { handler, sent } = setup();
    const ev = (id: string) => ({ id, type: 'ProfileChangeSubmitted', payload: { requestId: id, employeeId: 'emp', mail: [{ group: 'HR', to: ['hr@x.vn'] }] } });
    await handler.handle(ev('p-1'));
    await handler.handle(ev('p-2'));
    expect(sent).toHaveLength(1);
    expect(sent[0].subject).toBe('Có yêu cầu cập nhật hồ sơ cần xử lý');
  });

  it('gửi email gộp cho HR lỗi thì bỏ giữ chỗ để lần giao lại gửi được', async () => {
    const { handler, mailer, db } = setup();
    mailer.send.mockRejectedValueOnce(new Error('SMTP down'));
    const e = { id: 'p-1', type: 'ProfileChangeSubmitted', payload: { mail: [{ group: 'HR', to: ['hr@x.vn'] }] } };
    await expect(handler.handle(e)).rejects.toThrow('SMTP down');
    expect([...db.rows.values()].some((r) => r.type === 'ProfileHrDigest')).toBe(false);
    await handler.handle(e);
    expect(mailer.send).toHaveBeenCalledTimes(2);
  });

  it('hồ sơ đã duyệt, đổi tài khoản ngân hàng: gửi chủ hồ sơ, không có số tài khoản (NFR-5.18)', async () => {
    const { handler, sent } = setup();
    await handler.handle({ id: 'b-1', type: 'BankAccountChanged', payload: { employeeId: 'emp', mail: [{ group: 'OWNER', to: ['o@x.vn'] }] } });
    expect(sent[0].to).toEqual(['o@x.vn']);
    expect(sent[0].text).not.toMatch(/\d{6,}/);
  });

  it('event không thuộc service (ví dụ event tài khoản còn trong queue cũ) thì ném lỗi để vào DLQ, không bỏ mất', async () => {
    const { handler, mailer, db } = setup();
    await expect(handler.handle({ id: 'i-1', type: 'RoleGranted', payload: {} })).rejects.toThrow(/RoleGranted/);
    expect(mailer.send).not.toHaveBeenCalled();
    expect(db.rows.size).toBe(0);
  });

  it('event thiếu danh sách người nhận (API bản cũ) thì ném lỗi để vào DLQ', async () => {
    const { handler } = setup();
    await expect(handler.handle({ id: 'e-9', type: 'LeaveApproved', payload: { requestId: 'r' } })).rejects.toThrow(/payload.mail/);
  });
});

describe('mailGroupsOf', () => {
  it('bỏ nhóm rỗng, bỏ địa chỉ lặp; nhóm lạ hoặc địa chỉ sai thì lỗi', () => {
    expect(mailGroupsOf({ mail: [{ group: 'HR', to: [] }, { group: 'OWNER', to: ['a@x.vn', 'a@x.vn'] }] })).toEqual([{ group: 'OWNER', to: ['a@x.vn'] }]);
    expect(() => mailGroupsOf({ mail: [{ group: 'ALL', to: ['a@x.vn'] }] })).toThrow(/mail\[0\]/);
    expect(() => mailGroupsOf({ mail: [{ group: 'HR', to: ['khong-phai-email'] }] })).toThrow(/mail\[0\]/);
  });
});
