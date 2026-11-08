import { buildEmail, LeaveEventPayload, recipientOf, routingKey } from './leave-events';

const payload: LeaveEventPayload = {
  requestId: 'r-1',
  employeeId: 'e-1',
  leaveType: 'ANNUAL',
  startDate: '2026-11-09',
  endDate: '2026-11-10',
  halfDay: null,
  days: 2,
  actorId: 'm-1',
  comment: null,
  occurredAt: '2026-11-02T00:00:00.000Z',
};

describe('leave events', () => {
  it('đơn mới và đơn bị hủy báo quản lý; quyết định và hoàn tất báo nhân viên', () => {
    expect(recipientOf('LeaveRequested')).toBe('MANAGER');
    expect(recipientOf('LeaveCancelled')).toBe('MANAGER');
    expect(recipientOf('LeaveApproved')).toBe('EMPLOYEE');
    expect(recipientOf('LeaveRejected')).toBe('EMPLOYEE');
    expect(recipientOf('LeaveCompleted')).toBe('EMPLOYEE');
  });

  it('routing key theo tên event', () => {
    expect(routingKey('LeaveApproved')).toBe('leave.LeaveApproved');
  });

  it('nội dung email có thời gian, số ngày và ghi chú', () => {
    const mail = buildEmail('LeaveRejected', { ...payload, comment: 'Trùng lịch dự án' }, 'Trần Thị Nhân');
    expect(mail.subject).toBe('[HRHelper] Đơn nghỉ phép bị từ chối – Trần Thị Nhân, 09/11/2026 – 10/11/2026');
    expect(mail.text).toContain('Thời gian: 09/11/2026 – 10/11/2026 (2 ngày)');
    expect(mail.text).toContain('Ghi chú: Trùng lịch dự án');
  });

  it('nghỉ nửa ngày ghi rõ buổi', () => {
    const mail = buildEmail('LeaveRequested', { ...payload, endDate: '2026-11-09', halfDay: 'AM', days: 0.5 }, 'A');
    expect(mail.text).toContain('Thời gian: 09/11/2026 (buổi sáng) (0.5 ngày)');
  });
});
