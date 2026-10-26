import { submitEffect, transition, workingDays } from './leave-state-machine';

describe('leave state machine', () => {
  it('manager trực tiếp duyệt đơn SUBMITTED', () => {
    expect(transition('SUBMITTED', 'approve', 'DIRECT_MANAGER', 2)).toEqual({
      kind: 'changed',
      to: 'APPROVED',
      balanceEffect: { pending: 0, used: 0 },
    });
  });

  it('từ chối và hủy trả lại số ngày pending', () => {
    expect(transition('SUBMITTED', 'reject', 'DIRECT_MANAGER', 3)).toMatchObject({
      to: 'REJECTED',
      balanceEffect: { pending: -3, used: 0 },
    });
    expect(transition('SUBMITTED', 'cancel', 'OWNER', 3)).toMatchObject({
      to: 'CANCELLED',
      balanceEffect: { pending: -3, used: 0 },
    });
  });

  it('HR hoàn tất: chuyển pending sang used', () => {
    expect(transition('APPROVED', 'complete', 'HR', 1.5)).toMatchObject({
      to: 'COMPLETED',
      balanceEffect: { pending: -1.5, used: 1.5 },
    });
  });

  it('duyệt lần hai là idempotent', () => {
    expect(transition('APPROVED', 'approve', 'DIRECT_MANAGER', 2)).toEqual({ kind: 'unchanged', to: 'APPROVED' });
  });

  it('duyệt đơn đã bị từ chối là conflict (409)', () => {
    expect(transition('REJECTED', 'approve', 'DIRECT_MANAGER', 2).kind).toBe('conflict');
  });

  it('không phải manager trực tiếp thì không được duyệt (403)', () => {
    expect(transition('SUBMITTED', 'approve', 'OTHER', 2).kind).toBe('forbidden');
    expect(transition('SUBMITTED', 'approve', 'OWNER', 2).kind).toBe('forbidden');
    expect(transition('SUBMITTED', 'approve', 'HR', 2).kind).toBe('forbidden');
  });

  it('không hủy được đơn đã duyệt', () => {
    expect(transition('APPROVED', 'cancel', 'OWNER', 2).kind).toBe('conflict');
  });

  it('tạo đơn giữ chỗ pending', () => {
    expect(submitEffect(2)).toEqual({ pending: 2, used: 0 });
  });

  it('đếm ngày làm việc, bỏ cuối tuần', () => {
    expect(workingDays('2026-10-23', '2026-10-26')).toBe(2); // T6 → T2
    expect(workingDays('2026-10-24', '2026-10-25')).toBe(0); // T7, CN
    expect(workingDays('2026-10-26', '2026-10-30')).toBe(5);
    expect(workingDays('2026-10-30', '2026-10-26')).toBe(0);
  });
});
