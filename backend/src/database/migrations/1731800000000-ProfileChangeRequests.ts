import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * UC1 FR-1.9, spec 13.1: các dòng của mục hồ sơ (một bảng chung cho mọi mục) và yêu cầu cập nhật hồ sơ do nhân viên gửi,
 * HR duyệt. Bảng file hồ sơ (`profile_file`) thêm ở nhánh `feat/profile-files`.
 */
export class ProfileChangeRequests1731800000000 implements MigrationInterface {
  name = 'ProfileChangeRequests1731800000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE employee.profile_item (
        id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id       uuid NOT NULL REFERENCES employee.employee(id),
        section           varchar(40) NOT NULL,
        data              jsonb NOT NULL DEFAULT '{}',
        sensitive_data    text,
        created_by        uuid,
        updated_by        uuid,
        change_request_id uuid,
        version           integer NOT NULL DEFAULT 1,
        created_at        timestamptz NOT NULL DEFAULT now(),
        updated_at        timestamptz NOT NULL DEFAULT now(),
        deleted_at        timestamptz
      )`);
    await q.query(
      `CREATE INDEX ix_profile_item_section ON employee.profile_item(employee_id, section) WHERE deleted_at IS NULL`,
    );

    await q.query(`
      CREATE TABLE employee.profile_change_request (
        id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id        uuid NOT NULL REFERENCES employee.employee(id),
        section            varchar(40) NOT NULL,
        action             varchar(10) NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE')),
        item_id            uuid REFERENCES employee.profile_item(id),
        base_version       integer,
        proposed           jsonb NOT NULL DEFAULT '{}',
        proposed_sensitive text,
        file_ids           uuid[] NOT NULL DEFAULT '{}',
        status             varchar(10) NOT NULL DEFAULT 'PENDING'
                             CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
        submitted_by       uuid NOT NULL,
        submitted_at       timestamptz NOT NULL DEFAULT now(),
        reviewed_by        uuid,
        reviewed_at        timestamptz,
        reject_reason      varchar(500),
        acknowledged_at    timestamptz,
        idempotency_key    varchar(100) NOT NULL,
        CONSTRAINT uq_profile_change_idempotency UNIQUE (submitted_by, idempotency_key)
      )`);
    // AC-1.9.7: mỗi trường hoặc dòng chỉ có một yêu cầu đang chờ. Thêm dòng mới (item_id NULL, action CREATE) không giới hạn ở đây.
    await q.query(
      `CREATE UNIQUE INDEX uq_profile_change_pending_place ON employee.profile_change_request
         (employee_id, section, item_id) WHERE status = 'PENDING' AND item_id IS NOT NULL`,
    );
    await q.query(
      `CREATE UNIQUE INDEX uq_profile_change_pending_main ON employee.profile_change_request
         (employee_id, section) WHERE status = 'PENDING' AND item_id IS NULL AND action = 'UPDATE'`,
    );
    await q.query(`CREATE INDEX ix_profile_change_status ON employee.profile_change_request(status, submitted_at)`);
    await q.query(`CREATE INDEX ix_profile_change_employee ON employee.profile_change_request(employee_id, status)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE employee.profile_change_request`);
    await q.query(`DROP TABLE employee.profile_item`);
  }
}
