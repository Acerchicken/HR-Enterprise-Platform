import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * UC7 D2 (chốt 23/11/2026), NFR-2.4: tra cứu audit chỉ theo khoảng thời gian. Hai chỉ mục cũ bắt đầu bằng `entity_type`,
 * `actor_id` nên không dùng được. BRIN nhỏ (vài trang) và hợp bảng chỉ thêm theo thời gian.
 */
export class AuditTimeIndex1732600000000 implements MigrationInterface {
  name = 'AuditTimeIndex1732600000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE INDEX ix_audit_at ON audit.audit_log USING brin (at)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX audit.ix_audit_at`);
  }
}
