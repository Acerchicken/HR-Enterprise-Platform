/**
 * State machine của đơn nghỉ (UC4 mục 4, UC3 13.5). Hàm thuần: module Leave gọi bên trong transaction rồi áp dụng
 * `balance` lên số dư từng năm, ghi lịch sử, audit và outbox.
 *
 *   (tạo) ─► SUBMITTED ─approve─► APPROVED ─complete─► COMPLETED
 *               │  │   └approve (cần HR)─► PENDING_HR ─hr-approve─► APPROVED
 *               │  └reject─► REJECTED          └hr-reject─► REJECTED
 *               └cancel─► CANCELLED ◄─cancel (PENDING_HR)
 *   APPROVED ─cancel-request/approve─► CANCELLED;  hệ thống hủy SUBMITTED, PENDING_HR, APPROVED khi nghỉ việc.
 *   cancel-request, cancel-request/reject, recalculate không đổi trạng thái.
 *
 * Quyền xem ở `leave-access.ts`; ở đây chỉ trạng thái nguồn, đích và hiệu ứng số dư.
 */
export type LeaveStatus = 'SUBMITTED' | 'PENDING_HR' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
export const LEAVE_STATUSES: LeaveStatus[] = ['SUBMITTED', 'PENDING_HR', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'];
/** Đơn còn giữ lịch (BR-02) và giữ chỗ `pending`. */
export const ACTIVE_STATUSES: LeaveStatus[] = ['SUBMITTED', 'PENDING_HR', 'APPROVED'];

export type LeaveAction =
  | 'approve'
  | 'reject'
  | 'hrApprove'
  | 'hrReject'
  | 'cancel'
  | 'cancelRequest'
  | 'cancelRequestApprove'
  | 'cancelRequestReject'
  | 'complete'
  | 'systemCancel';

/** Cột `leave_request_history.action` (UC3 spec 13.6). */
export type HistoryAction =
  | 'SUBMIT'
  | 'APPROVE'
  | 'MANAGER_APPROVE'
  | 'HR_APPROVE'
  | 'REJECT'
  | 'HR_REJECT'
  | 'CANCEL'
  | 'CANCEL_REQUEST'
  | 'CANCEL_APPROVE'
  | 'CANCEL_REQUEST_REJECT'
  | 'COMPLETE'
  | 'RECALCULATE'
  | 'SYSTEM_CANCEL';

/** Thay đổi số dư (đơn vị: phần ngày của đơn trong từng năm). `release`: trả `pending`; `consume`: `pending` → `used`. */
export type BalanceEffect = 'none' | 'release' | 'consume';

export type TransitionResult =
  | { kind: 'changed'; to: LeaveStatus; history: HistoryAction; balance: BalanceEffect }
  | { kind: 'unchanged' }
  | { kind: 'conflict'; reason: string };

const LABEL: Record<LeaveStatus, string> = {
  SUBMITTED: 'chờ duyệt',
  PENDING_HR: 'chờ HR duyệt',
  APPROVED: 'đã duyệt',
  REJECTED: 'bị từ chối',
  COMPLETED: 'đã hoàn tất',
  CANCELLED: 'đã hủy',
};

export interface TransitionInput {
  status: LeaveStatus;
  requiresHrApproval: boolean;
  hasCancelRequest: boolean;
  /** Hôm nay (giờ Việt Nam) đã tới ngày bắt đầu nghỉ. */
  started: boolean;
  /** Hôm nay (giờ Việt Nam) đã sau ngày kết thúc (BR-10). */
  ended: boolean;
}

const conflict = (reason: string): TransitionResult => ({ kind: 'conflict', reason });
const changed = (to: LeaveStatus, history: HistoryAction, balance: BalanceEffect = 'none'): TransitionResult => ({ kind: 'changed', to, history, balance });

export function transition(r: TransitionInput, action: LeaveAction): TransitionResult {
  const s = r.status;
  const state = `Đơn đang ${LABEL[s]}`;
  switch (action) {
    case 'approve':
      // BR-11: gửi lặp cùng quyết định (đơn đã qua bước quản lý) không đổi gì.
      if (s === 'APPROVED' || s === 'PENDING_HR') return { kind: 'unchanged' };
      if (s !== 'SUBMITTED') return conflict(`${state}, không duyệt được`);
      return r.requiresHrApproval ? changed('PENDING_HR', 'MANAGER_APPROVE') : changed('APPROVED', 'APPROVE');
    case 'reject':
      if (s === 'REJECTED') return { kind: 'unchanged' };
      if (s !== 'SUBMITTED') return conflict(`${state}, không từ chối được`);
      return changed('REJECTED', 'REJECT', 'release');
    case 'hrApprove':
      if (s === 'APPROVED') return { kind: 'unchanged' };
      if (s !== 'PENDING_HR') return conflict(`${state}, không phải đơn chờ HR duyệt`);
      return changed('APPROVED', 'HR_APPROVE');
    case 'hrReject':
      if (s === 'REJECTED') return { kind: 'unchanged' };
      if (s !== 'PENDING_HR') return conflict(`${state}, không phải đơn chờ HR duyệt`);
      return changed('REJECTED', 'HR_REJECT', 'release');
    case 'cancel':
      if (s === 'CANCELLED') return { kind: 'unchanged' };
      if (s === 'APPROVED') return conflict('Đơn đã duyệt: hãy gửi đề nghị hủy để quản lý hoặc HR xác nhận (BR-08)');
      if (s !== 'SUBMITTED' && s !== 'PENDING_HR') return conflict(`${state}, không hủy được`);
      if (r.started) return conflict('Đã tới ngày bắt đầu nghỉ, không tự hủy được; liên hệ HR (BR-07)');
      return changed('CANCELLED', 'CANCEL', 'release');
    case 'cancelRequest':
      if (s !== 'APPROVED') return conflict(`${state}; chỉ đề nghị hủy đơn đã duyệt`);
      if (r.hasCancelRequest) return conflict('Đơn đã có đề nghị hủy đang chờ xử lý');
      if (r.started) return conflict('Đã tới ngày bắt đầu nghỉ, không đề nghị hủy được (BR-08)');
      return changed('APPROVED', 'CANCEL_REQUEST');
    case 'cancelRequestApprove':
      if (s === 'CANCELLED') return { kind: 'unchanged' };
      if (s !== 'APPROVED' || !r.hasCancelRequest) return conflict('Đơn không có đề nghị hủy đang chờ');
      if (r.started) return conflict('Đề nghị hủy đã hết hạn: đã tới ngày bắt đầu nghỉ (AC-4.5.7)');
      return changed('CANCELLED', 'CANCEL_APPROVE', 'release');
    case 'cancelRequestReject':
      if (s !== 'APPROVED' || !r.hasCancelRequest) return conflict('Đơn không có đề nghị hủy đang chờ');
      if (r.started) return conflict('Đề nghị hủy đã hết hạn: đã tới ngày bắt đầu nghỉ (AC-4.5.7)');
      return changed('APPROVED', 'CANCEL_REQUEST_REJECT');
    case 'complete':
      if (s === 'COMPLETED') return { kind: 'unchanged' };
      if (s !== 'APPROVED') return conflict(`${state}, chỉ hoàn tất đơn đã duyệt`);
      if (!r.ended) return conflict('Chỉ hoàn tất từ ngày sau ngày kết thúc nghỉ (BR-10)');
      return changed('COMPLETED', 'COMPLETE', 'consume');
    case 'systemCancel':
      if (!['SUBMITTED', 'PENDING_HR', 'APPROVED'].includes(s)) return { kind: 'unchanged' };
      return changed('CANCELLED', 'SYSTEM_CANCEL', 'release');
  }
}
