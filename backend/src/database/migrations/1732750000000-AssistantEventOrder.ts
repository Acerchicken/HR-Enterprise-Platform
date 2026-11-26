import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * UC6: thứ tự event tài liệu trong assistant service (review PR #130). Queue không bảo đảm thứ tự (SQS Standard, đẩy lại từ
 * DLQ), nên mỗi tài liệu lưu id outbox (tăng dần) của event gần nhất đã áp dụng, tách hai nhóm trường:
 * - `meta_event_id`: tiêu đề, loại, phạm vi (`DocumentPublished`, `DocumentUpdated`);
 * - `visibility_event_id`: `hidden` (`DocumentPublished`, `DocumentHidden`, `DocumentRestored`).
 * Event có id nhỏ hơn hoặc bằng mốc thì không ghi đè nhóm đó, để event cũ không làm hiện lại tài liệu đã ẩn hay nới lại
 * phạm vi đã thu hẹp.
 *
 * Kèm quyền mặc định: bảng, sequence tạo sau trong schema `assistant` tự cấp cho `assistant_svc`. Chỉ áp dụng cho đối tượng do
 * user đang chạy migration tạo ra; đổi user migration thì chạy lại cho user mới (UC6 deploy.md bước 1).
 */
export class AssistantEventOrder1732750000000 implements MigrationInterface {
  name = 'AssistantEventOrder1732750000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      ALTER TABLE assistant.document
        ADD COLUMN meta_event_id bigint NOT NULL DEFAULT 0,
        ADD COLUMN visibility_event_id bigint NOT NULL DEFAULT 0`);
    await q.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA assistant GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO assistant_svc`);
    await q.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA assistant GRANT USAGE, SELECT ON SEQUENCES TO assistant_svc`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA assistant REVOKE USAGE, SELECT ON SEQUENCES FROM assistant_svc`);
    await q.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA assistant REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM assistant_svc`);
    await q.query(`ALTER TABLE assistant.document DROP COLUMN visibility_event_id, DROP COLUMN meta_event_id`);
  }
}
