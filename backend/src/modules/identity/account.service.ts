import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { AccountEventPayload } from './identity-events';
import { AuthUser } from './roles';
import { writeOutbox } from '../../messaging/outbox';

export type AccountStatus = 'NONE' | 'PENDING' | 'INVITED' | 'ACTIVE' | 'DISABLED' | 'FAILED';

export interface AccountView {
  status: AccountStatus;
  email: string;
  invitedAt: string | null;
  lastLoginAt: string | null;
  syncedAt: string | null;
  error: string | null;
}

/** Trạng thái được gửi (lại) lời mời (AC-8.6.2, AC-8.6.4); còn lại 409 (E9). */
const INVITABLE: AccountStatus[] = ['NONE', 'INVITED', 'FAILED'];

const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null);

/**
 * HR xem trạng thái tài khoản đăng nhập của nhân viên và gửi (lại) lời mời (UC8 FR-8.6, luồng A6, spec 9.2 "Tài khoản").
 * Đọc hồ sơ ở schema `employee` (tên, email công ty, trạng thái làm việc) bằng SQL, như `RoleAdminService`.
 */
@Injectable()
export class AccountService {
  constructor(
    private readonly ds: DataSource,
    private readonly audit: AuditService,
  ) {}

  async view(employeeId: string): Promise<AccountView> {
    const [row] = await this.ds.query(
      `SELECT e.work_email, a.email, a.idp_status, a.invited_at, a.last_login_at, a.idp_synced_at, a.idp_error
         FROM employee.employee e LEFT JOIN iam.user_account a ON a.employee_id = e.id
        WHERE e.id = $1`,
      [employeeId],
    );
    if (!row) throw new NotFoundException('Không tìm thấy nhân viên');
    return {
      status: row.idp_status ?? 'NONE',
      email: row.email ?? row.work_email,
      invitedAt: iso(row.invited_at),
      lastLoginAt: iso(row.last_login_at),
      syncedAt: iso(row.idp_synced_at),
      error: row.idp_error,
    };
  }

  async invite(actor: AuthUser, employeeId: string): Promise<{ status: 'PENDING' }> {
    await this.ds.transaction(async (m) => {
      const [row] = await m.query(
        `SELECT e.id, e.full_name, e.work_email, e.status, a.id AS account_id, a.idp_status
           FROM employee.employee e LEFT JOIN iam.user_account a ON a.employee_id = e.id
          WHERE e.id = $1 FOR UPDATE OF e`,
        [employeeId],
      );
      if (!row) throw new NotFoundException('Không tìm thấy nhân viên');
      if (row.status === 'TERMINATED') throw new BadRequestException('Nhân viên đã nghỉ việc, không gửi lời mời'); // E10
      const previous: AccountStatus = row.idp_status ?? 'NONE';
      if (!INVITABLE.includes(previous)) {
        throw new ConflictException('Tài khoản không ở trạng thái chờ kích hoạt hoặc lỗi'); // E9
      }
      let accountId: string = row.account_id;
      if (!accountId) {
        const [acc] = await m.query(
          `INSERT INTO iam.user_account (email, employee_id, idp_status) VALUES ($1, $2, 'PENDING')
           ON CONFLICT (email) DO UPDATE SET employee_id = EXCLUDED.employee_id, idp_status = 'PENDING'
             WHERE iam.user_account.employee_id IS NULL
           RETURNING id`,
          [row.work_email, employeeId],
        );
        if (!acc) throw new ConflictException('Email công ty đã gắn với tài khoản của người khác');
        accountId = acc.id;
      } else {
        await m.query(`UPDATE iam.user_account SET idp_status = 'PENDING', idp_error = NULL WHERE id = $1`, [accountId]);
      }
      const payload: AccountEventPayload = {
        employeeId,
        accountId,
        email: row.work_email,
        fullName: row.full_name,
        previousStatus: previous as AccountEventPayload['previousStatus'],
      };
      await writeOutbox(m, 'AccountInviteRequested', accountId, { ...payload, occurredAt: new Date().toISOString() });
      await this.audit.record(
        { actorId: actor.employeeId, action: 'ACCOUNT_INVITE', entityType: 'user_account', entityId: accountId, changedFields: { employeeId, previousStatus: previous } },
        m,
      );
    });
    return { status: 'PENDING' };
  }
}
