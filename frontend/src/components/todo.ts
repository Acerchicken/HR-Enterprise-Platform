import { TodoCounts } from '../api/client';

export type ApprovalTab = 'leave' | 'leave-complete' | 'profile';

export interface TodoItem {
  key: ApprovalTab | 'my-rejected' | 'my-pending';
  count: number;
  /** Câu ngắn cho chuông và dải "Việc cần làm" (frontend.md 2.1, 2.2). */
  text: string;
  /** Đường dẫn; `profile` mở popup hồ sơ của mình. */
  to: string | 'profile';
  /** false: chỉ để biết (yêu cầu của mình đang chờ HR), không tính vào số trên chuông. */
  action: boolean;
}

/** Số việc theo tab của trang "Việc cần duyệt"; tab người dùng không có thì không có khóa (AC-0.6.1). */
export function tabCounts(t: TodoCounts | null): Partial<Record<ApprovalTab, number>> {
  if (!t) return {};
  const out: Partial<Record<ApprovalTab, number>> = {};
  if (t.leave !== null) out.leave = t.leave;
  if (t.leaveComplete !== null) out['leave-complete'] = t.leaveComplete;
  if (t.profile !== null) out.profile = t.profile;
  return out;
}

/** Danh sách việc khác 0, theo thứ tự cố định để vị trí thẻ không nhảy. */
export function todoItems(t: TodoCounts | null): TodoItem[] {
  if (!t) return [];
  const all: TodoItem[] = [
    { key: 'leave', count: t.leave ?? 0, text: `${t.leave} đơn nghỉ chờ bạn duyệt`, to: '/approvals?type=leave', action: true },
    { key: 'leave-complete', count: t.leaveComplete ?? 0, text: `${t.leaveComplete} đơn đã duyệt chờ hoàn tất`, to: '/approvals?type=leave-complete', action: true },
    { key: 'profile', count: t.profile ?? 0, text: `${t.profile} yêu cầu cập nhật hồ sơ chờ duyệt`, to: '/approvals?type=profile', action: true },
    { key: 'my-rejected', count: t.myRejectedChanges, text: `${t.myRejectedChanges} yêu cầu của bạn bị từ chối`, to: 'profile', action: true },
    { key: 'my-pending', count: t.myPendingChanges, text: `${t.myPendingChanges} yêu cầu cập nhật hồ sơ chờ HR`, to: 'profile', action: false },
  ];
  return all.filter((i) => i.count > 0);
}

/** Số hiện trên chuông, ô chức năng: quá 99 thì "99+". */
export function countLabel(n: number): string {
  return n > 99 ? '99+' : String(n);
}
