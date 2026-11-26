# Rà soát trước khi deploy staging lên AWS (25/11/2026)

> Đối chiếu `infra/staging/*.tf`, `.github/workflows/deploy-staging.yml`, 8 file `docs/features/UCn-*/deploy.md`,
> [`configuration.md`](../development/configuration.md) với code trên `dev` (2b81b78). Staging **chưa `apply`**.
> Cách chạy Terraform, deploy, rollback, tắt staging: [`infra/README.md`](../../infra/README.md).
> Làm xong mục nào thì đánh dấu ở cột "Xong" và sửa `deploy.md` của UC liên quan trong cùng PR.

## 1. Tóm tắt

Nếu `apply` Terraform hiện tại rồi chạy Deploy Staging, API, web, database, queue nghỉ phép lên được, nhưng:

- **Không đăng nhập được**: web gửi `redirect_uri = <origin>/callback`, app client Cognito chỉ khai báo `<origin>` và `<origin>/`
  nên Cognito trả `redirect_mismatch` (B1).
- **User pool tạo sai và không sửa tại chỗ được**: chưa bật MFA bắt buộc; Cognito không cho đổi sang MFA `ON` sau khi tạo, phải tạo
  lại pool (mất tài khoản) (B1).
- **Không có email nào gửi được** (F1), **không tự tạo, khóa tài khoản trên Cognito** (F2), **file hồ sơ trả 503** (F3),
  **trợ lý luôn trả `fallback`** (F4), **IP trong audit là IP của App Runner** (F5).

Vì vậy **chưa chạy `terraform apply` lần đầu trước khi xong B1**. Các mục F làm trước buổi demo; mục L không chặn.

## 2. Chặn: phải sửa trước `terraform apply` lần đầu

