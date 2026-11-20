/**
 * Thao tác quản trị tài khoản trên identity provider (UC8 spec mục 13, ADR-17 mục 4). Chỉ worker `identity-sync` gọi.
 * Mọi hàm idempotent: gọi lại khi message bị giao lần hai không tạo trùng, không lỗi.
 */
export interface IdentityProviderAdmin {
  readonly name: string;
  /** Tạo tài khoản, email đã xác minh, gửi thư mời. Đã có thì không tạo, không gửi thư (`created = false`). */
  createUser(input: { email: string; fullName: string; groups: IdpGroup[] }): Promise<{ subject: string; created: boolean }>;
  /** Gửi lại thư mời; mật khẩu tạm cũ hết hiệu lực. */
  resendInvite(email: string): Promise<void>;
  updateEmail(oldEmail: string, email: string): Promise<void>;
  disableUser(email: string): Promise<void>;
  enableUser(email: string): Promise<void>;
  /** Thu hồi mọi refresh token, phiên đăng nhập. */
  signOutAll(email: string): Promise<void>;
  addToGroup(email: string, group: IdpGroup): Promise<void>;
  removeFromGroup(email: string, group: IdpGroup): Promise<void>;
}

/** Nhóm trên IdP chỉ để IdP bắt MFA theo vai trò; API không đọc (ADR-18). */
export type IdpGroup = 'employee' | 'hr' | 'admin';

/**
 * Lỗi từ IdP. `transient`: lỗi mạng, 5xx, bị giới hạn tần suất (thử lại được). Còn lại là lỗi cố định (4xx), thử lại vô ích.
 * `code` là mã ngắn lưu vào `iam.user_account.idp_error`, không chứa dữ liệu cá nhân.
 */
export class IdpError extends Error {
  constructor(
    message: string,
    readonly transient: boolean,
    readonly code: 'IDP_UNAVAILABLE' | 'IDP_REJECTED' | 'IDP_USER_NOT_FOUND' = transient ? 'IDP_UNAVAILABLE' : 'IDP_REJECTED',
  ) {
    super(message);
  }
}

export const IDP_ADMIN = Symbol('IDP_ADMIN');

/** Driver `none`: AUTH_MODE=dev, test, hoặc chưa cấu hình IdP. Không gọi ra ngoài; tài khoản coi như đã có. */
export class NoopIdpAdmin implements IdentityProviderAdmin {
  readonly name = 'none';
  async createUser(input: { email: string }) {
    return { subject: `none|${input.email}`, created: false };
  }
  async resendInvite() {}
  async updateEmail() {}
  async disableUser() {}
  async enableUser() {}
  async signOutAll() {}
  async addToGroup() {}
  async removeFromGroup() {}
}
