# Tuần 12 bổ sung – TV3 (Bảo): đưa staging lên AWS, dashboard, chi phí, diễn tập lỗi

Vai trò: cloud, IaC, CI/CD. **Staging là đường găng của cả nhóm**: load test, diễn tập lỗi, dashboard, chi phí thật đều chờ
`apply`. Danh sách lỗ hổng trước khi `apply`: [`staging-readiness.md`](../../cloud/staging-readiness.md).

TV1 đã nhận thay hai việc của TV3 để TV3 tập trung vào hạ tầng lõi: hạ tầng trợ lý (F4, nhánh `infra/assistant-staging`) và e2e
trong CI (N9). TV3 review hai PR này.

## Hạn chót

| Hạn | Việc |
|---|---|
| **T5 (26/11), 21:00** | Mở PR `infra/idp-hardening` (B1 + Keycloak) và `infra/profile-files` (F3 + F2); gửi dòng `Plan: N to add` cho TV1 |
| **T6 (27/11), 21:00** | `terraform apply` staging xong, Deploy Staging chạy xanh với `run_seed = true`, gửi URL cho nhóm. **Quá hạn này TV1 báo giảng viên, nhóm demo ở local** |
| Trong 24 giờ sau khi F4 merge | `apply` phần trợ lý |
| **T7 (28/11), 21:00** | Mở PR `infra/idp-mfa` (N8) |
| **CN (29/11), 12:00** | Mở PR `docs/slo-dashboard-cost` (N5b) |
| **T2 (30/11)** | Diễn tập lỗi cùng TV4 (N6) |
| Trong 24 giờ kể từ khi PR mở | Review `infra/assistant-staging`, `ci/e2e`, `feat/mail-ses-trust-proxy`, `feat/observability-basics` của TV1 |

<a id="n1"></a>
## N1 – Sửa Terraform và đưa staging lên

