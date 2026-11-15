import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bộ đếm giới hạn tần suất theo ngày (NFR-5.21, UC1 FR-1.14, spec 13.4): đếm trong PostgreSQL để đúng khi chạy nhiều
 * instance. Giới hạn theo phút, giờ đếm trong bộ nhớ, không dùng bảng này.
 */
export class RateLimitCounter1731700000000 implements MigrationInterface {
  name = 'RateLimitCounter1731700000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE iam.rate_limit_counter (
        key          varchar(200) NOT NULL,
        window_start timestamptz  NOT NULL,
        count        integer      NOT NULL DEFAULT 0,
        PRIMARY KEY (key, window_start)
      )`);
    await q.query(`CREATE INDEX ix_rate_limit_counter_window ON iam.rate_limit_counter(window_start)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE iam.rate_limit_counter`);
  }
}