| Mã | Việc | Hiện trạng | Cần | Người | Xong |
|---|---|---|---|---|---|
| B1 | User pool, app client Cognito theo UC8 ([deploy.md mục 3](../features/UC8-authentication/deploy.md#3-hạ-tầng)) | `cognito.tf`: không có `mfa_configuration`, `allow_admin_create_user_only = false`, `require_uppercase = false`, `explicit_auth_flows` có `ALLOW_USER_PASSWORD_AUTH`, `ALLOW_USER_SRP_AUTH`; email gửi bằng Cognito mặc định; token mặc định 60 phút; `callback_urls` thiếu `/callback`; không có Managed Login v2 | `mfa_configuration = "ON"` + `software_token_mfa_configuration`; `user_pool_tier = "ESSENTIALS"`; `allow_admin_create_user_only = true`; `require_uppercase = true`; `temporary_password_validity_days = 7`; `account_recovery_setting` (`verified_email`); `email_configuration` qua SES (`aws_ses_email_identity.sender`); `explicit_auth_flows = ["ALLOW_REFRESH_TOKEN_AUTH"]`; access/ID token 15 phút, refresh 10 giờ; `callback_urls` thêm `http://localhost:5173/callback` và `https://<cloudfront>/callback`; domain `managed_login_version = 2` | TV3 | ☑ code (`infra/idp-hardening`, #150). Khi apply: xác minh email người gửi SES **trước** khi tạo user pool (mục 7 bước 3) |
| B2 | Lệnh bootstrap ECR | `infra/README.md` mục 3.1 `-target=aws_ecr_repository.web` nhưng `ecr.tf` chỉ có `api` → Terraform báo lỗi | Đã sửa trong PR này: chỉ `-target=aws_ecr_repository.api` | TV1 | ☑ |

## 3. Chức năng hỏng nếu không sửa (làm trước demo)

| Mã | Việc | Hiện trạng (đã kiểm trong code) | Cần | Người | Xong |
|---|---|---|---|---|---|
| F1 | Email (UC1, UC3, UC4, UC8) | Worker gửi bằng nodemailer SMTP `secure: false`, không xác thực (`backend/src/worker/notification-worker.ts`). Không chỗ nào đọc `MAIL_DRIVER`; task worker chỉ đặt `MAIL_DRIVER=ses`, `SMTP_FROM`, nên `SMTP_HOST` về mặc định `localhost:1025` → mọi email lỗi, vào DLQ sau 5 lần | **Đề xuất:** code đọc `MAIL_DRIVER=ses` và gửi bằng `@aws-sdk/client-sesv2` (IAM `worker_ses_policy` đã có `ses:SendEmail`), local giữ SMTP. Cách khác: SMTP credentials SES + cổng 587 STARTTLS, nhưng code phải thêm `auth`, `requireTLS` và một secret nữa | TV1 (code), TV3 (kiểm IAM) | ☑ code 25/11 (`feat/mail-ses-trust-proxy`); TV3 kiểm IAM, SES sandbox khi apply |
| F2 | Đồng bộ tài khoản sang Cognito (UC8 FR-8.3, 8.4, 8.6, 8.7) | Task worker không có `IDP_ADMIN_DRIVER`, `COGNITO_USER_POOL_ID` → driver `none`: không tạo, mời, khóa tài khoản, không đổi nhóm `hr`, `admin` (MFA theo nhóm không áp). Role worker không có quyền `cognito-idp:*` | Thêm `IDP_ADMIN_DRIVER=cognito`, `COGNITO_USER_POOL_ID = aws_cognito_user_pool.main.id` vào task worker; policy `cognito-idp:AdminCreateUser`, `AdminUpdateUserAttributes`, `AdminAddUserToGroup`, `AdminRemoveUserFromGroup`, `AdminDisableUser`, `AdminEnableUser`, `AdminUserGlobalSignOut`, `AdminGetUser` trên ARN user pool | TV3 | ☐ |
| F3 | Bucket file hồ sơ (UC1 FR-1.10) | Không có bucket; App Runner không có `PROFILE_STORAGE_BUCKET` → mọi thao tác file hồ sơ trả 503 (phần khác chạy) | Bucket `hr-platform-staging-profile-files`: chặn public, SSE-KMS (`aws_kms_key.main`), CORS chỉ `PUT` từ domain CloudFront, lifecycle xóa object tag `deleted=true` sau 30 ngày; IAM App Runner `s3:GetObject`, `PutObject`, `DeleteObject`, **`PutObjectTagging`**; biến `PROFILE_STORAGE_BUCKET` | TV3 | ☐ |
| F4 | Trợ lý chính sách (UC6) | Không có gì cho `services/assistant` trong Terraform và workflow. API thiếu `ASSISTANT_URL`, `ASSISTANT_INTERNAL_TOKEN`, `SQS_ASSISTANT_QUEUE_URL` → câu hỏi trả `fallback = true`, event tài liệu bị bỏ qua (log cảnh báo), không lỗi 5xx | Xem mục 4 | TV1 (25/11, nhánh `infra/assistant-staging`), TV3 kiểm tra khi apply | ☑ Terraform + workflow (validate qua, chưa apply) |
| F5 | IP người dùng trong audit (UC7 FR-7.1) | Không đặt `trust proxy` (`backend/src/main.ts`), nên `req.ip` là IP proxy của App Runner, không phải IP người dùng | Đặt `app.set('trust proxy', <số hop>)` theo biến `TRUST_PROXY` (staging: web gọi thẳng URL App Runner, có một lớp proxy của App Runner phía trước); kiểm lại bằng một thao tác rồi xem cột IP trên `/audit` | TV1 | ☑ code + Terraform `TRUST_PROXY=1` 25/11; kiểm lại cột IP trên `/audit` sau apply |

## 4. Trợ lý chính sách trên staging (F4 chi tiết)

Theo [UC6 deploy.md](../features/UC6-policy-assistant/deploy.md) và ADR-16. Code đã sẵn (`services/assistant`, migration
`AssistantSchema`). **25/11:** toàn bộ bảng dưới đã có trong `infra/staging/assistant.tf` (cùng sửa `app_runner.tf`,
`security_groups.tf`, `sqs_worker.tf`, `iam_oidc.tf`) và bước build image trong `deploy-staging.yml`; `terraform validate` qua,
chưa `apply`. Tên nội bộ: Cloud Map `assistant.staging.hr.internal:3100`. Còn làm tay sau migration đầu: `ALTER ROLE
assistant_svc LOGIN PASSWORD` với `ASSISTANT_DB_PASSWORD` trong secret `<project>/<env>/assistant`, rồi đồng bộ lần đầu.

| Việc | Ghi chú |
|---|---|
| ECR `hr-assistant` | Workflow thêm bước build `services/assistant`, push tag SHA và `latest` |
| SQS `hr-platform-staging-assistant-document` + DLQ | Giữ message 14 ngày (service tắt thì event chờ). Hiện chưa có SNS fan-out: API gửi thẳng event `document.*` vào queue này (`backend/src/messaging/routing.ts`) |
| Task definition + ECS service `assistant` | 0,5 vCPU, 2 GB, `desired_count = 0` (bật khi demo, [UC6 mục 4a](../features/UC6-policy-assistant/deploy.md#4a-bật-tắt-khi-demo-tiết-kiệm-chi-phí)); security group cho phép API gọi cổng 3100, cho service ra HTTPS qua NAT instance |
| Địa chỉ cho API gọi | Task Fargate đổi IP mỗi lần bật: cần tên ổn định, ví dụ ECS Service Connect hoặc Cloud Map (`assistant.hr.local:3100`), App Runner gọi qua VPC connector. Đặt vào `ASSISTANT_URL` |
| Secrets Manager | `ASSISTANT_INTERNAL_TOKEN` (API và service cùng giá trị), `ASSISTANT_CONFIG_KEY` (32 byte base64), mật khẩu `assistant_svc` |
| Biến service | `ASSISTANT_DB_URL` (user `assistant_svc`, `sslmode=require`), `QUEUE_DRIVER=sqs`, `SQS_ASSISTANT_QUEUE_URL`, `AWS_REGION`, `STORAGE_BUCKET`, `STORAGE_REGION`, `ASSISTANT_EMBEDDING_MODEL` |
| Biến API | `ASSISTANT_URL`, `ASSISTANT_INTERNAL_TOKEN`, `SQS_ASSISTANT_QUEUE_URL`; IAM App Runner thêm `sqs:SendMessage` trên queue mới |
| IAM task assistant | `sqs:ReceiveMessage`, `DeleteMessage`, `ChangeMessageVisibility` trên queue mới; `s3:GetObject` bucket tài liệu; `kms:Decrypt` |
| Database (một lần, sau migration) | RDS 16.4 có sẵn `vector`, `unaccent`; migration chạy bằng user master nên tạo được. Sau đó: `ALTER ROLE assistant_svc LOGIN PASSWORD '<secret>';` (migration tạo role `NOLOGIN`) |
| Đồng bộ lần đầu | Chạy `node dist/database/sync-document-events.js` (mục 5) để đưa tài liệu đã đăng vào index |

## 5. Lệnh chạy một lần trên staging

App Runner không có `exec` vào container, và image production không có `ts-node` (`npm run grant-admin`, `npm run assistant:sync`
chỉ dùng ở local). Chạy bằng task ECS một lần, dùng task definition worker như bước migration trong workflow:

```bash
aws ecs run-task --cluster hr-platform-staging-cluster --task-definition hr-platform-staging-worker \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[<private-subnets>],securityGroups=[<worker-sg>],assignPublicIp=DISABLED}" \
  --overrides '{"containerOverrides":[{"name":"worker","command":["node","dist/database/grant-admin.js","<email>"]}]}'
```

| Lệnh (`command`) | Khi nào |
|---|---|
| `node dist/database/grant-admin.js <email>` | Cấp ADMIN đầu tiên (ADR-18) nếu không chạy seed; người đó phải có hồ sơ chưa nghỉ việc |
| `node dist/database/sync-document-events.js` | Sau khi bật assistant service lần đầu (UC5 spec 13.2) |
| `node dist/database/seed.js` | Đã có sẵn: input `run_seed` của Deploy Staging |

## 6. Lệch so với yêu cầu, không chặn demo

| Mã | Việc | Ghi chú | Người |
|---|---|---|---|
| L1 | Bucket tài liệu SSE-S3 (`AES256`), NFR-5.16 cần SSE-KMS; CORS cho `PUT`, `GET`, `HEAD`, ADR-13 chỉ cần `PUT` | [UC5 deploy.md mục 3](../features/UC5-document-repository/deploy.md#3-hạ-tầng) | TV3 |
| L2 | Queue `identity-sync` riêng, SNS `hr-events` fan-out (ADR-15), Lambda Post-authentication | Hiện mọi event đi chung queue `leave-notifications`, worker xử lý được. Làm khi tách dịch vụ thông báo | TV3 |
| L3 | Tách quyền database cho bảng audit (NFR-5.14) | `TRUNCATE` đã bị trigger chặn (UC7 E10), nhưng user ứng dụng là chủ bảng nên tắt được trigger. Cần user ứng dụng riêng, không phải chủ bảng. Không chạy seed `--reset` trên staging | TV3, TV1 |
| L4 | Workflow chỉ chạy tay (`workflow_dispatch`) | Thêm lại `push: branches: [dev]` khi staging đã chạy ổn (tuần 12) | TV3 |
| L5 | `force_destroy`, `skip_final_snapshot = true`, `deletion_protection = false` | Chấp nhận cho staging, không mang lên production | – |
| L6 | Migration chạy hai lần mỗi deploy: task ECS trong workflow và `CMD` của image API khi App Runner khởi động | Không hại (migration đã chạy thì bỏ qua). Có thể bỏ khỏi `CMD` để App Runner khởi động nhanh hơn | TV1 |

## 7. Thứ tự đề xuất

1. TV3 sửa B1, F2, F3, F4 trong `infra/staging/`, mở PR; TV1 sửa F1, F5 trong code, mở PR riêng.
2. TV3 làm theo `infra/README.md` mục 7.1: bootstrap, ECR (`hr-api`, thêm `hr-assistant` nếu xong F4), push image, `terraform plan`.
3. TV1 duyệt plan, TV3 `apply` theo thứ tự: `terraform apply -target=aws_ses_email_identity.sender`, bấm link xác minh AWS gửi tới `sender_email`, rồi mới apply phần còn lại. User pool dùng `email_configuration` qua SES (B1), địa chỉ chưa xác minh thì bước tạo pool có thể lỗi. SES còn sandbox nên xác minh luôn email của các thành viên demo. Dán kết quả `terraform plan` thật vào PR hoặc mục này để TV1 duyệt.
4. Cấu hình GitHub Variables (`infra/README.md` mục 6), chạy Deploy Staging với `run_seed = true`.
5. Smoke test theo mục 5 "Kiểm tra sau deploy" của từng `deploy.md`, theo thứ tự UC8 → UC1 → UC2 → UC3 → UC4 → UC5 → UC7 → UC6.
6. Diễn tập rollback (`infra/README.md` mục 7.3), rồi tắt staging khi không dùng (mục 5.3).

## 8. Biến môi trường trên staging

✓ có trong Terraform, ✗ thiếu, – không cần.

| Biến | API (App Runner) | Worker (ECS) | Assistant (ECS) | Mục |
|---|---|---|---|---|
| `NODE_ENV`, `DB_*`, `DB_SSL=require`, `AWS_REGION` | ✓ | ✓ | ✓ (`ASSISTANT_DB_URL` trong secret, 25/11) | |
| `DB_PASSWORD`, `FIELD_ENCRYPTION_KEY` (secret) | ✓ | ✓ | – | |
| `AUTH_MODE`, `OIDC_*`, `CORS_ORIGIN` | ✓ | – | – | |
| `QUEUE_DRIVER=sqs`, `SQS_QUEUE_URL` | ✓ | ✓ | – | |
| `STORAGE_BUCKET`, `STORAGE_REGION` | ✓ | ✓ | ✓ (25/11) | F4 |
| `PROFILE_STORAGE_BUCKET` | ✗ | – | – | F3 |
| `SMTP_FROM` | – | ✓ | – | |
| `MAIL_DRIVER=ses` | – | ✓ (code đọc từ 25/11) | – | F1 |
| `IDP_ADMIN_DRIVER=cognito`, `COGNITO_USER_POOL_ID` | – | ✗ | – | F2 |
| `ASSISTANT_URL`, `ASSISTANT_INTERNAL_TOKEN` | ✓ (25/11) | – | ✓ (token) | F4 |
| `SQS_ASSISTANT_QUEUE_URL` | ✓ (25/11) | – | ✓ | F4 |
| `ASSISTANT_CONFIG_KEY`, `ASSISTANT_EMBEDDING_MODEL` | – | – | ✓ (25/11) | F4 |
| `TRUST_PROXY=1` | ✓ (25/11) | – | – | F5 |
| `RATE_LIMIT_*` | Dùng mặc định | – | – | |
