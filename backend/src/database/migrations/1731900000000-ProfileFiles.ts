import { MigrationInterface, QueryRunner } from 'typeorm';

/** UC1 FR-1.10, spec 13.1: file hồ sơ (CV, bằng cấp, giấy tờ người phụ thuộc, ảnh đại diện) và ảnh đại diện của nhân viên. */
export class ProfileFiles1731900000000 implements MigrationInterface {
  name = 'ProfileFiles1731900000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE employee.profile_file (
        id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id       uuid NOT NULL REFERENCES employee.employee(id),
        section           varchar(40) NOT NULL,
        item_id           uuid REFERENCES employee.profile_item(id),
        storage_key       varchar(200) NOT NULL UNIQUE,
        original_name     varchar(255) NOT NULL,
        content_type      varchar(100) NOT NULL,
        size_bytes        integer NOT NULL CHECK (size_bytes > 0),
        sha256            char(64) NOT NULL,
        status            varchar(20) NOT NULL DEFAULT 'PENDING'
                            CHECK (status IN ('PENDING', 'PENDING_REVIEW', 'READY', 'REJECTED', 'DELETED')),
        uploaded_by       uuid NOT NULL,
        uploaded_by_hr    boolean NOT NULL DEFAULT false,
        change_request_id uuid,
        created_at        timestamptz NOT NULL DEFAULT now(),
        deleted_at        timestamptz
      )`);
    await q.query(`CREATE INDEX ix_profile_file_employee ON employee.profile_file(employee_id, section, status)`);
    // AC-1.10.4: cùng nội dung trong cùng mục của cùng người chỉ lưu một lần.
    await q.query(
      `CREATE UNIQUE INDEX uq_profile_file_ready_sha ON employee.profile_file(employee_id, section, sha256) WHERE status = 'READY'`,
    );
    await q.query(`ALTER TABLE employee.employee ADD COLUMN avatar_file_id uuid REFERENCES employee.profile_file(id)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE employee.employee DROP COLUMN avatar_file_id`);
    await q.query(`DROP TABLE employee.profile_file`);
  }
}
