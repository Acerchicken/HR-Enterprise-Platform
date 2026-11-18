import { AppConfig } from '../../../config/config';
import { IdentityProviderAdmin, IdpError, IdpGroup } from './idp-admin';

type Fetch = typeof fetch;
interface KcUser {
  id: string;
  email?: string;
  enabled?: boolean;
}

/** Thư mời Keycloak còn hiệu lực 7 ngày, bằng mật khẩu tạm của Cognito (`temporary_password_validity_days`). */
const INVITE_LIFESPAN_SECONDS = 7 * 24 * 3600;

/**
 * Driver Keycloak (local): Admin REST API bằng client `hr-api-admin` (client credentials; service account chỉ có role
 * `manage-users`, `view-users` của realm-management). Nhóm = realm role cùng tên. Thư mời = "execute actions email" với
 * `UPDATE_PASSWORD` (Keycloak gửi qua SMTP của realm, local là Mailpit).
 */
export class KeycloakIdpAdmin implements IdentityProviderAdmin {
  readonly name = 'keycloak';
  private token: { value: string; expiresAt: number } | null = null;

  constructor(
    private readonly cfg: AppConfig['idpAdmin']['keycloak'],
    private readonly http: Fetch = fetch,
  ) {}

  async createUser(input: { email: string; fullName: string; groups: IdpGroup[] }) {
    const existing = await this.find(input.email);
    if (existing) return { subject: existing.id, created: false };
    const { firstName, lastName } = splitName(input.fullName);
    const res = await this.call('POST', '/users', {
      username: input.email,
      email: input.email,
      emailVerified: true,
      enabled: true,
      firstName,
      lastName,
      requiredActions: ['UPDATE_PASSWORD'],
    });
    // 409: người khác vừa tạo cùng lúc (message giao hai lần) → coi như đã có.
    if (res.status === 409) {
      const again = await this.find(input.email);
      if (again) return { subject: again.id, created: false };
    }
    const user = await this.mustFind(input.email);
    for (const g of input.groups) await this.addRole(user.id, g);
    await this.sendInvite(user.id);
    return { subject: user.id, created: true };
  }

  async resendInvite(email: string) {
    await this.sendInvite((await this.mustFind(email)).id);
  }

  async updateEmail(oldEmail: string, email: string) {
    const user = (await this.find(email)) ?? (await this.mustFind(oldEmail));
    await this.call('PUT', `/users/${user.id}`, { email, emailVerified: true });
  }

  async disableUser(email: string) {
    const user = await this.find(email);
    if (user) await this.call('PUT', `/users/${user.id}`, { enabled: false });
  }

  async enableUser(email: string) {
    await this.call('PUT', `/users/${(await this.mustFind(email)).id}`, { enabled: true });
  }

  async signOutAll(email: string) {
    const user = await this.find(email);
    if (user) await this.call('POST', `/users/${user.id}/logout`);
  }

  async addToGroup(email: string, group: IdpGroup) {
    await this.addRole((await this.mustFind(email)).id, group);
  }

  async removeFromGroup(email: string, group: IdpGroup) {
    const user = await this.find(email);
    if (!user) return;
    const role = await this.role(group);
    await this.call('DELETE', `/users/${user.id}/role-mappings/realm`, [role]);
  }

  // ---------- Nội bộ ----------

  private async sendInvite(userId: string) {
    await this.call('PUT', `/users/${userId}/execute-actions-email?lifespan=${INVITE_LIFESPAN_SECONDS}`, ['UPDATE_PASSWORD']);
  }

  private async addRole(userId: string, group: IdpGroup) {
    const role = await this.role(group);
    await this.call('POST', `/users/${userId}/role-mappings/realm`, [role]);
  }

  private async role(name: IdpGroup): Promise<{ id: string; name: string }> {
    const res = await this.call('GET', `/roles/${encodeURIComponent(name)}`);
    return (await res.json()) as { id: string; name: string };
  }

  private async find(email: string): Promise<KcUser | null> {
    const res = await this.call('GET', `/users?email=${encodeURIComponent(email)}&exact=true`);
    const users = (await res.json()) as KcUser[];
    return users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
  }

  private async mustFind(email: string): Promise<KcUser> {
    const user = await this.find(email);
    if (!user) throw new IdpError('Không thấy tài khoản trên Keycloak', false, 'IDP_USER_NOT_FOUND');
    return user;
  }

  /** Gọi Admin API; 409 trả về cho nơi gọi xử lý, lỗi khác ném `IdpError`. */
  private async call(method: string, path: string, body?: unknown): Promise<Response> {
    const token = await this.accessToken();
    const res = await this.http(`${this.cfg.baseUrl}/admin/realms/${this.cfg.realm}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }).catch((e: Error) => {
      throw new IdpError(`Keycloak không phản hồi: ${e.message}`, true);
    });
    if (res.ok || res.status === 409) return res;
    if (res.status === 401) this.token = null;
    throw new IdpError(`Keycloak ${method} ${path.split('?')[0]} → ${res.status}`, res.status >= 500 || res.status === 429 || res.status === 401);
  }

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 10_000) return this.token.value;
    const res = await this.http(`${this.cfg.baseUrl}/realms/${this.cfg.realm}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: this.cfg.clientId, client_secret: this.cfg.clientSecret ?? '' }),
    }).catch((e: Error) => {
      throw new IdpError(`Keycloak không phản hồi: ${e.message}`, true);
    });
    if (!res.ok) throw new IdpError(`Không lấy được token quản trị Keycloak (${res.status})`, res.status >= 500);
    const json = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
    return json.access_token;
  }
}

/** "Nguyễn Văn An" → họ "Nguyễn Văn", tên "An" (cách Keycloak hiển thị firstName lastName). */
export function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts.pop() ?? '';
  return { firstName, lastName: parts.join(' ') };
}
