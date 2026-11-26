# UC7 – Lịch sử thao tác: triển khai

> Cách chạy chung, staging, rollback chung: [README](../README.md#môi-trường). File này chỉ ghi phần riêng của UC7.
> Quyết định thiết kế: [ADR-09](../../architecture/adr/ADR-09-append-only-audit.md).

## 1. Thành phần

| Thành phần | Phần của UC7 |
|---|---|
| API | `backend/src/modules/audit` (`AuditService.record` gọi trong giao dịch của từng module; `GET /audit-logs`) |
| Web | `frontend/src/pages/AuditPage.tsx`, route `/audit` |
| Database | `audit.audit_log`, chỉ mục `ix_audit_entity`, `ix_audit_actor`, hàm `audit.forbid_change` và trigger `trg_audit_append_only`; migration `InitSchemas`. `ix_audit_at` (BRIN theo `at`, migration `AuditTimeIndex`, D2) |
| Worker, lệnh | `backend/src/worker/identity-sync.ts` (`ACCOUNT_SYNC_FAILED`) và `backend/src/database/grant-admin.ts` (`ROLE_GRANT`) ghi bằng SQL `INSERT` thẳng; tài khoản database của worker cần quyền `INSERT` trên `audit.audit_log` |

## 2. Biến môi trường

Không có biến riêng. `traceId` lấy từ header `X-Trace-Id` (NFR-6.4). IP là `req.ip`: sau proxy (App Runner trên staging) cần `trust proxy` để là IP client. Biến `TRUST_PROXY` (số lớp proxy,
staging đặt 1) bật `trust proxy` từ 25/11 (F5 trong [staging-readiness](../../cloud/staging-readiness.md)).

## 3. Hạ tầng

| Môi trường | Tài nguyên | File |
|---|---|---|
| Local | PostgreSQL | `docker-compose.yml` |
| Staging | RDS; backup tự động giữ audit cùng dữ liệu khác | `infra/staging/rds.tf` |

## 4. Các bước

- Trigger chặn UPDATE, DELETE được tạo cùng migration; không cần bước tay.
- Không chạy lệnh dọn dữ liệu nào lên `audit.audit_log`: trigger sẽ chặn và làm lỗi cả giao dịch.
- **Seed với `--reset` xóa sạch audit**: tắt tạm trigger `trg_audit_no_truncate` (chủ bảng làm được) rồi `TRUNCATE` trong cùng
  giao dịch. Seed không `--reset` thì
  bỏ qua khi đã có nhân viên. Không chạy `--reset` trên staging sau khi đã demo.

## 5. Kiểm tra sau deploy

1. HR xem trường nhạy cảm một hồ sơ, rồi `GET /audit-logs?entity=employee&entityId=…`: có `VIEW_SENSITIVE` mới nhất.
2. Trong psql: `BEGIN; UPDATE audit.audit_log SET action = action WHERE id = (SELECT id FROM audit.audit_log LIMIT 1); ROLLBACK;`
   phải báo lỗi từ trigger (trigger chạy theo từng dòng, nên câu lệnh phải chạm ít nhất một dòng).
3. Nhân viên gọi `GET /audit-logs`: 403.

## 6. Rollback và sự cố

- Rollback image không ảnh hưởng audit. Không revert `InitSchemas` trên môi trường có dữ liệu.
- Bảng audit lớn dần (~1,25 triệu bản ghi mỗi năm, 5 năm ~6,25 triệu): theo dõi dung lượng RDS. Thời gian lưu đã chốt 5 năm
  (BR-13, NFR-6.3); quy trình archive, legal hold làm trước production.

## 7. Còn thiếu

- Audit đăng nhập và cấp, thu hồi vai trò (NFR-5.10) cần lấy event từ Keycloak và Cognito; tuần 13 nếu còn thời gian.
- Chưa có quy trình archive sau 5 năm (BR-13).
- `TRUNCATE` đã bị trigger `trg_audit_no_truncate` chặn (E10), nhưng tài khoản ứng dụng là chủ bảng nên vẫn tắt được trigger.
  Đề xuất: trên staging, tài khoản ứng dụng không phải chủ bảng, không có quyền `TRUNCATE` (NFR-5.14, staging-readiness L3).
