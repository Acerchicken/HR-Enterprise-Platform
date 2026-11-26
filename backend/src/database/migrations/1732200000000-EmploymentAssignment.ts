import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * UC2 FR-2.7, FR-2.8: quá trình công tác và điều chuyển có ngày hiệu lực. Chỉ thêm dòng; dòng đã đóng chỉ đổi status, effective_to.
 * employee.employee.department_id, position_id, manager_id vẫn là giá trị hiện tại (danh bạ, quyền duyệt BR-05 không đổi).
 */
export class EmploymentAssignment1732200000000 implements MigrationInterface {
  name = 'EmploymentAssignment1732200000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE employee.employment_assignment (
      id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      employee_id    uuid NOT NULL REFERENCES employee.employee(id),
      department_id  uuid NOT NULL,
      position_id    uuid NOT NULL,
      manager_id     uuid NULL,
      effective_from date NOT NULL,
      effective_to   date NULL,
      reason         varchar(20) NOT NULL CHECK (reason IN ('HIRE', 'TRANSFER', 'PROMOTION', 'MANAGER_CHANGE', 'CORRECTION')),
      note           varchar(500) NULL,
      status         varchar(10) NOT NULL CHECK (status IN ('SCHEDULED', 'ACTIVE', 'CLOSED', 'CANCELLED', 'FAILED')),
      failure_reason varchar(300) NULL,
      parent_id      uuid NULL REFERENCES employee.employment_assignment(id),
      head_changes   jsonb NULL,
      created_by     uuid NULL,
      created_at     timestamptz NOT NULL DEFAULT now(),
      applied_at     timestamptz NULL,
      CHECK (effective_to IS NULL OR effective_to >= effective_from - 1)
    )`);
    await q.query(`CREATE UNIQUE INDEX ux_assignment_active ON employee.employment_assignment (employee_id) WHERE status = 'ACTIVE'`);
    await q.query(`CREATE UNIQUE INDEX ux_assignment_scheduled ON employee.employment_assignment (employee_id) WHERE status = 'SCHEDULED'`);
    await q.query(`CREATE INDEX ix_assignment_due ON employee.employment_assignment (status, effective_from)`);
    await q.query(`CREATE INDEX ix_assignment_employee ON employee.employment_assignment (employee_id, effective_from DESC)`);
    // Dữ liệu đang có: một dòng HIRE cho mỗi người với giá trị hiện tại (người đã nghỉ: CLOSED).
    await q.query(`INSERT INTO employee.employment_assignment
        (employee_id, department_id, position_id, manager_id, effective_from, effective_to, reason, status, applied_at)
      SELECT id, department_id, position_id, manager_id, hire_date,
             CASE WHEN status = 'TERMINATED' THEN GREATEST(hire_date, updated_at::date) END,
             'HIRE', CASE WHEN status = 'TERMINATED' THEN 'CLOSED' ELSE 'ACTIVE' END, now()
        FROM employee.employee`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE employee.employment_assignment`);
  }
}
