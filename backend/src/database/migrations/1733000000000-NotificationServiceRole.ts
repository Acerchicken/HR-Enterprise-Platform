import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ADR-15 bước 1: notification service (`services/notification`) kết nối bằng user riêng `notification_svc`, chỉ có quyền trên
 * schema `notification` (bảng chống trùng `processed_event`). Truy vấn schema khác (employee, iam, leave...) bị PostgreSQL từ chối.
 * Role tạo ở dạng NOLOGIN như `assistant_svc`; staging đặt mật khẩu ngoài migration:
 *   ALTER ROLE notification_svc LOGIN PASSWORD '<từ Secrets Manager>';
 */
export class NotificationServiceRole1733000000000 implements MigrationInterface {
  name = 'NotificationServiceRole1733000000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'notification_svc') THEN
          CREATE ROLE notification_svc NOLOGIN;
        END IF;
      END $$`);
    await q.query(`GRANT USAGE ON SCHEMA notification TO notification_svc`);
    await q.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA notification TO notification_svc`);
    // Bảng thêm sau này trong schema `notification` cũng cấp quyền luôn (như `assistant_svc`).
    await q.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA notification GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO notification_svc`);
    // Gộp email cho HR (AC-1.9.13) tìm bản ghi gần nhất theo loại.
    await q.query(`CREATE INDEX IF NOT EXISTS ix_processed_event_type_at ON notification.processed_event (event_type, processed_at)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS notification.ix_processed_event_type_at`);
    await q.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA notification REVOKE ALL ON TABLES FROM notification_svc`);
    await q.query(`REVOKE ALL ON ALL TABLES IN SCHEMA notification FROM notification_svc`);
    await q.query(`REVOKE USAGE ON SCHEMA notification FROM notification_svc`);
    // Giữ role: có thể đang có phiên đăng nhập; xóa tay nếu cần.
  }
}
