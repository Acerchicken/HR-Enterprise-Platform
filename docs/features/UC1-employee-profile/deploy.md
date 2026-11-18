# UC1 – Hồ sơ nhân viên: triển khai

> Cách chạy chung, staging, rollback chung: [README](../README.md#môi-trường). File này chỉ ghi phần riêng của UC1.

## 1. Thành phần

| Thành phần | Phần của UC1 |
|---|---|
| API | `backend/src/modules/employee` (hồ sơ theo mục, yêu cầu cập nhật, file, thông tin tự tính, mã hóa trường nhạy cảm); `modules/identity` (khớp tài khoản theo email, chặn hồ sơ `TERMINATED`); `common/rate-limit`, `common/security-headers.middleware.ts`; worker gửi email hồ sơ |
| Web | Popup hồ sơ `/me/profile`, `/employees/:id[/:section]` (`frontend/src/profile`), trang chủ, nav bar, `/approvals?type=profile`, `/contracts/expiring`, form HR `/employees/new`, `/employees/:id/edit` |
| Database | Schema `employee` (`employee`, `employee_sensitive`, `profile_item`, `profile_change_request`, `profile_file`), `iam` (`rate_limit_counter`); migration `InitSchemas`, `RateLimitCounter`, `ProfileChangeRequests`, `ProfileFiles` ([database schema](../../architecture/database-schema.md)) |
| Dịch vụ ngoài | Identity provider: Keycloak (local), Cognito (staging); object storage cho file hồ sơ: MinIO (local), S3 (staging); email qua worker (đổi tài khoản ngân hàng) |

## 2. Biến môi trường

| Biến | Local | Staging | Thiếu thì sao |
|---|---|---|---|
| `FIELD_ENCRYPTION_KEY` | Khóa dev trong code (`ALLOW_DEV_SECRETS=true`) | Secrets Manager `app_secrets:FIELD_ENCRYPTION_KEY` | Production không khởi động |
| `OIDC_*`, `AUTH_MODE` | Keycloak realm `hr` | Cognito (issuer, JWKS, `cognito:groups`, userInfo) | Không đăng nhập được |
| `DB_*` | `docker-compose.yml` | RDS, mật khẩu trong Secrets Manager | API không khởi động |
| `PROFILE_STORAGE_BUCKET` | Bucket MinIO `hr-profile-files-local` | `hr-profile-files-staging` (Terraform) | Thao tác file trả 503; phần còn lại chạy (AC-1.10.9) |
| `RATE_LIMIT_ENABLED`, `RATE_LIMIT_OVERRIDES` | Mặc định trong code (spec mục 7) | Như local; `RATE_LIMIT_OVERRIDES` khi load test | Dùng mặc định |

## 3. Hạ tầng

| Môi trường | Tài nguyên | File |
|---|---|---|
| Local | PostgreSQL, Keycloak, seed | `docker-compose.yml`, `keycloak/` |
| Staging | RDS, Secrets Manager + KMS (khóa mã hóa trường), Cognito, App Runner | `infra/staging/rds.tf`, `kms_secrets.tf`, `cognito.tf`, `app_runner.tf` |
| Staging *(TV3, chưa apply)* | Bucket `hr-profile-files-staging`: chặn public, SSE-KMS, CORS chỉ cho domain web (PUT), lifecycle xóa object tag `deleted=true` sau 30 ngày; quyền `s3:PutObject`, `GetObject`, `DeleteObject`, `PutObjectTagging` cho role App Runner; alarm CloudWatch khi số 429 tăng đột biến | TV3, `infra/profile-files` |

## 4. Các bước

- **Local:** `docker compose up -d --build`; seed tạo ~2.000 hồ sơ và 4 tài khoản mẫu.
- **Staging lần đầu:** chạy Deploy Staging với `run_seed = true` để có dữ liệu mẫu. Tạo người dùng Cognito với email trùng
  `workEmail` của hồ sơ, gán nhóm `hr`, `admin` nếu cần.
- **Thêm trường nhạy cảm mới:** thêm migration, thêm vào danh sách mã hóa và danh sách che trong audit trong cùng PR.

## 5. Kiểm tra sau deploy

1. Đăng nhập bằng tài khoản nhân viên, mở hồ sơ của mình: thấy mức cá nhân, không có CCCD, lương.
2. Đăng nhập HR, mở một hồ sơ kèm trường nhạy cảm: giá trị đã giải mã đúng; `GET /audit-logs?entity=employee&entityId=…`
   có `VIEW_SENSITIVE`.
3. HR tạo một nhân viên thử, rồi sửa số điện thoại: lưu được, `version` tăng.
4. Nhân viên gửi yêu cầu thêm liên hệ khẩn cấp; HR mở "Việc cần duyệt" tab Sửa hồ sơ, duyệt; nhân viên nhận email (Mailpit
   local, SES staging).
5. Nhân viên tải một CV thử, gửi yêu cầu; HR duyệt, tải xuống; HR xóa: object có tag `deleted=true`.
6. Gọi 21 lần tìm kiếm trong một phút bằng một tài khoản: lần 21 trả 429 kèm `Retry-After`.

## 6. Rollback và sự cố

- **Khóa mã hóa:** không đổi `FIELD_ENCRYPTION_KEY` khi chưa có quy trình xoay khóa (ADR-08). Đổi khóa thì dữ liệu cũ không
  giải mã được. Rollback image không đụng khóa.
- **Dữ liệu:** rollback image không xóa hồ sơ đã tạo. Rollback qua migration `ProfileFiles`, `ProfileChangeRequests` sẽ xóa
  bảng mục, yêu cầu, file: chỉ làm khi chưa có dữ liệu thật; nếu đã có thì giữ schema, rollback image thôi.
- **Bucket hồ sơ lỗi:** API trả 503 cho thao tác file, phần còn lại chạy; không cần rollback.

## 7. Còn thiếu

- Quy trình xoay `FIELD_ENCRYPTION_KEY` (NFR-5.17) chưa viết.
- Bucket file hồ sơ trên staging, CORS PUT từ domain web, alarm 429 từ log `rate_limit_abuse` (TV3).
