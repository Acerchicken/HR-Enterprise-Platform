import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration đầu tiên: mỗi module một schema (ADR-01, data ownership tuần 6).
 * Không tạo foreign key chéo schema để sau này tách module thành service được.
 */
export class InitSchemas1729900000000 implements MigrationInterface {
  name = 'InitSchemas1729900000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await q.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    for (const s of ['iam', 'org', 'employee', 'leave', 'audit']) {
      await q.query(`CREATE SCHEMA IF NOT EXISTS ${s}`);
    }

    // ---------- Organization ----------
    await q.query(`
      CREATE TABLE org.department (
        id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code             varchar(20)  NOT NULL UNIQUE,
        name             varchar(150) NOT NULL,
        office           varchar(50)  NOT NULL,
        parent_id        uuid REFERENCES org.department(id),
        head_employee_id uuid,
        created_at       timestamptz NOT NULL DEFAULT now(),
        updated_at       timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX ix_department_parent ON org.department(parent_id)`);
    await q.query(`
      CREATE TABLE org.position (
        id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code  varchar(20)  NOT NULL UNIQUE,
        title varchar(100) NOT NULL,
        level smallint     NOT NULL CHECK (level BETWEEN 1 AND 10)
      )`);

    // ---------- Employee ----------
    await q.query(`
      CREATE TABLE employee.employee (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_code varchar(20)  NOT NULL UNIQUE,
        full_name     varchar(150) NOT NULL,
        work_email    varchar(150) NOT NULL UNIQUE,
        phone         varchar(20),
        date_of_birth date,
        address       varchar(255),
        department_id uuid NOT NULL,
        position_id   uuid NOT NULL,
        manager_id    uuid REFERENCES employee.employee(id),
        hire_date     date NOT NULL,
        status        varchar(20) NOT NULL DEFAULT 'ACTIVE'
                      CHECK (status IN ('ACTIVE','ON_LEAVE','TERMINATED')),
        version       integer NOT NULL DEFAULT 1,
        created_at    timestamptz NOT NULL DEFAULT now(),
        updated_at    timestamptz NOT NULL DEFAULT now(),
        CHECK (manager_id IS NULL OR manager_id <> id)
      )`);
    await q.query(`CREATE INDEX ix_employee_department ON employee.employee(department_id)`);
    await q.query(`CREATE INDEX ix_employee_manager ON employee.employee(manager_id)`);
    // Tìm danh bạ theo tên/email/mã (ILIKE '%từ khóa%') dùng index trigram.
    await q.query(
      `CREATE INDEX ix_employee_search ON employee.employee
         USING gin ((lower(full_name || ' ' || work_email || ' ' || employee_code)) gin_trgm_ops)`,
    );
    await q.query(`
      CREATE TABLE employee.employee_sensitive (
        employee_id      uuid PRIMARY KEY REFERENCES employee.employee(id) ON DELETE CASCADE,
        national_id_enc  text,
        bank_account_enc text,
        salary_enc       text,
        updated_at       timestamptz NOT NULL DEFAULT now()
      )`);

    // ---------- Identity & Access ----------
    await q.query(`
      CREATE TABLE iam.user_account (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        subject       varchar(255) UNIQUE,
        email         varchar(150) NOT NULL UNIQUE,
        employee_id   uuid,
        last_login_at timestamptz,
        created_at    timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`
      CREATE TABLE iam.role_assignment (
        user_id             uuid NOT NULL REFERENCES iam.user_account(id) ON DELETE CASCADE,
        role                varchar(20) NOT NULL CHECK (role IN ('EMPLOYEE','MANAGER','HR','ADMIN')),
        scope_department_id uuid,
        PRIMARY KEY (user_id, role)
      )`);

    // ---------- Leave (model cho tuần 8) ----------
    await q.query(`
      CREATE TABLE leave.leave_type (
        id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code              varchar(20)  NOT NULL UNIQUE,
        name              varchar(100) NOT NULL,
        max_days_per_year numeric(5,1) NOT NULL CHECK (max_days_per_year >= 0)
      )`);
    await q.query(`
      CREATE TABLE leave.leave_balance (
        employee_id   uuid NOT NULL,
        leave_type_id uuid NOT NULL REFERENCES leave.leave_type(id),
        year          smallint NOT NULL,
        entitled      numeric(5,1) NOT NULL DEFAULT 0,
        used          numeric(5,1) NOT NULL DEFAULT 0,
        pending       numeric(5,1) NOT NULL DEFAULT 0,
        PRIMARY KEY (employee_id, leave_type_id, year),
        CHECK (used >= 0 AND pending >= 0 AND used + pending <= entitled)
      )`);
    await q.query(`
      CREATE TABLE leave.leave_request (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id     uuid NOT NULL,
        leave_type_id   uuid NOT NULL REFERENCES leave.leave_type(id),
        start_date      date NOT NULL,
        end_date        date NOT NULL,
        days            numeric(5,1) NOT NULL CHECK (days > 0),
        reason          varchar(500),
        status          varchar(20) NOT NULL
                        CHECK (status IN ('SUBMITTED','APPROVED','REJECTED','COMPLETED','CANCELLED')),
        approver_id     uuid NOT NULL,
        version         integer NOT NULL DEFAULT 1,
        idempotency_key varchar(100) NOT NULL,
        created_at      timestamptz NOT NULL DEFAULT now(),
        updated_at      timestamptz NOT NULL DEFAULT now(),
        CHECK (end_date >= start_date),
        UNIQUE (employee_id, idempotency_key)
      )`);
    await q.query(`CREATE INDEX ix_leave_request_employee ON leave.leave_request(employee_id, status)`);
    await q.query(`CREATE INDEX ix_leave_request_approver ON leave.leave_request(approver_id, status)`);
    await q.query(`
      CREATE TABLE leave.leave_request_history (
        id          bigserial PRIMARY KEY,
        request_id  uuid NOT NULL REFERENCES leave.leave_request(id),
        from_status varchar(20),
        to_status   varchar(20) NOT NULL,
        actor_id    uuid NOT NULL,
        comment     varchar(500),
        at          timestamptz NOT NULL DEFAULT now()
      )`);

    // ---------- Audit (append-only) ----------
    await q.query(`
      CREATE TABLE audit.audit_log (
        id             bigserial PRIMARY KEY,
        actor_id       uuid,
        action         varchar(50) NOT NULL,
        entity_type    varchar(50) NOT NULL,
        entity_id      varchar(64) NOT NULL,
        changed_fields jsonb,
        ip             varchar(64),
        trace_id       varchar(64),
        at             timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX ix_audit_entity ON audit.audit_log(entity_type, entity_id, at)`);
    await q.query(`CREATE INDEX ix_audit_actor ON audit.audit_log(actor_id, at)`);
    // Chặn UPDATE/DELETE ngay ở database: kể cả code lỗi cũng không sửa được log.
    await q.query(`
      CREATE FUNCTION audit.forbid_change() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'audit_log là append-only';
      END $$`);
    await q.query(`
      CREATE TRIGGER trg_audit_append_only BEFORE UPDATE OR DELETE ON audit.audit_log
      FOR EACH ROW EXECUTE FUNCTION audit.forbid_change()`);
  }

  public async down(q: QueryRunner): Promise<void> {
    for (const s of ['audit', 'leave', 'iam', 'employee', 'org']) {
      await q.query(`DROP SCHEMA IF EXISTS ${s} CASCADE`);
    }
  }
}
