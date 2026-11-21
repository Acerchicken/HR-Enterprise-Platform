import { buildEmail, LEAVE_EVENT_TYPES, LeaveEventPayload, recipientsOf, routingKey } from './leave-events';

const p: LeaveEventPayload = { requestId: '8f2c0000-0000-0000-0000-000000000001', employeeId: 'emp', occurredAt: '2026-11-02T00:00:00.000Z' };

describe('leave events', () => {
  it('routing key theo dạng leave.<Event>', () => {
    expect(routingKey('LeaveApproved')).toBe('leave.LeaveApproved');
  });

  it('người nhận theo loại event (AC-4.6.1, AC-4.6.5, BR-16, BR-17)', () => {
    expect(recipientsOf('LeaveRequested', p)).toEqual(['APPROVERS']);
    expect(recipientsOf('LeaveRequested', { ...p, onBehalf: true })).toEqual(['APPROVERS', 'OWNER']);
    expect(recipientsOf('LeaveApproved', p)).toEqual(['OWNER']);
    expect(recipientsOf('LeaveManagerApproved', p)).toEqual(['OWNER', 'HR']);
    expect(recipientsOf('LeaveCancelled', { ...p, reason: 'OWNER' })).toEqual(['APPROVERS']);
    expect(recipientsOf('LeaveCancelled', { ...p, reason: 'CANCEL_REQUEST_APPROVED', hrInvolved: true })).toEqual(['OWNER', 'APPROVERS', 'HR']);
    expect(recipientsOf('LeaveCancelRequested', { ...p, hrInvolved: true })).toEqual(['HR']);
    expect(recipientsOf('LeaveReminder', { ...p, stage: 'PENDING_HR' })).toEqual(['HR']);
    expect(recipientsOf('LeaveReminder', { ...p, stage: 'SUBMITTED' })).toEqual(['APPROVERS']);
  });

  it('BR-15: email không có mã đơn, ngày, loại phép (AC-4.6.3)', () => {
    for (const type of LEAVE_EVENT_TYPES) {
      for (const to of ['OWNER', 'APPROVERS', 'HR'] as const) {
        const mail = buildEmail(type, to);
        const all = `${mail.subject}\n${mail.text}`;
        expect(all).not.toMatch(/8f2c|\d{2}\/\d{2}|ANNUAL|SICK|ốm/);
        expect(all).not.toMatch(/https?:\/\//);
      }
    }
  });
});