**`infra/idp-hardening` (B1, [staging-readiness mục 2](../../cloud/staging-readiness.md#2-chặn-phải-sửa-trước-terraform-apply-lần-đầu)):**
phải xong **trước** lần `apply` đầu, vì Cognito không cho bật MFA `ON` sau khi đã tạo pool.

- `cognito.tf`: `mfa_configuration = "ON"` + `software_token_mfa_configuration { enabled = true }`; `user_pool_tier = "ESSENTIALS"`;
  `allow_admin_create_user_only = true`; `require_uppercase = true`; `temporary_password_validity_days = 7`;
  `account_recovery_setting` theo `verified_email`; `email_configuration` qua SES (`aws_ses_email_identity.sender`).
- App client: `explicit_auth_flows = ["ALLOW_REFRESH_TOKEN_AUTH"]`; access, ID token 15 phút, refresh 10 giờ; `callback_urls` thêm
  `http://localhost:5173/callback` và `https://<cloudfront>/callback`; domain `managed_login_version = 2`.
- Keycloak local (`keycloak/`): `passwordPolicy` (8 ký tự, hoa, thường, số, không trùng email), `bruteForceProtected` với
  `failureFactor: 5`, khóa 15 phút (NFR-5.2, 5.3).

**`infra/profile-files` (F3, F2):** bucket `hr-platform-staging-profile-files` (chặn public, SSE-KMS, CORS chỉ `PUT` từ CloudFront,
lifecycle xóa object tag `deleted=true` sau 30 ngày); IAM App Runner `s3:GetObject`, `PutObject`, `DeleteObject`, `PutObjectTagging`;
biến `PROFILE_STORAGE_BUCKET`. Task worker thêm `IDP_ADMIN_DRIVER=cognito`, `COGNITO_USER_POOL_ID`; IAM `cognito-idp:AdminCreateUser`,
`AdminUpdateUserAttributes`, `AdminAddUserToGroup`, `AdminRemoveUserFromGroup`, `AdminDisableUser`, `AdminEnableUser`,
`AdminUserGlobalSignOut`, `AdminGetUser` trên ARN user pool.

**App Runner tối thiểu 2 instance khi đo và demo** (ADR-06, NFR-3.2): thêm `aws_apprunner_auto_scaling_configuration_version` với
`min_size` là biến (mặc định 1 cho đỡ tiền, đặt 2 trong lúc load test và buổi bảo vệ).

**Apply:** theo [`infra/README.md` mục 7.1](../../../infra/README.md): bootstrap → ECR → push image → `plan` (gửi TV1 dòng `Plan: …`)
→ `apply` → GitHub Variables (mục 6) → Deploy Staging `run_seed = true` → xác minh email người gửi và email thành viên trên SES sandbox.

**Xong khi:** `GET <app-runner-url>/api/v1/health` trả 200; 4 tài khoản demo đăng nhập được trên web CloudFront; HR bị hỏi mã MFA;
ảnh chụp và URL gửi trong nhóm; mô tả PR có dòng `Plan:` và `Apply complete!`.

<a id="n8"></a>
## N8 – MFA TOTP cho HR, ADMIN

Keycloak: Conditional OTP cho role `hr`, `admin`. Cognito: đã `ON` cho mọi tài khoản từ N1 (ADR-17). Kiểm bằng tài khoản `hr`: đăng
nhập bị hỏi mã ở cả local và staging; ghi kết quả vào PR (NFR-5.4, FR-8.5).

<a id="n5b"></a>
## N5b – Dashboard CloudWatch và chi phí thật

- `aws_cloudwatch_dashboard` theo 5 SLI ở [SRS 6.13](../../requirements/SRS.md#613-mục-tiêu-dịch-vụ-sli-slo-sla): tỉ lệ request
  không 5xx, p95 App Runner, số request, độ dài queue và DLQ, CPU và kết nối RDS. TV1 thêm metric "event outbox chưa gửi" (N5a), đưa
  vào dashboard khi có.
- Chi phí thật từ Cost Explorer theo ngày, từ ngày `apply`; so với dự toán 56,8 USD/tháng ở [`mapping.md`](../../cloud/mapping.md);
  cộng task assistant (0,5 vCPU, 2 GB, chỉ bật khi demo) và tiền LLM (TV4 đo ở N7b).
- Thống nhất ngân sách: NFR-7.1 trong SRS ghi < 100 USD, `budgets.tf` đặt 50 USD, hạn mức thẻ khoảng 60 USD. Ghi một con số và
  lý do.

**Xong khi:** PR có ảnh dashboard đang chạy, bảng chi phí thật theo ngày, ngân sách thống nhất ở SRS và `budgets.tf`.

<a id="n6"></a>
## N6 – Diễn tập lỗi trên staging (cùng TV4)

TV3 thao tác, TV4 bấm giờ và ghi biên bản `docs/test-report-failure`. Mỗi ca chụp ảnh trước, trong, sau:

| Ca | Cách làm | Mong đợi |
|---|---|---|
| Worker dừng | `aws ecs update-service … --desired-count 0`; nhân viên tạo đơn; bật lại `1` | Đơn tạo được; email tới sau khi bật lại; không gửi trùng |
| Trợ lý tắt | Service assistant `desired-count 0`; hỏi một câu | Trả `fallback` có danh sách tài liệu, chức năng khác bình thường |
| LLM lỗi | ADMIN dán khóa sai trên trang cấu hình trợ lý | `fallback`; log `LLM_AUTH_FAILED` |
| Rollback | Deploy một commit mới, rồi Run workflow Deploy Staging với `image_tag` = SHA cũ | `/health` 200 với bản cũ; bấm giờ (mục tiêu < 15 phút, NFR-3.3) |
| Khôi phục database | RDS "Restore to point in time" sang instance mới; kiểm dữ liệu; xóa instance mới | Bấm giờ từ lúc bắt đầu tới lúc đọc được dữ liệu (RTO ≤ 4 giờ, NFR-4.2) |

## Việc đã làm

- **25/11/2026**:
  - Hoàn thành nhánh và mở PR `infra/idp-hardening` (B1 + Keycloak):
    - Cognito User Pool: `mfa_configuration = "ON"`, `software_token_mfa_configuration { enabled = true }`, `user_pool_tier = "ESSENTIALS"`, `allow_admin_create_user_only = true`, `require_uppercase = true`, `temporary_password_validity_days = 7`, `account_recovery_setting` (verified_email), `email_configuration` qua SES (`aws_ses_email_identity.sender`).
    - Cognito App Client: `explicit_auth_flows = ["ALLOW_REFRESH_TOKEN_AUTH"]`, access/ID token 15 phút, refresh token 10 giờ, `callback_urls` bổ sung `/callback` (localhost và CloudFront), Hosted Domain `managed_login_version = 2`.
    - Keycloak local: `passwordPolicy` (8 ký tự, hoa, thường, số, không trùng email), `bruteForceProtected: true`, `failureFactor: 5`, khóa 15 phút (`waitIncrementSeconds: 900`, `maxFailureWaitSeconds: 900`), phiên tối đa 10 giờ (`ssoSessionMaxLifespan: 36000`).
  - Hoàn thành nhánh và mở PR `infra/profile-files` (F3 + F2 + App Runner Scaling):
    - Profile files bucket `hr-platform-staging-profile-files`: chặn public 100%, SSE-KMS (`aws_kms_key.main`), CORS chỉ cho phép method `PUT` từ domain CloudFront, lifecycle xóa object tag `deleted=true` sau 30 ngày.
    - App Runner IAM: cấp quyền `s3:GetObject`, `PutObject`, `DeleteObject`, `PutObjectTagging` trên bucket profile files; bổ sung biến môi trường `PROFILE_STORAGE_BUCKET`.
    - App Runner Auto Scaling: bổ sung `aws_apprunner_auto_scaling_configuration_version` kết nối với API service, biến `apprunner_min_instances` (mặc định 1 cho staging, cấu hình 2 khi load test/demo theo ADR-06, NFR-3.2).
    - Task worker & IAM: bổ sung biến môi trường `IDP_ADMIN_DRIVER=cognito`, `COGNITO_USER_POOL_ID`; policy `cognito-idp:AdminCreateUser`, `AdminUpdateUserAttributes`, `AdminAddUserToGroup`, `AdminRemoveUserFromGroup`, `AdminDisableUser`, `AdminEnableUser`, `AdminUserGlobalSignOut`, `AdminGetUser` trên ARN user pool.
