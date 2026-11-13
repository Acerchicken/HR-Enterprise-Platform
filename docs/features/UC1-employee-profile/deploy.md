# UC1 – Hồ sơ nhân viên: triển khai

> Cách chạy chung, staging, rollback chung: [README](../README.md#môi-trường). File này chỉ ghi phần riêng của UC1.

## 1. Thành phần

| Thành phần | Phần của UC1 |
|---|---|
| API | `backend/src/modules/employee` (hồ sơ, `/me`, mức xem, mã hóa trường nhạy cảm); `modules/identity` (khớp tài khoản đăng nhập với hồ sơ theo email) |
| Web | `/employees/:id`, `/employees/new`, `/employees/:id/edit` (`frontend/src/pages/employee`) |
| Database | Schema `employee` (`employee`, `employee_sensitive`), `iam`; migration `1729900000000-InitSchemas` |
| Dịch vụ ngoài | Identity provider: Keycloak (local), Cognito (staging) |

## 2. Biến môi trường

| Biến | Local | Staging | Thiếu thì sao |
|---|---|---|---|
| `FIELD_ENCRYPTION_KEY` | Khóa dev trong code (`ALLOW_DEV_SECRETS=true`) | Secrets Manager `app_secrets:FIELD_ENCRYPTION_KEY` | Production không khởi động |
| `OIDC_*`, `AUTH_MODE` | Keycloak realm `hr` | Cognito (issuer, JWKS, `cognito:groups`, userInfo) | Không đăng nhập được |
| `DB_*` | `docker-compose.yml` | RDS, mật khẩu trong Secrets Manager | API không khởi động |

## 3. Hạ tầng

| Môi trường | Tài nguyên | File |
|---|---|---|
| Local | PostgreSQL, Keycloak, seed | `docker-compose.yml`, `keycloak/` |
| Staging | RDS, Secrets Manager + KMS (khóa mã hóa trường), Cognito, App Runner | `infra/staging/rds.tf`, `kms_secrets.tf`, `cognito.tf`, `app_runner.tf` |

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

## 6. Rollback và sự cố

- **Khóa mã hóa:** không đổi `FIELD_ENCRYPTION_KEY` khi chưa có quy trình xoay khóa (ADR-08). Đổi khóa thì dữ liệu cũ không
  giải mã được. Rollback image không đụng khóa.
- **Dữ liệu:** rollback image không xóa hồ sơ đã tạo. Không có migration riêng của UC1 sau `InitSchemas`.

## 7. Còn thiếu

- Quy trình xoay `FIELD_ENCRYPTION_KEY` (NFR-5.17) chưa viết.
