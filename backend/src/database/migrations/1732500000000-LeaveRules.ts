import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * UC3, UC4 (spec UC3 13.6): một migration cho cả bảy phần thiết kế vì code cùng một PR.
 * - Loại phép theo cách tính số dư (`quota_kind`), giới hạn theo sự kiện, cấu hình HR duyệt thêm (BR-16), seed loại mới.
 * - Số dư 2 chữ số thập phân, mức nền, nguồn, ghi chú, chuyển phép năm (`carried_in`, BR-01), `version`.
 * - Phân bổ số ngày của đơn theo năm (đơn qua hai năm, AC-3.2.4).
 * - Đơn: ngày sự kiện, người tạo hộ, `PENDING_HR`, đề nghị hủy, mốc nhắc (BR-17).
 * - Lịch sử có `action`; dòng do hệ thống ghi có `actor_id` NULL.
 * - Ngày lễ có loại (lễ, nghỉ bù) và người tạo; phân công duyệt thay (BR-06).
 */
export class LeaveRules1732500000000 implements MigrationInterface {
  name = 'LeaveRules1732500000000';

  async up(q: QueryRunner): Promise<void> {
    // ---------- Loại phép ----------
    await q.query(`ALTER TABLE leave.leave_type
      ADD COLUMN quota_kind varchar(10) NOT NULL DEFAULT 'YEARLY' CHECK (quota_kind IN ('ACCRUED', 'YEARLY', 'PER_EVENT')),
      ADD COLUMN max_days_per_event numeric(5,1) NULL CHECK (max_days_per_event > 0),
      ADD COLUMN max_months_per_event smallint NULL CHECK (max_months_per_event > 0),
      ADD COLUMN requires_event_date boolean NOT NULL DEFAULT false,
      ADD COLUMN requires_document boolean NOT NULL DEFAULT false,
      ADD COLUMN hr_approval varchar(10) NOT NULL DEFAULT 'NEVER' CHECK (hr_approval IN ('NEVER', 'ALWAYS', 'OVER_DAYS')),
      ADD COLUMN hr_approval_min_days numeric(5,1) NULL,
      ADD CONSTRAINT ck_leave_type_hr_min CHECK ((hr_approval = 'OVER_DAYS') = (hr_approval_min_days IS NOT NULL))`);
    await q.query(`INSERT INTO leave.leave_type (code, name, max_days_per_year) VALUES
        ('CHILD_MARRIAGE', 'Con kết hôn', 0), ('BEREAVEMENT', 'Nghỉ tang', 0),
        ('PATERNITY', 'Nghỉ khi vợ sinh con', 0), ('MATERNITY', 'Nghỉ thai sản', 0)
      ON CONFLICT (code) DO NOTHING`);
    await q.query(`UPDATE leave.leave_type SET quota_kind = 'ACCRUED' WHERE code = 'ANNUAL'`);
    await q.query(`UPDATE leave.leave_type SET requires_document = true WHERE code = 'SICK'`);
    await q.query(`UPDATE leave.leave_type SET hr_approval = 'OVER_DAYS', hr_approval_min_days = 3 WHERE code = 'UNPAID'`);
    await q.query(`UPDATE leave.leave_type t SET quota_kind = 'PER_EVENT', requires_event_date = true, requires_document = true,
        max_days_per_event = v.days, max_months_per_event = v.months, hr_approval = v.hr
      FROM (VALUES ('MARRIAGE', 3, NULL, 'NEVER'), ('CHILD_MARRIAGE', 1, NULL, 'NEVER'), ('BEREAVEMENT', 3, NULL, 'NEVER'),
                   ('PATERNITY', 14, NULL, 'NEVER'), ('MATERNITY', NULL, 6, 'ALWAYS')) AS v(code, days, months, hr)
      WHERE t.code = v.code`);
    await q.query(`UPDATE leave.leave_type SET max_days_per_event = NULL WHERE code = 'MATERNITY'`);

    // ---------- Số dư ----------
    await q.query(`DO $$ DECLARE c record; BEGIN
      FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'leave.leave_balance'::regclass AND contype = 'c' LOOP
        EXECUTE format('ALTER TABLE leave.leave_balance DROP CONSTRAINT %I', c.conname);
      END LOOP; END $$`);
    await q.query(`ALTER TABLE leave.leave_balance
      ALTER COLUMN entitled TYPE numeric(5,2), ALTER COLUMN used TYPE numeric(5,2), ALTER COLUMN pending TYPE numeric(5,2),
      ADD COLUMN carried_in numeric(5,2) NOT NULL DEFAULT 0,
      ADD COLUMN base_days numeric(5,2) NULL CHECK (base_days IN (12, 14, 16)),
      ADD COLUMN source varchar(8) NOT NULL DEFAULT 'AUTO' CHECK (source IN ('AUTO', 'DEFAULT', 'MANUAL')),
      ADD COLUMN note varchar(200) NULL,
      ADD COLUMN version integer NOT NULL DEFAULT 1,
      ADD COLUMN updated_by uuid NULL,
      ADD COLUMN updated_at timestamptz NULL,
      ADD CONSTRAINT ck_leave_balance_amounts CHECK (used >= 0 AND pending >= 0 AND carried_in >= 0 AND entitled >= 0
        AND used + pending <= entitled + carried_in)`);
    await q.query(`UPDATE leave.leave_balance b SET source = 'DEFAULT' FROM leave.leave_type t
      WHERE t.id = b.leave_type_id AND t.quota_kind = 'YEARLY'`);

    // ---------- Phân bổ đơn theo năm ----------
    await q.query(`CREATE TABLE leave.leave_request_allocation (
      request_id uuid NOT NULL REFERENCES leave.leave_request(id) ON DELETE CASCADE,
      year       smallint NOT NULL,
      days       numeric(5,1) NOT NULL CHECK (days > 0),
      PRIMARY KEY (request_id, year))`);

    // ---------- Đơn ----------
    await q.query(`DO $$ DECLARE c record; BEGIN
      FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'leave.leave_request'::regclass AND contype = 'c'
                 AND pg_get_constraintdef(oid) LIKE '%status%' LOOP
        EXECUTE format('ALTER TABLE leave.leave_request DROP CONSTRAINT %I', c.conname);
      END LOOP; END $$`);
    await q.query(`ALTER TABLE leave.leave_request
      ADD CONSTRAINT ck_leave_request_status CHECK (status IN ('SUBMITTED','PENDING_HR','APPROVED','REJECTED','COMPLETED','CANCELLED')),
      ADD COLUMN event_date date NULL,
      ADD COLUMN created_by uuid NULL,
      ADD COLUMN requires_hr_approval boolean NOT NULL DEFAULT false,
      ADD COLUMN stage_entered_at timestamptz NOT NULL DEFAULT now(),
      ADD COLUMN cancel_requested_at timestamptz NULL,
      ADD COLUMN cancel_requested_by uuid NULL,
      ADD COLUMN reminded_at timestamptz NULL`);
    await q.query(`UPDATE leave.leave_request SET created_by = employee_id, stage_entered_at = updated_at`);
    await q.query(`ALTER TABLE leave.leave_request ALTER COLUMN created_by SET NOT NULL`);
    await q.query(`CREATE UNIQUE INDEX ux_leave_request_event ON leave.leave_request (employee_id, leave_type_id, event_date)
      WHERE event_date IS NOT NULL AND status IN ('SUBMITTED','PENDING_HR','APPROVED','COMPLETED')`);
    await q.query(`CREATE INDEX ix_leave_request_stage ON leave.leave_request (status, stage_entered_at) WHERE reminded_at IS NULL`);
    await q.query(`CREATE INDEX ix_leave_request_dates ON leave.leave_request (start_date, end_date)`);

    // Đơn cũ của loại có số dư: một dòng phân bổ theo năm của ngày bắt đầu (code cũ chặn đơn qua năm).
    await q.query(`INSERT INTO leave.leave_request_allocation (request_id, year, days)
      SELECT r.id, extract(year FROM r.start_date)::smallint, r.days FROM leave.leave_request r
        JOIN leave.leave_type t ON t.id = r.leave_type_id WHERE t.quota_kind <> 'PER_EVENT'`);
    // Số dư của loại theo sự kiện không còn dùng; dòng đã có số liệu giữ lại để không mất lịch sử.
    await q.query(`DELETE FROM leave.leave_balance b USING leave.leave_type t
      WHERE t.id = b.leave_type_id AND t.quota_kind = 'PER_EVENT' AND b.used = 0 AND b.pending = 0`);

    // ---------- Lịch sử ----------
    await q.query(`ALTER TABLE leave.leave_request_history ADD COLUMN action varchar(30) NULL, ALTER COLUMN actor_id DROP NOT NULL`);
    await q.query(`UPDATE leave.leave_request_history SET action = CASE to_status
        WHEN 'SUBMITTED' THEN 'SUBMIT' WHEN 'APPROVED' THEN 'APPROVE' WHEN 'REJECTED' THEN 'REJECT'
        WHEN 'CANCELLED' THEN 'CANCEL' WHEN 'COMPLETED' THEN 'COMPLETE' ELSE 'SUBMIT' END`);
    await q.query(`ALTER TABLE leave.leave_request_history ALTER COLUMN action SET NOT NULL,
      ALTER COLUMN to_status DROP NOT NULL,
      ADD CONSTRAINT ck_leave_history_action CHECK (action IN ('SUBMIT','APPROVE','MANAGER_APPROVE','HR_APPROVE','REJECT','HR_REJECT',
        'CANCEL','CANCEL_REQUEST','CANCEL_APPROVE','CANCEL_REQUEST_REJECT','COMPLETE','RECALCULATE','SYSTEM_CANCEL'))`);

    // ---------- Ngày lễ ----------
    await q.query(`ALTER TABLE leave.holiday
      ADD COLUMN kind varchar(12) NOT NULL DEFAULT 'HOLIDAY' CHECK (kind IN ('HOLIDAY', 'COMPENSATORY')),
      ADD COLUMN created_by uuid NULL,
      ADD COLUMN created_at timestamptz NOT NULL DEFAULT now()`);
    await q.query(`UPDATE leave.holiday SET kind = 'COMPENSATORY' WHERE name ILIKE 'Nghỉ bù%'`);

    // ---------- Người duyệt thay (BR-06) ----------
    await q.query(`CREATE TABLE leave.approval_delegation (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      manager_id  uuid NOT NULL,
      delegate_id uuid NOT NULL,
      start_date  date NOT NULL,
      end_date    date NOT NULL,
      created_by  uuid NOT NULL,
      created_at  timestamptz NOT NULL DEFAULT now(),
      ended_at    timestamptz NULL,
      ended_by    uuid NULL,
      CHECK (delegate_id <> manager_id),
      CHECK (end_date >= start_date))`);
    await q.query(`CREATE INDEX ix_delegation_manager ON leave.approval_delegation (manager_id, start_date, end_date)`);
    await q.query(`CREATE INDEX ix_delegation_delegate ON leave.approval_delegation (delegate_id, start_date, end_date)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE leave.approval_delegation`);
    await q.query(`ALTER TABLE leave.holiday DROP COLUMN created_at, DROP COLUMN created_by, DROP COLUMN kind`);
    await q.query(`DELETE FROM leave.leave_request_history WHERE to_status IS NULL OR actor_id IS NULL`);
    await q.query(`ALTER TABLE leave.leave_request_history DROP CONSTRAINT ck_leave_history_action, DROP COLUMN action,
      ALTER COLUMN to_status SET NOT NULL, ALTER COLUMN actor_id SET NOT NULL`);
    await q.query(`DROP TABLE leave.leave_request_allocation`);
    await q.query(`UPDATE leave.leave_request SET status = 'SUBMITTED' WHERE status = 'PENDING_HR'`);
    await q.query(`DROP INDEX leave.ix_leave_request_dates`);
    await q.query(`DROP INDEX leave.ix_leave_request_stage`);
    await q.query(`DROP INDEX leave.ux_leave_request_event`);
    await q.query(`ALTER TABLE leave.leave_request DROP CONSTRAINT ck_leave_request_status,
      DROP COLUMN reminded_at, DROP COLUMN cancel_requested_by, DROP COLUMN cancel_requested_at, DROP COLUMN stage_entered_at,
      DROP COLUMN requires_hr_approval, DROP COLUMN created_by, DROP COLUMN event_date,
      ADD CONSTRAINT leave_request_status_check CHECK (status IN ('SUBMITTED','APPROVED','REJECTED','COMPLETED','CANCELLED'))`);
    await q.query(`ALTER TABLE leave.leave_balance DROP CONSTRAINT ck_leave_balance_amounts,
      DROP COLUMN updated_at, DROP COLUMN updated_by, DROP COLUMN version, DROP COLUMN note, DROP COLUMN source,
      DROP COLUMN base_days, DROP COLUMN carried_in,
      ALTER COLUMN entitled TYPE numeric(5,1), ALTER COLUMN used TYPE numeric(5,1), ALTER COLUMN pending TYPE numeric(5,1),
      ADD CONSTRAINT leave_balance_check CHECK (used >= 0 AND pending >= 0 AND used + pending <= entitled)`);
    await q.query(`ALTER TABLE leave.leave_type DROP CONSTRAINT ck_leave_type_hr_min, DROP COLUMN hr_approval_min_days,
      DROP COLUMN hr_approval, DROP COLUMN requires_document, DROP COLUMN requires_event_date, DROP COLUMN max_months_per_event,
      DROP COLUMN max_days_per_event, DROP COLUMN quota_kind`);
  }
}
