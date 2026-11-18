import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * UC2 FR-2.6, FR-2.9 (ADR-14): phó đơn vị ở mọi cấp, cờ "Quyền trưởng", danh mục chức danh ngừng dùng được và chức danh hệ thống.
 */
export class OrgUnitRoles1732100000000 implements MigrationInterface {
  name = 'OrgUnitRoles1732100000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE org.department ADD COLUMN head_acting boolean NOT NULL DEFAULT false`);
    // employee_id chỉ là tham chiếu logic sang schema employee (không FK chéo schema, ADR-10).
    await q.query(`CREATE TABLE org.department_deputy (
      department_id uuid NOT NULL REFERENCES org.department(id),
      employee_id   uuid NOT NULL,
      created_by    uuid NULL,
      created_at    timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (department_id, employee_id)
    )`);
    await q.query(`CREATE INDEX ix_department_deputy_employee ON org.department_deputy (employee_id)`);
    await q.query(`CREATE INDEX ix_department_head ON org.department (head_employee_id) WHERE head_employee_id IS NOT NULL`);
    await q.query(`ALTER TABLE org.position
      ADD COLUMN active    boolean NOT NULL DEFAULT true,
      ADD COLUMN is_system boolean NOT NULL DEFAULT false`);
    await q.query(`UPDATE org.position SET is_system = true WHERE code = 'CEO'`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE org.position DROP COLUMN is_system, DROP COLUMN active`);
    await q.query(`DROP INDEX org.ix_department_head`);
    await q.query(`DROP TABLE org.department_deputy`);
    await q.query(`ALTER TABLE org.department DROP COLUMN head_acting`);
  }
}
