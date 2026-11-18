import { ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { wouldRemoveLastAdmin } from '../identity/role-access';
import { AuthUser } from '../identity/roles';

/**
 * Vòng đời tài khoản đăng nhập theo hồ sơ (UC8 FR-8.3, 8.4, AC-8.3.6; ADR-17 mục 4). Gọi trong giao dịch lưu hồ sơ: ghi
 * `iam.user_account` và event vào outbox chung, worker `identity-sync` làm phần trên IdP sau. Ghi chéo schema `iam` bằng SQL
 * (database-schema.md mục 9): Identity đã phụ thuộc Employee nên Employee không gọi ngược service của Identity.
 */

async function outbox(m: EntityManager, type: string, accountId: string, payload: object) {
  await m.query(`INSERT INTO leave.outbox (event_type, aggregate_id, payload) VALUES ($1, $2, $3)`, [
    type,
    accountId,
    JSON.stringify({ ...payload, occurredAt: new Date().toISOString() }),
  ]);
}

/** HR tạo hồ sơ (luồng 4.2): tài khoản `PENDING` + `EmployeeCreated`. Email đã có tài khoản (chưa gắn hồ sơ) thì gắn vào. */
export async function onEmployeeCreated(m: EntityManager, e: { id: string; workEmail: string; fullName: string }) {
  const [acc] = await m.query(
    `INSERT INTO iam.user_account (email, employee_id, idp_status) VALUES ($1, $2, 'PENDING')
     ON CONFLICT (email) DO UPDATE SET employee_id = EXCLUDED.employee_id WHERE iam.user_account.employee_id IS NULL
     RETURNING id`,
    [e.workEmail, e.id],
  );
  if (!acc) throw new ConflictException('Email công ty đã gắn với tài khoản của người khác');
  await outbox(m, 'EmployeeCreated', acc.id, { employeeId: e.id, accountId: acc.id, email: e.workEmail, fullName: e.fullName });
}

async function accountOf(m: EntityManager, employeeId: string): Promise<{ id: string; email: string } | null> {
  const [acc] = await m.query(`SELECT id, email FROM iam.user_account WHERE employee_id = $1`, [employeeId]);
  return acc ?? null;
}

/** Nghỉ việc (4.3) hoặc khôi phục (A5). Hồ sơ chưa có tài khoản thì không có gì để khóa, mở. */
export async function onEmploymentChanged(m: EntityManager, employeeId: string, terminated: boolean, actor: AuthUser) {
  const acc = await accountOf(m, employeeId);
  if (!acc) return;
  if (terminated) await revokeGrantedRoles(m, acc, actor);
  await outbox(m, terminated ? 'EmployeeTerminated' : 'EmployeeReinstated', acc.id, { employeeId, accountId: acc.id, email: acc.email });
}

const TERMINATION_REASON = 'Nghỉ việc';

/**
 * Nghỉ việc thì mất `HR`, `ADMIN` (ADR-18): khôi phục hồ sơ không tự trả lại quyền, ADMIN phải cấp lại. Không cho nghỉ việc
 * ADMIN cuối cùng đang làm việc (cùng luật E12 của trang Phân quyền, UC8 AC-8.7.4). Ghi audit `ROLE_REVOKE` và event
 * `RoleRevoked` như thu hồi bằng tay để worker bỏ nhóm trên IdP.
 */
async function revokeGrantedRoles(m: EntityManager, acc: { id: string; email: string }, actor: AuthUser) {
  const held: { role: 'HR' | 'ADMIN' }[] = await m.query(
    `SELECT role FROM iam.role_assignment WHERE user_id = $1 AND role IN ('HR', 'ADMIN')`,
    [acc.id],
  );
  if (!held.length) return;
  if (held.some((r) => r.role === 'ADMIN')) {
    const admins: { user_id: string; status: string | null }[] = await m.query(
      `SELECT r.user_id, e.status FROM iam.role_assignment r
         JOIN iam.user_account a ON a.id = r.user_id
         LEFT JOIN employee.employee e ON e.id = a.employee_id
       WHERE r.role = 'ADMIN' FOR UPDATE OF r`,
    );
    const active = admins.filter((x) => x.status !== 'TERMINATED').map((x) => x.user_id);
    if (wouldRemoveLastAdmin(active, acc.id)) {
      throw new ConflictException('Người này là ADMIN cuối cùng. Cấp ADMIN cho người khác trước khi cho nghỉ việc');
    }
  }
  await m.query(`DELETE FROM iam.role_assignment WHERE user_id = $1 AND role IN ('HR', 'ADMIN')`, [acc.id]);
  for (const { role } of held) {
    await m.query(
      `INSERT INTO audit.audit_log (actor_id, action, entity_type, entity_id, changed_fields) VALUES ($1, 'ROLE_REVOKE', 'role_assignment', $2, $3)`,
      [actor.employeeId, acc.id, JSON.stringify({ userId: acc.id, role, reason: TERMINATION_REASON })],
    );
    await outbox(m, 'RoleRevoked', acc.id, { accountId: acc.id, email: acc.email, role });
  }
}

/** HR đổi email công ty (A8, AC-8.3.6): đổi email đăng nhập ngay, IdP đổi theo; `subject` giữ nguyên. */
export async function onWorkEmailChanged(m: EntityManager, employeeId: string, email: string) {
  const acc = await accountOf(m, employeeId);
  if (!acc || acc.email === email) return;
  const [taken] = await m.query(`SELECT 1 FROM iam.user_account WHERE email = $1 AND id <> $2`, [email, acc.id]);
  if (taken) throw new ConflictException('Email công ty đã gắn với tài khoản đăng nhập khác');
  await m.query(`UPDATE iam.user_account SET email = $2 WHERE id = $1`, [acc.id, email]);
  await outbox(m, 'EmployeeEmailChanged', acc.id, { employeeId, accountId: acc.id, email, oldEmail: acc.email });
}
