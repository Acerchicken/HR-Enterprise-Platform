# UC8 – Đăng nhập và tài khoản: triển khai

> Cách chạy chung, staging, rollback chung: [README](../README.md#môi-trường). File này chỉ ghi phần riêng của UC8.
> Quyết định: [ADR-17](../../architecture/adr/ADR-17-authentication.md).

## 1. Thành phần

| Thành phần | Phần của UC8 |
|---|---|
| API (`backend/src/modules/identity`) | `TokenVerifier`, `IdentityService` (đã có); `idp-admin/` driver Keycloak, Cognito (đề xuất) |
| Worker | Consumer `identity-sync` (đề xuất) |
| Web (`frontend/src/auth`, route `/callback`) | Đăng nhập, đăng xuất, tự gia hạn (đã có); tự đăng xuất khi không thao tác (đề xuất) |
| Database | `iam.user_account` (đã có); cột `idp_status`, `idp_synced_at`, `idp_last_error` (migration đề xuất) |
| Dịch vụ ngoài | Keycloak (local), Cognito + Managed Login (staging), Mailpit (local), SES (staging), Lambda Post-authentication (staging) |

## 2. Biến môi trường

Đầy đủ ở [`configuration.md`](../../development/configuration.md). Biến mới đề xuất đánh dấu *(mới)*.

| Biến | Local | Staging | Thiếu thì sao |
|---|---|---|---|
| `AUTH_MODE` | `oidc` (hoặc `dev`) | `oidc` | Mặc định `oidc` |
| `VITE_OIDC_AUTHORITY`, `VITE_OIDC_CLIENT_ID` | `http://localhost:8080/realms/hr`, `hr-web` | Issuer của user pool, ID app client | Web không đăng nhập được |
| `VITE_OIDC_LOGOUT_URL` | Trống | `https://<domain>.auth.ap-southeast-1.amazoncognito.com/logout` | Đăng xuất không kết thúc phiên Cognito |
| `VITE_IDLE_TIMEOUT_MINUTES` *(mới)* | `30` | `30` | Mặc định 30 |
| `IDP_ADMIN_DRIVER` *(mới)* | `keycloak` | `cognito` | `none`: không tạo, khóa tài khoản tự động |
| `KEYCLOAK_ADMIN_CLIENT_ID`, `KEYCLOAK_ADMIN_CLIENT_SECRET` *(mới)* | `hr-api-admin`, secret trong `.env` | – | Driver keycloak không khởi động |
| `COGNITO_USER_POOL_ID` *(mới)* | – | Output Terraform | Driver cognito không khởi động |
| `IDENTITY_SYNC_QUEUE` *(mới)* | `identity-sync` (RabbitMQ) | URL SQS `identity-sync` | Consumer không chạy |

## 3. Hạ tầng

| Môi trường | Tài nguyên | File |
|---|---|---|
| Local | Realm `hr`: `passwordPolicy`, `failureFactor: 5`, `resetPasswordAllowed: true`, `ssoSessionMaxLifespan: 36000`, Conditional OTP cho role `hr`, `admin`, SMTP Mailpit, client `hr-api-admin`, event `LOGIN`, `LOGIN_ERROR` | `keycloak/realm-hr.json` |
| Local | Queue `identity-sync` | `docker-compose.yml` (RabbitMQ) |
| Staging | User pool: `user_pool_tier = "ESSENTIALS"`, `allow_admin_create_user_only = true`, `require_uppercase = true`, `mfa_configuration = "ON"` + `software_token_mfa_configuration`, `account_recovery_setting` (`verified_email`), `email_configuration` qua SES, `temporary_password_validity_days = 7` | `infra/staging/cognito.tf` |
| Staging | App client: `callback_urls` thêm `/callback` (localhost và CloudFront), `explicit_auth_flows = ["ALLOW_REFRESH_TOKEN_AUTH"]`, token 15 phút / refresh 10 giờ (`token_validity_units`) | `infra/staging/cognito.tf` |
| Staging | Managed Login (domain `managed_login_version = 2`, branding logo HRHelper) | `infra/staging/cognito.tf` |
| Staging | SQS `identity-sync` + DLQ (5 lần), subscription SNS `hr-events` lọc `employee.created`, `employee.terminated`, `employee.reinstated`, `account.invite_requested` | `infra/staging/sqs_worker.tf` |
| Staging | IAM worker: `cognito-idp:AdminCreateUser`, `AdminAddUserToGroup`, `AdminDisableUser`, `AdminEnableUser`, `AdminUserGlobalSignOut`, `AdminGetUser` trên ARN user pool | `infra/staging/sqs_worker.tf` |
| Staging | Lambda Post-authentication → SNS `hr-events` (nhánh `infra/idp-auth-events`) | đề xuất `infra/staging/cognito_triggers.tf` |

## 4. Các bước

- **Local:** `docker compose up -d --build` import lại realm. Realm đã có thì xóa volume Keycloak hoặc import bằng tay, vì Keycloak
  không ghi đè realm đã tồn tại. Đăng nhập `hr@hr.local` lần đầu sẽ phải quét mã QR TOTP; mở Mailpit (8025) để xem thư mời và thư
  đặt lại mật khẩu.
- **Staging:** SES phải xác minh địa chỉ gửi trước khi `apply` (SES sandbox chỉ gửi tới địa chỉ đã xác minh: xác minh luôn email
  của các thành viên dùng để demo). Mật khẩu demo đọc từ Secrets Manager `…/cognito-demo-credentials`; lần đầu đăng nhập phải
  đăng ký TOTP, ghi lại cách làm trong `infra/README.md`.

## 5. Kiểm tra sau deploy (smoke test)

1. Mở web, đăng nhập `employee@hr.local`: vào được trang chủ, không lỗi `redirect_mismatch`.
2. Đăng nhập `hr@hr.local`: bị hỏi mã TOTP.
3. "Quên mật khẩu" với một email demo: nhận được thư (Mailpit hoặc hộp thư đã xác minh trên SES).
4. HR tạo nhân viên thử: trong 1 phút có thư mời; cho nghỉ việc: đăng nhập lại bị từ chối.
5. `aws cognito-idp describe-user-pool-client`: `ExplicitAuthFlows` chỉ có `ALLOW_REFRESH_TOKEN_AUTH`.

## 6. Rollback và sự cố

- Cấu hình IdP: revert commit Terraform rồi `apply`; realm local: import lại bản cũ.
- **Không đổi tại chỗ được:** Cognito chỉ cho đặt MFA bắt buộc (`ON`) lúc tạo user pool, và không đổi `ON` sang `OFF`, `OPTIONAL`
  sau đó. Vì vậy phải khai báo `mfa_configuration = "ON"` trước lần `apply` đầu tiên (staging chưa `apply`, tạo T3 24/11). Đổi sau
  đó thì Terraform tạo lại pool: mất mọi tài khoản và TOTP đã đăng ký.
- Consumer `identity-sync` lỗi: hồ sơ vẫn lưu, đăng nhập của người cũ không ảnh hưởng; message nằm trong DLQ, sửa xong thì chuyển
  lại về queue (redrive).
- IdP ngừng: không đăng nhập mới được; phiên còn hạn vẫn dùng (JWKS được cache, SRS mục 6.14).

## 7. Còn thiếu

Toàn bộ phần đánh dấu *(mới)* và đề xuất ở trên; người làm theo mục 4 của [`requirements.md`](requirements.md).
