/**
 * Audit theo nhóm trường (UC1 spec mục 7, AC-1.4.3, NFR-5.18):
 * - Trường tổ chức (phòng ban, chức danh, quản lý, trạng thái, ngày vào làm) và mã nhân viên: ghi giá trị cũ và mới, để dựng
 *   quá trình công tác (FR-1.13) và tra cứu điều chuyển.
 * - Trường cá nhân (họ tên, email, điện thoại, địa chỉ, ngày sinh) và trường nhạy cảm (CCCD, tài khoản, lương): chỉ ghi tên
 *   trường, giá trị thay bằng `***`.
 */
export const ORG_FIELDS = ['departmentId', 'positionId', 'managerId', 'status', 'hireDate'] as const;
const KEEP_VALUE = new Set<string>([...ORG_FIELDS, 'employeeCode']);

export type AuditValue = string | number | null | { from: unknown; to: unknown };

/** `before` null: tạo mới, trường tổ chức ghi giá trị mới. Có `before`: trường tổ chức ghi `{ from, to }`. */
export function auditFields(changes: Record<string, unknown>, before: Record<string, unknown> | null): Record<string, AuditValue> {
  const out: Record<string, AuditValue> = {};
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) continue;
    if (!KEEP_VALUE.has(key)) out[key] = '***';
    else out[key] = before ? { from: before[key] ?? null, to: value ?? null } : ((value ?? null) as AuditValue);
  }
  return out;
}
