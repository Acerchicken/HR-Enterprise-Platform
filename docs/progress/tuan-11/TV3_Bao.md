# Tuần 11 – TV3 (Bảo): đăng nhập an toàn, hạ tầng cho UC1 và ADR-15, chuẩn bị staging

Vai trò: cloud, IaC, CI/CD. Tuần này vẫn không `terraform apply`; staging tạo T3 (24/11), nên mọi Terraform cần cho staging phải
merge trước CN (22/11).

> **Cập nhật 16/11:** thêm `infra/service-extraction` theo ADR-15 (#92); `infra/idp-hardening` chưa mở PR, hạn mới T3 (17/11);
> #69 đã merge; #68 đang conflict.

## Hạn chót

| Hạn | Việc |
|---|---|
| **T3 (17/11), 21:00** | Mở PR `infra/idp-hardening` (việc tuần 10, đã trễ hai lần) |
| **T3 (17/11), 21:00** | Sửa #68: đổi image S3 cả nhóm pull được (TV1 đã chạy được `adobe/s3mock`) hoặc ghi cách pull MinIO; rebase `dev` cho hết conflict |
| **T3 (17/11)** | Review `deploy.md` UC1 trên #76 |
| **T4 (18/11), 21:00** | Mở PR `infra/profile-files` |
| **T5 (19/11), 21:00** | Mở PR `infra/idp-mfa` |
| **T6 (20/11)** | Review `deploy.md` UC2 → UC7 trên #76 và `configuration.md` (#74) |
| **T7 (21/11), 21:00** | Mở PR `infra/service-extraction` |
| **CN (22/11), 12:00** | Mở PR `docs/slo-dashboard-cost` |
| Trong 24 giờ kể từ khi PR mở | Review `fix/auth-email-verified`, `feat/notification-service`; cấu hình trong `feat/document-ui` |
| **T2 (23/11), 9:00** | Điền mục "Việc đã làm"; gửi dòng `Plan: N to add` của toàn bộ staging cho TV1 (bước 4 của `infra/README.md`) |

## Việc cần làm

### 1. Review phần TV1 đã viết thay (#76, #74)

TV1 đã viết `deploy.md` của UC1 → UC7 và `configuration.md`. Người viết là TV1. TV3 đọc, đối chiếu với `infra/` và góp ý bằng
review trên PR: biến môi trường có trong Terraform chưa, migration, tài nguyên staging, cách rollback. #74 đã merge thì comment
trên #74 hoặc mở issue. Báo cáo ghi "TV3 review", không ghi là người viết.

### 2. `infra/idp-hardening`

Như [tuần 10 mục 5](../tuan-10/TV3_Bao.md): tắt tự đăng ký, chính sách mật khẩu, khóa sau 5 lần sai, thời hạn token và phiên cho
Cognito (`validate`, `plan`) và Keycloak local. Kiểm tra 4 tài khoản demo vẫn đăng nhập được, ghi kết quả vào mô tả PR.

**Thêm 17/11 ([ADR-17](../../architecture/adr/ADR-17-authentication.md), [UC8 deploy](../../features/UC8-authentication/deploy.md) mục 3):**

- Thêm `/callback` vào `callback_urls` của Cognito (localhost và CloudFront); thiếu thì staging lỗi `redirect_mismatch` (AC-8.1.2).
- `explicit_auth_flows` chỉ giữ `ALLOW_REFRESH_TOKEN_AUTH` (AC-8.1.8); `user_pool_tier = "ESSENTIALS"`.
- Quên mật khẩu (AC-8.2.x): Cognito `account_recovery_setting` (`verified_email`) và `email_configuration` qua SES; Keycloak
  `resetPasswordAllowed: true`, SMTP Mailpit.

### 3. `infra/profile-files` (UC1)

Phần file hồ sơ đã có trong code (#87). Bucket hồ sơ staging (chặn public, mã hóa), lifecycle xóa file đã xóa mềm sau 30 ngày,
quyền IAM tối thiểu cho App Runner, alarm khi nhiều 429. Đối chiếu tên biến với `configuration.md` và `deploy.md` UC1 trước khi
viết. Chỉ `fmt`, `validate`, `plan`; ghi dòng `Plan:` vào mô tả PR.

### 4. `infra/idp-mfa` (NFR-5.4)

Keycloak: luồng đăng nhập bắt OTP với role `hr`, `admin`. Cognito: bật TOTP, MFA bắt buộc cho HR, ADMIN. Ghi cách đăng ký OTP cho
tài khoản demo vào `infra/README.md`.

**Sửa 17/11 (ADR-17 mục 2):** Cognito không bắt MFA theo nhóm, nên đặt `mfa_configuration = "ON"` (bắt buộc mọi tài khoản), chỉ
TOTP, không SMS. Cognito chỉ cho đặt `ON` lúc tạo pool: phải có trong Terraform trước lần `apply` đầu (T3 24/11). Tiêu chí: AC-8.5.x.

### 5. `infra/service-extraction` (ADR-15)

Theo [ADR-15](../../architecture/adr/ADR-15-service-extraction.md) mục "Giải pháp được chọn":

- SNS topic `hr-events` trước các queue SQS, subscription filter policy theo loại event; queue cho search service.
- Task Fargate cho notification service và search service (chung một task hai container nếu rẻ hơn), quyền `ses:SendEmail` cho
  notification, quyền đọc S3 tài liệu cho search, biến `MAIL_DRIVER=ses`, `SMTP_FROM` (email đã xác minh).
- Ghi cách tạo DB user `notification_svc`, `search_svc` chỉ có quyền trên schema của mình.
- Bật X-Ray cho các task.
- Chỉ `validate`, `plan`. Thống nhất tên biến với TV1 trên PR `feat/notification-service`.

### 6. `docs/slo-dashboard-cost` (P4)

Dashboard CloudWatch theo SLI ở SRS mục 6.13; chi phí/tháng theo kết quả load test của TV4, cộng task thêm của ADR-15 (ADR-15
ước khoảng 9 USD/tháng nếu chạy 24/7) và lịch tắt ngoài giờ demo.

## Góp ý review

_Góp ý ghi trực tiếp trên PR._

## Việc đã làm

_Điền T2 (23/11), 9:00._
