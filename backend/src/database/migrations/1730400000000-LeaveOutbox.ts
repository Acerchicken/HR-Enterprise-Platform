import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tuần 8 – outbox cho thông báo nghỉ phép:
 * - leave.outbox: event ghi cùng transaction với thao tác nghiệp vụ; publisher đọc và đẩy lên RabbitMQ.
 * - notification.processed_event: worker ghi event đã xử lý để bỏ qua bản trùng (RabbitMQ giao ít nhất một lần).
 */
export class LeaveOutbox1730400000000 implements MigrationInterface {
  name = 'LeaveOutbox1730400000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE leave.outbox (
        id           bigserial PRIMARY KEY,
        event_type   varchar(50) NOT NULL,
        aggregate_id uuid NOT NULL,
        payload      jsonb NOT NULL,
        created_at   timestamptz NOT NULL DEFAULT now(),
        published_at timestamptz,
        attempts     integer NOT NULL DEFAULT 0,
        last_error   varchar(500)
      )`);
    await q.query(`CREATE INDEX ix_leave_outbox_unpublished ON leave.outbox(id) WHERE published_at IS NULL`);

    await q.query(`CREATE SCHEMA IF NOT EXISTS notification`);
    await q.query(`
      CREATE TABLE notification.processed_event (
        event_id     varchar(100) PRIMARY KEY,
        event_type   varchar(50) NOT NULL,
        processed_at timestamptz NOT NULL DEFAULT now()
      )`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE notification.processed_event`);
    await q.query(`DROP SCHEMA notification`);
    await q.query(`DROP TABLE leave.outbox`);
  }
}
