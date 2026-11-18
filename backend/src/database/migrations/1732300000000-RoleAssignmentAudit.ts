import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * UC8 FR-8.7, ADR-18: ai cấp vai trò HR, ADMIN, lúc nào, vì sao. Dòng có từ trước để `granted_by`, `reason` NULL.
 * Thu hồi xóa dòng; lịch sử nằm ở audit (`ROLE_GRANT`, `ROLE_REVOKE`).
 */
export class RoleAssignmentAudit1732300000000 implements MigrationInterface {
  name = 'RoleAssignmentAudit1732300000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE iam.role_assignment
      ADD COLUMN granted_by uuid NULL REFERENCES iam.user_account(id) ON DELETE SET NULL,
      ADD COLUMN granted_at timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN reason varchar(200) NULL`);
    await q.query(`CREATE INDEX ix_role_assignment_role ON iam.role_assignment (role)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX iam.ix_role_assignment_role`);
    await q.query(`ALTER TABLE iam.role_assignment DROP COLUMN reason, DROP COLUMN granted_at, DROP COLUMN granted_by`);
  }
}
