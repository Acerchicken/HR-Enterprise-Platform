/**
 * State machine của đơn nghỉ phép (thiết kế tuần 6, hiện thực API ở tuần 8).
 *
 *   (tạo đơn) ──► SUBMITTED ──approve──► APPROVED ──complete──► COMPLETED
 *                    │  │
 *                    │  └──reject──► REJECTED
 *                    └──cancel──► CANCELLED
 *
 * Hàm thuần (không đụng DB) để test dễ; module Leave gọi nó bên trong transaction
 * rồi áp dụng `balanceEffect` lên leave_balance và ghi leave_request_history + audit.
 */
export type LeaveStatus = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
export type LeaveAction = 'approve' | 'reject' | 'complete' | 'cancel';
export type ActorRelation = 'OWNER' | 'DIRECT_MANAGER' | 'HR' | 'OTHER';

/** Thay đổi số dư phép (đơn vị: ngày) do một bước chuyển gây ra. */
export interface BalanceEffect {
  pending: number;
  used: number;
}

export type TransitionResult =
  | { kind: 'changed'; to: LeaveStatus; balanceEffect: BalanceEffect }
  | { kind: 'unchanged'; to: LeaveStatus }
  | { kind: 'forbidden'; reason: string }
  | { kind: 'conflict'; reason: string };

interface Rule {
  from: LeaveStatus;
  to: LeaveStatus;
  allowed: ActorRelation[];
  effect: (days: number) => BalanceEffect;
}

const RULES: Record<LeaveAction, Rule> = {
  approve: { from: 'SUBMITTED', to: 'APPROVED', allowed: ['DIRECT_MANAGER'], effect: () => ({ pending: 0, used: 0 }) },
  reject: { from: 'SUBMITTED', to: 'REJECTED', allowed: ['DIRECT_MANAGER'], effect: (d) => ({ pending: -d, used: 0 }) },
  cancel: { from: 'SUBMITTED', to: 'CANCELLED', allowed: ['OWNER'], effect: (d) => ({ pending: -d, used: 0 }) },
  complete: { from: 'APPROVED', to: 'COMPLETED', allowed: ['HR'], effect: (d) => ({ pending: -d, used: d }) },
};

/** Tạo đơn: giữ chỗ số ngày ở trạng thái pending. */
export function submitEffect(days: number): BalanceEffect {
  return { pending: days, used: 0 };
}

export function transition(
  current: LeaveStatus,
  action: LeaveAction,
  actor: ActorRelation,
  days: number,
): TransitionResult {
  const rule = RULES[action];
  if (!rule.allowed.includes(actor)) {
    return { kind: 'forbidden', reason: `Không có quyền ${action} đơn này` };
  }
  // Gửi lại cùng một quyết định (bấm 2 lần, retry) → trả kết quả cũ, không tạo side-effect.
  if (current === rule.to) {
    return { kind: 'unchanged', to: current };
  }
  if (current !== rule.from) {
    return { kind: 'conflict', reason: `Đơn đang ở trạng thái ${current}, không thể ${action}` };
  }
  return { kind: 'changed', to: rule.to, balanceEffect: rule.effect(days) };
}
