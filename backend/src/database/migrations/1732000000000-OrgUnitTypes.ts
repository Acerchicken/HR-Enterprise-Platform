import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ADR-14: cây đơn vị có loại (Công ty, Trung tâm, Phòng, Nhóm) và trạng thái hoạt động (UC2 FR-2.4, FR-2.10).
 * Điền sẵn cho dữ liệu đang có: gốc → COMPANY; đơn vị có con và cha là gốc → CENTER; còn lại → DEPARTMENT.
 */
export class OrgUnitTypes1732000000000 implements MigrationInterface {
  name = 'OrgUnitTypes1732000000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE org.department
      ADD COLUMN unit_type varchar(12) NOT NULL DEFAULT 'DEPARTMENT',
      ADD COLUMN status    varchar(10) NOT NULL DEFAULT 'ACTIVE'`);
    await q.query(`UPDATE org.department SET unit_type = 'COMPANY' WHERE parent_id IS NULL`);
    await q.query(`UPDATE org.department d SET unit_type = 'CENTER'
      WHERE d.parent_id IN (SELECT id FROM org.department WHERE parent_id IS NULL)
        AND EXISTS (SELECT 1 FROM org.department c WHERE c.parent_id = d.id)`);
    await q.query(`ALTER TABLE org.department ALTER COLUMN unit_type DROP DEFAULT`);
    await q.query(`ALTER TABLE org.department
      ADD CONSTRAINT ck_department_unit_type CHECK (unit_type IN ('COMPANY', 'CENTER', 'DEPARTMENT', 'TEAM')),
      ADD CONSTRAINT ck_department_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
      ADD CONSTRAINT ck_department_company_root CHECK ((unit_type = 'COMPANY') = (parent_id IS NULL))`);
    // Chỉ một Công ty (gốc duy nhất của cây, AC-2.4.6, AC-2.4.8).
    await q.query(`CREATE UNIQUE INDEX ux_department_company ON org.department ((1)) WHERE unit_type = 'COMPANY'`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX org.ux_department_company`);
    await q.query(`ALTER TABLE org.department
      DROP CONSTRAINT ck_department_company_root, DROP CONSTRAINT ck_department_status,
      DROP CONSTRAINT ck_department_unit_type, DROP COLUMN status, DROP COLUMN unit_type`);
  }
}
