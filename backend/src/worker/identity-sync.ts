import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { APP_CONFIG, AppConfig } from '../config/config';
import { AccountEventPayload, EmployeeAccountEventPayload, IdentityEventType, RoleEventPayload } from '../modules/identity/identity-events';
import { IDP_ADMIN, IdentityProviderAdmin, IdpError, IdpGroup } from '../modules/identity/idp-admin/idp-admin';

type Payload = AccountEventPayload & EmployeeAccountEventPayload & RoleEventPayload;
type Status = 'INVITED' | 'ACTIVE' | 'DISABLED' | null;

/**
 * Consumer `identity-sync` (UC8 spec mục 9.2, 13; ADR-17 mục 4): đưa thay đổi tài khoản, vai trò trong database sang IdP.
 * IdP lỗi tạm thời thì thử lại tối đa `IDP_SYNC_ATTEMPTS` lần, chờ nhân đôi. Hết lượt hoặc lỗi cố định: tài khoản ghi `FAILED`
 * (với tạo, mời) hoặc chỉ ghi `idp_error`, audit `ACCOUNT_SYNC_FAILED`, rồi ném lỗi để message vào DLQ (E6).
 */
@Injectable()
export class IdentitySync {
  private readonly logger = new Logger(IdentitySync.name);

  constructor(
    @Inject(APP_CONFIG) private readonly cfg: AppConfig,
    @InjectDataSource() private readonly ds: DataSource,
    @Inject(IDP_ADMIN) private readonly idp: IdentityProviderAdmin,
  ) {}

  async handle(type: IdentityEventType, p: Payload): Promise<void> {
    try {
      const status = await this.withRetry(() => this.apply(type, p));
      await this.ds.query(
        `UPDATE iam.user_account
            SET idp_status = COALESCE($2, idp_status), idp_synced_at = now(), idp_error = NULL,
                invited_at = CASE WHEN $2 = 'INVITED' THEN now() ELSE invited_at END
          WHERE id = $1`,
        [p.accountId, status],
      );
      this.logger.log(`${type} ${p.accountId} → ${this.idp.name}${status ? ` (${status})` : ''}`);
    } catch (e) {
      const code = e instanceof IdpError ? e.code : 'IDP_UNAVAILABLE';
      const failsAccount = type === 'EmployeeCreated' || type === 'AccountInviteRequested';
      await this.ds.query(
        `UPDATE iam.user_account SET idp_error = $2, idp_status = CASE WHEN $3 THEN 'FAILED' ELSE idp_status END WHERE id = $1`,
        [p.accountId, code, failsAccount],
      );
      await this.ds.query(
        `INSERT INTO audit.audit_log (actor_id, action, entity_type, entity_id, changed_fields) VALUES (NULL, 'ACCOUNT_SYNC_FAILED', 'user_account', $1, $2)`,
        [p.accountId, JSON.stringify({ event: type, error: code })],
      );
      this.logger.error(`${type} ${p.accountId}: ${(e as Error).message}`);
      throw e;
    }
  }

  /** Thực hiện trên IdP; trả trạng thái mới của tài khoản (null = giữ nguyên). */
  private async apply(type: IdentityEventType, p: Payload): Promise<Status> {
    switch (type) {
      case 'EmployeeCreated':
      case 'AccountInviteRequested': {
        // A6: đã mời mà chưa kích hoạt → gửi lại thư; chưa có trên IdP → tạo; đã có (tài khoản demo) → chỉ gắn (AC-8.6.4, E7).
        if (type === 'AccountInviteRequested' && p.previousStatus === 'INVITED') {
          await this.idp.resendInvite(p.email);
          return 'INVITED';
        }
        const { created } = await this.idp.createUser({ email: p.email, fullName: p.fullName, groups: ['employee'] });
        return created ? 'INVITED' : 'ACTIVE';
      }
      case 'EmployeeTerminated':
        await this.idp.disableUser(p.email);
        await this.idp.signOutAll(p.email);
        return 'DISABLED';
      case 'EmployeeReinstated': {
        await this.idp.enableUser(p.email);
        const [acc] = await this.ds.query(`SELECT subject, last_login_at FROM iam.user_account WHERE id = $1`, [p.accountId]);
        return acc?.subject || acc?.last_login_at ? 'ACTIVE' : 'INVITED';
      }
      case 'EmployeeEmailChanged':
        await this.idp.updateEmail(p.oldEmail ?? p.email, p.email);
        return null;
      case 'RoleGranted':
        await this.idp.addToGroup(p.email, p.role.toLowerCase() as IdpGroup);
        return null;
      case 'RoleRevoked':
        await this.idp.removeFromGroup(p.email, p.role.toLowerCase() as IdpGroup);
        return null;
    }
  }

  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    const { attempts, retryDelayMs } = this.cfg.idpAdmin;
    for (let i = 1; ; i++) {
      try {
        return await fn();
      } catch (e) {
        const transient = !(e instanceof IdpError) || e.transient;
        if (!transient || i >= attempts) throw e;
        await new Promise((r) => setTimeout(r, retryDelayMs * 2 ** (i - 1)));
      }
    }
  }
}
