import { AuthUser, hasRole } from '../identity/roles';
import { UpdateEmployeeDto, ViewLevel } from './employee.dto';

/**
 * Quy tắc phân quyền trên hồ sơ (NFR Security tuần 5), viết thành hàm thuần để test:
 * - HR: xem đầy đủ, trường nhạy cảm chỉ trả khi yêu cầu (và ghi audit).
 * - Chính mình, quản lý trực tiếp: xem thông tin cá nhân (ngày sinh, địa chỉ, ngày vào làm). Quản lý gián tiếp cần database
 *   nên `EmployeeService.profile` nâng thêm bằng `resolveRelation`.
 * - Người khác, kể cả ADMIN: chỉ thông tin danh bạ.
 */
export function viewLevel(actor: AuthUser, target: { id: string; managerId: string | null }): ViewLevel {
  if (hasRole(actor, 'HR')) return 'HR';
  if (actor.employeeId && (actor.employeeId === target.id || actor.employeeId === target.managerId)) {
    return 'PERSONAL';
  }
  return 'PUBLIC';
}

/** Trả về danh sách trường bị cấm sửa (rỗng = được phép). */
export function forbiddenFields(actor: AuthUser, targetId: string, dto: UpdateEmployeeDto): string[] {
  const fields = Object.keys(dto).filter((k) => k !== 'version' && (dto as any)[k] !== undefined);
  // AC-1.2.1, E1: chỉ HR ghi thẳng hồ sơ. Nhân viên sửa điện thoại, địa chỉ bằng yêu cầu cập nhật (FR-1.9), HR duyệt.
  void targetId;
  return hasRole(actor, 'HR') ? [] : fields;
}
