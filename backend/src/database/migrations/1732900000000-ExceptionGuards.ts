import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ngoại lệ TV2 chốt 25/11/2026 (spec mục 6.1):
 * - UC7 E10 (NFR-5.14): trigger theo dòng không bắt `TRUNCATE`, nên thêm trigger theo câu lệnh chặn `TRUNCATE audit.audit_log`.
 *   Chủ bảng vẫn tắt được trigger (seed `--reset` ở dev làm vậy); tách quyền database trên staging là việc hạ tầng riêng.
 * - UC1 E29: yêu cầu sửa hồ sơ bị hủy vì chủ hồ sơ nghỉ việc ghi lý do `TERMINATED`.
 */
export class ExceptionGuards1732900000000 implements MigrationInterface {
  name = 'ExceptionGuards1732900000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TRIGGER trg_audit_no_truncate BEFORE TRUNCATE ON audit.audit_log
      FOR EACH STATEMENT EXECUTE FUNCTION audit.forbid_change()`);
    await q.query(`ALTER TABLE employee.profile_change_request ADD COLUMN cancel_reason varchar(20)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE employee.profile_change_request DROP COLUMN cancel_reason`);
    await q.query(`DROP TRIGGER trg_audit_no_truncate ON audit.audit_log`);
  }
}
