import { transition, TransitionInput } from './leave-state-machine';

const req = (over: Partial<TransitionInput> = {}): TransitionInput => ({
  status: 'SUBMITTED',
  requiresHrApproval: false,
  hasCancelRequest: false,
  started: false,
  ended: false,
  ...over,
});

describe('leave state machine', () => {
  it('duyệt: SUBMITTED → APPROVED; loại cần HR → PENDING_HR (BR-16)', () => {
    expect(transition(req(), 'approve')).toMatchObject({ kind: 'changed', to: 'APPROVED', history: 'APPROVE', balance: 'none' });
    expect(transition(req({ requiresHrApproval: true }), 'approve')).toMatchObject({ kind: 'changed', to: 'PENDING_HR', history: 'MANAGER_APPROVE' });
  });

  it('BR-11: duyệt lặp không đổi gì; quyết định ngược lại bị chặn', () => {
    expect(transition(req({ status: 'APPROVED' }), 'approve')).toEqual({ kind: 'unchanged' });
    expect(transition(req({ status: 'PENDING_HR' }), 'approve')).toEqual({ kind: 'unchanged' });
    expect(transition(req({ status: 'APPROVED' }), 'reject').kind).toBe('conflict');
  });

  it('BR-09: từ chối trả số ngày; HR từ chối đơn PENDING_HR', () => {
    expect(transition(req(), 'reject')).toMatchObject({ to: 'REJECTED', balance: 'release' });
    expect(transition(req({ status: 'PENDING_HR' }), 'hrReject')).toMatchObject({ to: 'REJECTED', history: 'HR_REJECT', balance: 'release' });
    expect(transition(req({ status: 'PENDING_HR' }), 'hrApprove')).toMatchObject({ to: 'APPROVED', history: 'HR_APPROVE' });
    expect(transition(req(), 'hrApprove').kind).toBe('conflict');
  });

  it('BR-07: tự hủy đơn chờ trước ngày bắt đầu; từ ngày bắt đầu thì 409', () => {
    expect(transition(req(), 'cancel')).toMatchObject({ to: 'CANCELLED', balance: 'release' });
    expect(transition(req({ status: 'PENDING_HR' }), 'cancel')).toMatchObject({ to: 'CANCELLED' });
    expect(transition(req({ started: true }), 'cancel').kind).toBe('conflict');
    expect(transition(req({ status: 'APPROVED' }), 'cancel').kind).toBe('conflict');
    expect(transition(req({ status: 'CANCELLED' }), 'cancel')).toEqual({ kind: 'unchanged' });
  });

  it('BR-08: đề nghị hủy, xác nhận, bác; hết hạn từ ngày bắt đầu', () => {
    const approved = req({ status: 'APPROVED' });
    expect(transition(approved, 'cancelRequest')).toMatchObject({ to: 'APPROVED', history: 'CANCEL_REQUEST' });
    expect(transition({ ...approved, hasCancelRequest: true }, 'cancelRequest').kind).toBe('conflict');
    expect(transition({ ...approved, started: true }, 'cancelRequest').kind).toBe('conflict');
    expect(transition({ ...approved, hasCancelRequest: true }, 'cancelRequestApprove')).toMatchObject({ to: 'CANCELLED', balance: 'release' });
    expect(transition({ ...approved, hasCancelRequest: true }, 'cancelRequestReject')).toMatchObject({ to: 'APPROVED', history: 'CANCEL_REQUEST_REJECT' });
    expect(transition(approved, 'cancelRequestApprove').kind).toBe('conflict');
    expect(transition({ ...approved, hasCancelRequest: true, started: true }, 'cancelRequestApprove').kind).toBe('conflict');
  });

  it('BR-10: hoàn tất chỉ đơn APPROVED và sau ngày kết thúc', () => {
    expect(transition(req({ status: 'APPROVED', ended: true }), 'complete')).toMatchObject({ to: 'COMPLETED', balance: 'consume' });
    expect(transition(req({ status: 'APPROVED' }), 'complete').kind).toBe('conflict');
    expect(transition(req({ status: 'PENDING_HR', ended: true }), 'complete').kind).toBe('conflict');
    expect(transition(req({ ended: true }), 'complete').kind).toBe('conflict');
  });

  it('AC-3.1.7: hệ thống hủy đơn còn hiệu lực khi nghỉ việc', () => {
    for (const status of ['SUBMITTED', 'PENDING_HR', 'APPROVED'] as const) {
      expect(transition(req({ status }), 'systemCancel')).toMatchObject({ to: 'CANCELLED', history: 'SYSTEM_CANCEL', balance: 'release' });
    }
    expect(transition(req({ status: 'COMPLETED' }), 'systemCancel')).toEqual({ kind: 'unchanged' });
  });
});
