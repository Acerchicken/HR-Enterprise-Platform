import { loadConfig } from '../config/config';
import { LeaveEventPayload } from '../modules/leave/outbox/leave-events';
import { NotificationWorker } from './notification-worker';

const payload: LeaveEventPayload = {
  requestId: 'r-1',
  employeeId: 'emp',
  leaveType: 'ANNUAL',
  startDate: '2026-11-09',
  endDate: '2026-11-09',
  halfDay: null,
  days: 1,
  actorId: 'emp',
  comment: null,
  occurredAt: '2026-11-02T00:00:00.000Z',
};

function setup() {
  const processed = new Set<string>();
  const ds = {
    query: jest.fn(async (sql: string, params: string[]) => {
      if (sql.startsWith('SELECT')) return processed.has(params[0]) ? [{}] : [];
      processed.add(params[0]);
      return [];
    }),
  };
  const employees = {
    managerIdOf: jest.fn(async () => 'mgr'),
    contactOf: jest.fn(async (id: string) => ({ email: `${id}@hr.local`, fullName: id })),
    namesOf: jest.fn(async () => new Map([['emp', 'Trần Thị Nhân']])),
  };
  const worker = new NotificationWorker(loadConfig({}), ds as any, employees as any);
  const sendMail = jest.fn(async () => ({}));
  (worker as any).mailer = { sendMail };
  return { worker, sendMail };
}

describe('NotificationWorker', () => {
  it('đơn mới gửi email cho quản lý trực tiếp', async () => {
    const { worker, sendMail } = setup();
    await expect(worker.handle('1', 'LeaveRequested', payload)).resolves.toBe(true);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'mgr@hr.local' }));
  });

  it('kết quả duyệt gửi email cho nhân viên', async () => {
    const { worker, sendMail } = setup();
    await worker.handle('2', 'LeaveApproved', payload);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'emp@hr.local' }));
  });

  it('nhận lại cùng event (RabbitMQ giao lại) thì không gửi email lần hai', async () => {
    const { worker, sendMail } = setup();
    await worker.handle('3', 'LeaveApproved', payload);
    await expect(worker.handle('3', 'LeaveApproved', payload)).resolves.toBe(false);
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  it('gửi email lỗi thì không đánh dấu đã xử lý, nên đưa lại từ DLQ vẫn gửi được', async () => {
    const { worker, sendMail } = setup();
    sendMail.mockRejectedValueOnce(new Error('SMTP down'));
    await expect(worker.handle('4', 'LeaveApproved', payload)).rejects.toThrow('SMTP down');
    await expect(worker.handle('4', 'LeaveApproved', payload)).resolves.toBe(true);
  });
});
