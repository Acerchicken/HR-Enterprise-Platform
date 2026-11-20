import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * UC8 FR-8.3, 8.4, 8.6 (ADR-17 mục 4): trạng thái tài khoản trên IdP. Dòng có sẵn đều do đăng nhập tạo nên là ACTIVE.
 * "Chưa có tài khoản" (NONE) không lưu: là khi hồ sơ chưa có dòng `iam.user_account`.
 */
export class AccountLifecycle1732400000000 implements MigrationInterface {
  name = 'AccountLifecycle1732400000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE iam.user_account
      ADD COLUMN idp_status varchar(10) NOT NULL DEFAULT 'ACTIVE'
        CHECK (idp_status IN ('PENDING', 'INVITED', 'ACTIVE', 'DISABLED', 'FAILED')),
      ADD COLUMN invited_at timestamptz NULL,
      ADD COLUMN idp_synced_at timestamptz NULL,
      ADD COLUMN idp_error varchar(40) NULL`);
    await q.query(`CREATE INDEX ix_user_account_idp_status ON iam.user_account (idp_status)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX iam.ix_user_account_idp_status`);
    await q.query(`ALTER TABLE iam.user_account DROP COLUMN idp_error, DROP COLUMN idp_synced_at, DROP COLUMN invited_at, DROP COLUMN idp_status`);
  }
}
