# Tuần 11 – TV3 (Bảo): đăng nhập an toàn, hạ tầng cho UC1, SLO và chi phí

Vai trò: cloud, IaC, CI/CD. Tuần này vẫn không `terraform apply`; staging tạo T3 (24/11).

## Hạn chót

| Hạn | Việc |
|---|---|
| **T2 (16/11), 21:00** | Mở PR `infra/idp-hardening` (việc tuần 10, hạn cũ CN 15/11 12:00 đã qua) |
| **T2 (16/11), 21:00** | Sửa #68 theo review: đổi image S3 cả nhóm pull được (TV1 đã chạy được `adobe/s3mock`) hoặc ghi cách pull MinIO |
| **T3 (17/11), 21:00** | Sửa #69 (bỏ ECR `hr-web`, rollback bằng `image_tag` từ `dev`) và #70 (mục 1a dưới đây) |
| **T3 (17/11)** | Review `deploy.md` UC1 trên #76 |
| **T4 (18/11), 21:00** | Mở PR `infra/profile-files` |
| **T5 (19/11), 21:00** | Mở PR `infra/idp-mfa` |
| **T6 (20/11)** | Review `deploy.md` UC2 → UC7 trên #76 và `configuration.md` (#74) |
| Trong 24 giờ kể từ khi PR mở | Review `feat/security-headers-ratelimit`, `fix/auth-email-verified`, `feat/profile-files` |
| **T7 (21/11), 21:00** | Mở PR `docs/slo-dashboard-cost` |
| **T2 (23/11), 9:00** | Điền mục "Việc đã làm" |

## Việc cần làm

### 1. Review phần TV1 đã viết thay (#76, #74)

TV1 đã viết `deploy.md` của UC1 → UC7 và `configuration.md`. Người viết là TV1. TV3 đọc, đối chiếu với `infra/` và góp ý bằng
review trên PR: biến môi trường có trong Terraform chưa, migration, tài nguyên staging, cách rollback. #74 đã merge thì comment
trên #74 hoặc mở issue. Báo cáo ghi "TV3 review", không ghi là người viết.

### 1a. Sửa #70 theo quyết định gửi email bằng SES API (14/11)

Không dùng SES SMTP. TV1 viết driver `MAIL_DRIVER=ses` ở `feat/mail-driver-ses` (gửi bằng SDK với task role của worker ECS).
Trong #70: giữ quyền `ses:SendEmail` cho `worker_task_role`; thêm biến `MAIL_DRIVER=ses`, `SMTP_FROM` (email đã xác minh) vào
task definition của worker; bỏ biến `SMTP_HOST`, `SMTP_PORT` khỏi staging; dùng email identity thay cho `no-reply@hr.local` và
ghi trong `infra/README.md` các hộp thư người nhận cần xác minh khi còn ở sandbox. Sửa các mục còn lại trong review của TV1.

### 2. `infra/profile-files` (UC1)

Bucket `hr-profile-files-staging` (chặn public, mã hóa), lifecycle xóa file đã xóa mềm sau 30 ngày, quyền IAM tối thiểu cho App
Runner, alarm khi nhiều 429; biến `PROFILE_STORAGE_BUCKET` cho MinIO local (thêm bucket vào `docker-compose.yml`) và staging.
Chỉ `fmt`, `validate`, `plan`; ghi dòng `Plan:` vào mô tả PR.

### 3. `infra/idp-mfa` (NFR-5.4)

Keycloak: luồng đăng nhập bắt OTP với role `hr`, `admin`. Cognito: bật TOTP, MFA bắt buộc cho HR, ADMIN. Ghi cách đăng ký OTP cho
tài khoản demo vào `infra/README.md`. Kiểm tra `employee`, `manager` vẫn đăng nhập không cần OTP.

### 4. `docs/slo-dashboard-cost` (P4)

Dashboard CloudWatch theo SLI ở SRS mục 6.13 (Terraform, chỉ `plan`); cập nhật chi phí/tháng theo kết quả load test của TV4.

## Góp ý review

_Góp ý ghi trực tiếp trên PR._

## Việc đã làm

_Điền T2 (23/11), 9:00._
