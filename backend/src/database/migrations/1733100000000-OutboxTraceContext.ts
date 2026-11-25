import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ADR-15 bước 4 (truy vết phân tán): `leave.outbox.trace_context` giữ W3C `traceparent` của request đã tạo event
 * (`00-<trace id 32 hex>-<span id 16 hex>-<cờ>`, 55 ký tự), để publisher nối span gửi đi vào cùng trace. NULL khi chưa bật tracing.
 */
export class OutboxTraceContext1733100000000 implements MigrationInterface {
  name = 'OutboxTraceContext1733100000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE leave.outbox ADD COLUMN trace_context varchar(64)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE leave.outbox DROP COLUMN trace_context`);
  }
}
