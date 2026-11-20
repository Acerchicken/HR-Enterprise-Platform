import { AuthUser, hasRole } from '../identity/roles';
import { LeaveAction } from './leave-state-machine';

/**
 * Quyền xử lý đơn nghỉ (UC4 13.7, ADR-18). Hàm thuần: service đọc các "facts" (quản lý trực tiếp hiện tại của chủ đơn, chủ đơn
 * có phải CEO, người duyệt thay đang hiệu lực) rồi hỏi các hàm này; unit test từng vai trò không cần database.
 */
export type Relation = 'OWNER' | 'DIRECT_MANAGER' | 'DELEGATE' | 'HR';

export interface RequestFacts {
  ownerId: string;
  /** `manager_id` hiện tại của chủ đơn (BR-05: người duyệt tính lúc xử lý). */
  ownerManagerId: string | null;
  ownerIsCeo: boolean;
  /** Người đang được giao duyệt thay quản lý trực tiếp của chủ đơn hôm nay (BR-06; không nối tiếp). */
  activeDelegateIds: readonly string[];
  requiresHrApproval: boolean;
}

export function relation(actor: AuthUser, f: RequestFacts): Set<Relation> {
  const out = new Set<Relation>();
  const me = actor.employeeId;
  if (me && me === f.ownerId) out.add('OWNER');
  if (me && f.ownerManagerId && me === f.ownerManagerId) out.add('DIRECT_MANAGER');
  if (me && me !== f.ownerId && f.activeDelegateIds.includes(me)) out.add('DELEGATE');
  if (hasRole(actor, 'HR')) out.add('HR');
  return out;
}

/** Xem chi tiết: quản lý gián tiếp, trưởng, phó đơn vị, ADMIN không có quan hệ nào nên 403 (AC-4.7.5). */
export function canView(rel: Set<Relation>): boolean {
  return rel.size > 0;
}

/** Người duyệt bước đầu: quản lý trực tiếp hoặc người duyệt thay; HR khi chủ đơn là CEO (BR-05). */
export function isApprover(rel: Set<Relation>, f: RequestFacts): boolean {
  if (rel.has('OWNER')) return false;
  if (rel.has('DIRECT_MANAGER') || rel.has('DELEGATE')) return true;
  return rel.has('HR') && f.ownerIsCeo;
}

/** Ai được làm thao tác `action` trên đơn (UC4 13.7). */
export function allowed(action: LeaveAction | 'recalculate', rel: Set<Relation>, f: RequestFacts): boolean {
  switch (action) {
    case 'approve':
    case 'reject':
      return isApprover(rel, f);
    case 'hrApprove':
    case 'hrReject':
    case 'complete':
    case 'recalculate':
      return rel.has('HR') && !rel.has('OWNER');
    case 'cancel':
    case 'cancelRequest':
      return rel.has('OWNER');
    case 'cancelRequestApprove':
    case 'cancelRequestReject':
      if (rel.has('OWNER')) return false;
      // Đơn đã qua HR duyệt thêm hoặc của CEO: chỉ HR (đề xuất UC4 13.4, chờ TV2 xác nhận).
      if (f.requiresHrApproval || f.ownerIsCeo) return rel.has('HR');
      return rel.has('DIRECT_MANAGER') || rel.has('DELEGATE') || rel.has('HR');
    case 'systemCancel':
      return false;
  }
}

/** Lý do nghỉ ốm, thai sản chỉ chủ đơn và HR xem (BR-14). */
export const PRIVATE_REASON_TYPES = ['SICK', 'MATERNITY'];

export function canSeeReason(rel: Set<Relation>, leaveType: string): boolean {
  return !PRIVATE_REASON_TYPES.includes(leaveType) || rel.has('OWNER') || rel.has('HR');
}

/** Tạo đơn hộ (BR-12): HR cho mọi người; quản lý trực tiếp cho cấp dưới trực tiếp (không tính duyệt thay). */
export function canCreateFor(actor: AuthUser, ownerId: string, ownerManagerId: string | null): boolean {
  if (actor.employeeId === ownerId) return true;
  if (hasRole(actor, 'HR')) return true;
  return !!actor.employeeId && actor.employeeId === ownerManagerId;
}
