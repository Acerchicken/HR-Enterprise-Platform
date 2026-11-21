import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminRemoveUserFromGroupCommand,
  AdminUpdateUserAttributesCommand,
  AdminUserGlobalSignOutCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { AppConfig } from '../../../config/config';
import { IdentityProviderAdmin, IdpError, IdpGroup } from './idp-admin';

interface Sendable {
  send(command: unknown): Promise<any>;
}

/**
 * Driver Cognito (staging). Username trên pool là email lúc tạo; email có thể đổi sau đó nên mọi thao tác tìm username theo
 * thuộc tính `email` (ListUsers). Thư mời do Cognito gửi qua SES (`DesiredDeliveryMediums=EMAIL`). Quyền IAM cần:
 * `cognito-idp:Admin*` ở dưới và `ListUsers` trên ARN pool (deploy.md mục 3).
 */
export class CognitoIdpAdmin implements IdentityProviderAdmin {
  readonly name = 'cognito';
  private readonly pool: string;

  constructor(
    cfg: AppConfig['idpAdmin']['cognito'],
    private readonly client: Sendable = new CognitoIdentityProviderClient({ region: cfg.region }),
  ) {
    this.pool = cfg.userPoolId ?? '';
  }

  async createUser(input: { email: string; fullName: string; groups: IdpGroup[] }) {
    const existing = await this.find(input.email);
    if (existing) return { subject: existing.sub, created: false };
    let sub: string;
    try {
      const out = await this.send(
        new AdminCreateUserCommand({
          UserPoolId: this.pool,
          Username: input.email,
          DesiredDeliveryMediums: ['EMAIL'],
          UserAttributes: [
            { Name: 'email', Value: input.email },
            { Name: 'email_verified', Value: 'true' },
            { Name: 'name', Value: input.fullName },
          ],
        }),
      );
      sub = out.User?.Attributes?.find((a: { Name: string }) => a.Name === 'sub')?.Value ?? '';
    } catch (e) {
      if (e instanceof IdpError && e.message.includes('UsernameExistsException')) {
        const again = await this.mustFind(input.email);
        return { subject: again.sub, created: false };
      }
      throw e;
    }
    for (const g of input.groups) await this.addToGroup(input.email, g);
    return { subject: sub, created: true };
  }

  async resendInvite(email: string) {
    const user = await this.mustFind(email);
    await this.send(
      new AdminCreateUserCommand({ UserPoolId: this.pool, Username: user.username, MessageAction: 'RESEND', DesiredDeliveryMediums: ['EMAIL'] }),
    );
  }

  async updateEmail(oldEmail: string, email: string) {
    const user = (await this.find(email)) ?? (await this.mustFind(oldEmail));
    await this.send(
      new AdminUpdateUserAttributesCommand({
        UserPoolId: this.pool,
        Username: user.username,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
        ],
      }),
    );
  }

  async disableUser(email: string) {
    const user = await this.find(email);
    if (user) await this.send(new AdminDisableUserCommand({ UserPoolId: this.pool, Username: user.username }));
  }

  async enableUser(email: string) {
    await this.send(new AdminEnableUserCommand({ UserPoolId: this.pool, Username: (await this.mustFind(email)).username }));
  }

  async signOutAll(email: string) {
    const user = await this.find(email);
    if (user) await this.send(new AdminUserGlobalSignOutCommand({ UserPoolId: this.pool, Username: user.username }));
  }

  async addToGroup(email: string, group: IdpGroup) {
    const user = await this.mustFind(email);
    await this.send(new AdminAddUserToGroupCommand({ UserPoolId: this.pool, Username: user.username, GroupName: group }));
  }

  async removeFromGroup(email: string, group: IdpGroup) {
    const user = await this.find(email);
    if (user) await this.send(new AdminRemoveUserFromGroupCommand({ UserPoolId: this.pool, Username: user.username, GroupName: group }));
  }

  // ---------- Nội bộ ----------

  private async find(email: string): Promise<{ username: string; sub: string } | null> {
    const out = await this.send(
      new ListUsersCommand({ UserPoolId: this.pool, Filter: `email = "${email.replace(/["\\]/g, '')}"`, Limit: 2 }),
    );
    const u = out.Users?.[0];
    if (!u?.Username) return null;
    const sub = u.Attributes?.find((a: { Name: string }) => a.Name === 'sub')?.Value ?? u.Username;
    return { username: u.Username, sub };
  }

  private async mustFind(email: string) {
    const user = await this.find(email);
    if (!user) throw new IdpError('Không thấy tài khoản trên Cognito', false, 'IDP_USER_NOT_FOUND');
    return user;
  }

  private async send(command: unknown): Promise<any> {
    try {
      return await this.client.send(command);
    } catch (e) {
      const err = e as { name?: string; $fault?: string; $retryable?: unknown };
      const transient = err.$fault === 'server' || !!err.$retryable || /Throttl|TooManyRequests|LimitExceeded/.test(err.name ?? '');
      throw new IdpError(`Cognito ${err.name ?? 'Error'}`, transient);
    }
  }
}
