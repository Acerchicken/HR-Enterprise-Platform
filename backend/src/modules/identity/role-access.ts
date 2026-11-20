import { AuthUser } from './roles';

/**
 * Quy tắc cấp, thu hồi vai trò (UC8 FR-8.7, ADR-18 quyết định 2). Hàm thuần, không gọi database: service đọc dữ liệu rồi hỏi
 * các hàm này, để unit test từng vai trò không cần hạ tầng (authorization.md mục 4, lớp 2).
 */

/** E11: không tự cấp, tự thu hồi vai trò của chính mình (chặn tự nâng quyền, T-06). */
export function isSelfChange(actor: AuthUser, targetAccountId: string): boolean {
  return actor.userId === targetAccountId;
}

/**
 * E12: thu hồi ADMIN thì phải còn ít nhất một ADMIN đang hoạt động khác.
 * `activeAdmins` là id tài khoản đang có ADMIN và chưa nghỉ việc (đọc với `FOR UPDATE`).
 */
export function wouldRemoveLastAdmin(activeAdmins: string[], removing: string): boolean {
  return activeAdmins.filter((id) => id !== removing).length === 0;
}
