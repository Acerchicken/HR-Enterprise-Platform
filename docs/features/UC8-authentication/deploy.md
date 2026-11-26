# UC8 – Đăng nhập và tài khoản: triển khai

> Cách chạy chung, staging, rollback chung: [README](../README.md#môi-trường). File này chỉ ghi phần riêng của UC8.
> Quyết định: [ADR-17](../../architecture/adr/ADR-17-authentication.md).

## 1. Thành phần

| Thành phần | Phần của UC8 |
|---|---|
| API (`backend/src/modules/identity`) | `TokenVerifier`, `IdentityService`, `RoleAdminController`, `AccountController`; `idp-admin/` driver `keycloak`, `cognito`, `none` |
| Worker | `IdentitySync` (`backend/src/worker/identity-sync.ts`) nhận event tài khoản trên cùng queue với email nghỉ phép |
| Web (`frontend/src/auth`, route `/callback`) | Đăng nhập, đăng xuất, tự gia hạn, tự đăng xuất khi không thao tác (`idle.tsx`), màn hình lỗi `/callback`; dòng "Tài khoản đăng nhập" trong hồ sơ (`profile/AccountRow.tsx`) |
| Database | `iam.user_account` thêm `idp_status`, `invited_at`, `idp_synced_at`, `idp_error` (migration `AccountLifecycle`); `iam.role_assignment` thêm `granted_by`, `granted_at`, `reason` (migration `RoleAssignmentAudit`) |
| Dịch vụ ngoài | Keycloak (local), Cognito + Managed Login (staging), Mailpit (local), SES (staging), Lambda Post-authentication (staging) |

## 2. Biến môi trường

Đầy đủ ở [`configuration.md`](../../development/configuration.md). Biến thêm cho UC8 đánh dấu *(mới)*.

| Biến | Local | Staging | Thiếu thì sao |
|---|---|---|---|
| `AUTH_MODE` | `oidc` (hoặc `dev`) | `oidc` | Mặc định `oidc` |
| `VITE_OIDC_AUTHORITY`, `VITE_OIDC_CLIENT_ID` | `http://localhost:8080/realms/hr`, `hr-web` | Issuer của user pool, ID app client | Web không đăng nhập được |
| `VITE_OIDC_LOGOUT_URL` | Trống | `https://<domain>.auth.ap-southeast-1.amazoncognito.com/logout` | Đăng xuất không kết thúc phiên Cognito |
| `VITE_IDLE_TIMEOUT_MINUTES` *(mới)* | `30` | `30` | Mặc định 30 |
| `IDP_ADMIN_DRIVER` *(mới)* | `keycloak` | `cognito` | `none`: không tạo, khóa tài khoản tự động |
| `KEYCLOAK_ADMIN_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_ADMIN_CLIENT_ID`, `KEYCLOAK_ADMIN_CLIENT_SECRET` *(mới)* | `http://keycloak:8080`, `hr`, `hr-api-admin`, `dev-only-hr-api-admin-secret` (đặt sẵn trong `docker-compose.yml`) | – | Thiếu secret thì worker không khởi động |
| `COGNITO_USER_POOL_ID` *(mới)* | – | Output Terraform | Driver cognito không khởi động |
| `IDP_SYNC_ATTEMPTS`, `IDP_SYNC_RETRY_DELAY_MS` *(mới)* | `5`, `1000` | `5`, `1000` | Dùng mặc định |

Chưa tách queue riêng `identity-sync`: event tài khoản đi chung queue với email nghỉ phép (`QUEUE_DRIVER`). Tách queue và DLQ riêng
trên staging là phần của TV3 (mục 3).

## 3. Hạ tầng

> Các dòng Staging dưới đây là **yêu cầu**. Rà 25/11: `cognito.tf`, `sqs_worker.tf` chưa có phần lớn (MFA, admin-only,
> `explicit_auth_flows`, `/callback`, SES, token, quyền `cognito-idp`, biến worker). Xem B1, F2 trong
> [staging-readiness](../../cloud/staging-readiness.md); B1 phải xong trước `apply` lần đầu.

| Môi trường | Tài nguyên | File |
|---|---|---|
| Local | Realm `hr`, **đã có**: bỏ realm role `manager` (ADR-18), client `hr-api-admin` (service account có `manage-users`, `view-users`, `view-realm` của `realm-management`), SMTP Mailpit, `resetPasswordAllowed`, event đăng nhập. **Còn lại (TV3)**: `passwordPolicy`, `failureFactor: 5`, `ssoSessionMaxLifespan: 36000`, Conditional OTP cho `hr`, `admin` | `keycloak/realm-hr.json` |
| Local | Worker đặt `IDP_ADMIN_DRIVER=keycloak` và biến Keycloak | `docker-compose.yml` |
| Staging | User pool: `user_pool_tier = "ESSENTIALS"`, `allow_admin_create_user_only = true`, `require_uppercase = true`, `mfa_configuration = "ON"` + `software_token_mfa_configuration`, `account_recovery_setting` (`verified_email`), `email_configuration` qua SES, `temporary_password_validity_days = 7` | `infra/staging/cognito.tf` |
| Staging | App client: `callback_urls` thêm `/callback` (localhost và CloudFront), `explicit_auth_flows = ["ALLOW_REFRESH_TOKEN_AUTH"]`, token 15 phút / refresh 10 giờ (`token_validity_units`) | `infra/staging/cognito.tf` |
| Staging | Managed Login (domain `managed_login_version = 2`, branding logo HRHelper) | `infra/staging/cognito.tf` |
| Staging | SQS `identity-sync` + DLQ (5 lần), subscription SNS `hr-events` lọc `event_type` `EmployeeCreated`, `EmployeeTerminated`, `EmployeeReinstated`, `EmployeeEmailChanged`, `AccountInviteRequested`, `RoleGranted`, `RoleRevoked` (spec mục 9.2) | `infra/staging/sqs_worker.tf` |
| Staging | IAM worker: `cognito-idp:AdminCreateUser`, `AdminUpdateUserAttributes`, `AdminAddUserToGroup`, `AdminRemoveUserFromGroup`, `AdminDisableUser`, `AdminEnableUser`, `AdminUserGlobalSignOut`, `AdminGetUser`, `ListUsers` trên ARN user pool | `infra/staging/sqs_worker.tf` |
| Staging | Lambda Post-authentication → SNS `hr-events` (nhánh `infra/idp-auth-events`) | đề xuất `infra/staging/cognito_triggers.tf` |

## 4. Các bước

- **Migration:** `AccountLifecycle`, `RoleAssignmentAudit` chạy tự động khi API khởi động; dòng `user_account` có sẵn thành
  `ACTIVE`. Sau khi bỏ đọc vai trò từ token, ai đang có quyền HR, ADMIN chỉ nhờ nhóm trên IdP sẽ mất quyền: trước khi deploy
  `feat/uc8-roles-from-db`, đối chiếu nhóm `hr`, `admin` trên IdP với `iam.role_assignment` và thêm dòng còn thiếu (seed đã có 4
  tài khoản demo).
- **ADMIN đầu tiên** (môi trường mới, ADR-18): `npm run grant-admin -- <email công ty>` (local) hoặc
  `node dist/database/grant-admin.js <email>` bằng task ECS một lần (staging; App Runner không vào container được,
  lệnh ở [staging-readiness mục 5](../../cloud/staging-readiness.md#5-lệnh-chạy-một-lần-trên-staging)). Người đó phải có hồ sơ chưa nghỉ việc. Seed local đã
  có `admin@hr.local`.
- **Local:** `docker compose up -d --build` import lại realm. Realm đã có thì xóa volume Keycloak hoặc import bằng tay, vì Keycloak
  không ghi đè realm đã tồn tại. Mở Mailpit (8025) để xem thư mời (tiêu đề mặc định của Keycloak "Update Your Account") và thư đặt lại mật khẩu. Sau khi có
  Conditional OTP (TV3), đăng nhập `hr@hr.local` lần đầu sẽ phải quét mã QR TOTP.
- **Staging:** SES phải xác minh địa chỉ gửi trước khi `apply` (SES sandbox chỉ gửi tới địa chỉ đã xác minh: xác minh luôn email
  của các thành viên dùng để demo). Mật khẩu demo đọc từ Secrets Manager `…/cognito-demo-credentials`; lần đầu đăng nhập phải
  đăng ký TOTP, ghi lại cách làm trong `infra/README.md`.

## 5. Kiểm tra sau deploy (smoke test)

1. Mở web, đăng nhập `employee@hr.local`: vào được trang chủ, không lỗi `redirect_mismatch`.
2. Đăng nhập `hr@hr.local`: bị hỏi mã TOTP.
3. "Quên mật khẩu" với một email demo: nhận được thư (Mailpit hoặc hộp thư đã xác minh trên SES).
4. HR tạo nhân viên thử: trong 1 phút có thư mời; cho nghỉ việc: đăng nhập lại bị từ chối.
5. ADMIN cấp `HR` cho một người trên trang Phân quyền: người đó vào được trang HR ngay; trong 1 phút có trong nhóm `hr` trên IdP.
6. `aws cognito-idp describe-user-pool-client`: `ExplicitAuthFlows` chỉ có `ALLOW_REFRESH_TOKEN_AUTH`.

## 6. Rollback và sự cố

- Cấu hình IdP: revert commit Terraform rồi `apply`; realm local: import lại bản cũ.
- **Không đổi tại chỗ được:** Cognito chỉ cho đặt MFA bắt buộc (`ON`) lúc tạo user pool, và không đổi `ON` sang `OFF`, `OPTIONAL`
  sau đó. Vì vậy phải khai báo `mfa_configuration = "ON"` trước lần `apply` đầu tiên (staging chưa `apply`, tạo T3 24/11). Đổi sau
  đó thì Terraform tạo lại pool: mất mọi tài khoản và TOTP đã đăng ký.
- Consumer `identity-sync` lỗi: hồ sơ vẫn lưu, đăng nhập của người cũ không ảnh hưởng; message nằm trong DLQ, sửa xong thì chuyển
  lại về queue (redrive).
- IdP ngừng: không đăng nhập mới được; phiên còn hạn vẫn dùng (JWKS được cache, SRS mục 6.14).

## 7. Còn thiếu

Phần staging ở mục 3 (Cognito, SQS, IAM, SES) và cấu hình realm còn lại (mật khẩu, khóa, OTP); người làm theo mục 4 của
[`requirements.md`](requirements.md). Code của ứng dụng (API, worker, web, driver) đã có.
