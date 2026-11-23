/**
 * Danh mục đối tượng và hành động audit (UC7 spec mục 2). Dùng để kiểm bộ lọc `entity`, `action` (400 nếu giá trị lạ) và để
 * `audit-catalog.spec.ts` bắt lỗi khi module thêm hành động mới mà quên khai báo ở đây.
 */
export const AUDIT_ENTITY_TYPES = [
  'employee',
  'department',
  'position',
  'leave_request',
  'leave_balance',
  'holiday',
  'approval_delegation',
  'document',
  'user_account',
  'role_assignment',
] as const;
export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

export const AUDIT_ACTIONS = [
  // Employee (UC1, UC2)
  'CREATE',
  'UPDATE',
  'VIEW_SENSITIVE',
  'PROFILE_CHANGE_SUBMIT',
  'PROFILE_CHANGE_CANCEL',
  'PROFILE_CHANGE_APPROVE',
  'PROFILE_CHANGE_REJECT',
  'PROFILE_ITEM_CREATE',
  'PROFILE_ITEM_UPDATE',
  'PROFILE_ITEM_DELETE',
  'PROFILE_FILE_UPLOAD',
  'PROFILE_FILE_DELETE',
  'PROFILE_FILE_DOWNLOAD',
  'TRANSFER_SCHEDULE',
  'TRANSFER_CANCEL',
  'TRANSFER',
  'TRANSFER_FAIL',
  // Leave (UC3, UC4)
  'LEAVE_SUBMIT',
  'LEAVE_APPROVE',
  'LEAVE_REJECT',
  'LEAVE_HR_APPROVE',
  'LEAVE_HR_REJECT',
  'LEAVE_CANCEL',
  'LEAVE_CANCEL_REQUEST',
  'LEAVE_CANCEL_APPROVED',
  'LEAVE_CANCEL_REQUEST_REJECT',
  'LEAVE_COMPLETE',
  'LEAVE_SYSTEM_CANCEL',
  'LEAVE_RECALCULATE',
  'VIEW_LEAVE_REASON',
  'LEAVE_BALANCE_ADJUST',
  'LEAVE_BALANCE_OVERDRAWN',
  'HOLIDAY_CREATE',
  'HOLIDAY_DELETE',
  'DELEGATION_CREATE',
  'DELEGATION_END',
  // Document (UC5)
  'DOCUMENT_CREATE',
  'DOCUMENT_PUBLISH',
  'DOCUMENT_UPDATE',
  'DOCUMENT_HIDE',
  'DOCUMENT_RESTORE',
  // Identity (UC8)
  'ACCOUNT_INVITE',
  'ACCOUNT_SYNC_FAILED',
  'ROLE_GRANT',
  'ROLE_REVOKE',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * Đối tượng chỉ HR được xem trong tra cứu audit (UC7 D1, BR-14, NFR-5.18): audit đơn nghỉ, số dư có loại phép (ốm, thai sản).
 * Người chỉ có `ADMIN` không thấy các dòng này.
 */
export const HR_ONLY_ENTITY_TYPES: AuditEntityType[] = ['leave_request', 'leave_balance'];
