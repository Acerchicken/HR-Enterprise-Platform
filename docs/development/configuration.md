# Biến môi trường – HRHelper (HR Enterprise Platform)

Toàn bộ cấu hình đọc từ biến môi trường (12-factor). Backend đọc ở `backend/src/config/config.ts` (`loadConfig`), frontend
đọc lúc **build** qua Vite (`import.meta.env`). File mẫu: `backend/.env.example`, `frontend/.env.example`.

| Phiên bản | Ngày | Người viết | Nội dung |
|---|---|---|---|
| 1.0 | 13/11/2026 | TV1 Duong | Bản đầu, theo code `dev` ngày 13/11/2026 |

## 1. Cách đọc bảng

- **Mặc định**: giá trị code dùng khi biến không được đặt. Mặc định chỉ hợp cho máy dev.
- **Staging**: giá trị trên AWS. API chạy App Runner, biến đặt trong `infra/staging/app_runner.tf`; secret lấy từ AWS Secrets
  Manager. Frontend build trong `.github/workflows/deploy-staging.yml`.
- **Bắt buộc**:
  - **Có**: thiếu thì process không khởi động (`Cấu hình không hợp lệ: ...`, chỉ in tên biến, không in giá trị).
  - **Staging**: phải đặt trên staging để chạy đúng, dù code có mặc định (mặc định trỏ về `localhost`).
  - **Không**: tùy chọn.
- **Dùng bởi**: `API` (`npm run start`), `Worker` (`start:worker`), `CLI` (migration và seed). Worker, migration và seed
  không xác thực token nên không cần nhóm `OIDC_*`.

Kiểm tra khi khởi động (`assertValid`): với `NODE_ENV=production`, thiếu `FIELD_ENCRYPTION_KEY`, `DB_PASSWORD`, `OIDC_ISSUER`
(chỉ API, khi `AUTH_MODE=oidc`) hoặc `FIELD_ENCRYPTION_KEY` vẫn là khóa dev thì process dừng. Chỉ docker-compose local được bỏ
qua bằng `ALLOW_DEV_SECRETS=true`.

## 2. Backend

### Chung

| Biến | Mặc định | Staging | Bắt buộc | Dùng bởi | Ý nghĩa |
|---|---|---|---|---|---|
| `NODE_ENV` | `development` | `production` | Staging | Tất cả | `production` bật kiểm tra secret và cấm `AUTH_MODE=dev` |
| `PORT` | `3000` | `var.api_container_port` | Không | API | Cổng HTTP |
| `CORS_ORIGIN` | `http://localhost:5173` | `https://<domain CloudFront>` | Staging | API | Origin web được gọi API; nhiều origin cách nhau dấu phẩy |
| `TRUST_PROXY` | `0` | `1` (App Runner) | Không | API | Số lớp proxy trước API (Express `trust proxy`), để `req.ip` trong audit và rate limit là IP người dùng. Số nguyên 0–5; không đặt cao hơn số proxy thật, nếu không người dùng giả được IP bằng `X-Forwarded-For` (F5) |
| `LOG_FORMAT` | `text` (dev), `json` (khi `NODE_ENV=production`) | `json` (mặc định) | Không | API, Worker | `json`: một dòng JSON mỗi log có `traceId`, `level`, `context`, `version`, kèm access log mỗi request (method, đường dẫn không query, status, `durationMs`) và metric dạng CloudWatch EMF (NFR-8.1, NFR-8.2) |
| `APP_VERSION` | `dev` | Commit SHA (build-arg trong `deploy-staging.yml`) | Không | API, Worker | Trả ở `GET /health` (`version`) và có trong mọi dòng log JSON (NFR-8.5) |
| `ALLOW_DEV_SECRETS` | (không đặt) | **không đặt** | Không | Tất cả | `true` cho phép chạy `production` với khóa dev. **Chỉ** docker-compose local |

### Database

| Biến | Mặc định | Staging | Bắt buộc | Dùng bởi | Ý nghĩa |
|---|---|---|---|---|---|
| `DB_HOST` | `localhost` | Endpoint RDS | Staging | Tất cả | Host PostgreSQL |
| `DB_PORT` | `5432` | Cổng RDS | Không | Tất cả | |
| `DB_USER` | `hr` | `var.db_username` | Staging | Tất cả | |
| `DB_PASSWORD` | `hr` | Secrets Manager (`db_credentials:password`) | **Có** khi production | Tất cả | |
| `DB_NAME` | `hr` | `var.db_name` | Staging | Tất cả | |
| `DB_SSL` | `off` | `require` | Không | Tất cả | `off` không TLS · `require` mã hóa, không kiểm tra chứng chỉ · `verify` mã hóa và kiểm tra theo CA |
| `DB_SSL_CA_FILE` | (không có) | (chưa dùng) | **Có** khi `DB_SSL=verify` | Tất cả | Đường dẫn CA bundle của RDS, ví dụ `/app/certs/rds-global-bundle.pem` |
| `DB_POOL_MAX` | `10` | `10` | Không | API, Worker | Số kết nối tối đa mỗi instance (1–100). Tổng của mọi instance phải nhỏ hơn `max_connections` của RDS |
| `DB_CONNECT_TIMEOUT_MS` | `5000` | | Không | API, Worker | Chờ lấy kết nối từ pool tối đa bao lâu; quá thì API trả 503 `SERVICE_UNAVAILABLE` kèm `Retry-After: 5` (SRS 6.14) |
| `DB_STATEMENT_TIMEOUT_MS` | `5000` | API 5000, worker 60000 (job nền) | Không | API, Worker | `statement_timeout` của Postgres cho mỗi câu lệnh; quá thì hủy câu lệnh và trả 503. `0` = không giới hạn. CLI migration, seed không áp dụng |

### Xác thực (OIDC)

Local dùng Keycloak (realm `hr`), staging dùng Amazon Cognito.

| Biến | Mặc định | Staging (Cognito) | Bắt buộc | Dùng bởi | Ý nghĩa |
|---|---|---|---|---|---|
| `AUTH_MODE` | `oidc` | `oidc` | Không | API | `oidc`: kiểm tra JWT thật · `dev`: chấp nhận token `dev:<email>` để test; **bị cấm** khi `NODE_ENV=production` |
| `OIDC_ISSUER` | `http://localhost:8080/realms/hr` | `https://cognito-idp.<region>.amazonaws.com/<pool id>` | **Có** khi production + `oidc` | API | Phải khớp claim `iss` của token |
| `OIDC_JWKS_URI` | `<OIDC_ISSUER>/protocol/openid-connect/certs` | `<issuer>/.well-known/jwks.json` | Staging | API | Nơi lấy public key kiểm tra chữ ký. Mặc định là đường dẫn kiểu Keycloak, nên với Cognito phải đặt |
| `OIDC_ALLOWED_CLIENTS` | `hr-web` | Id client web của Cognito | Staging | API | Danh sách client được gọi API, cách nhau dấu phẩy. Local thêm `hr-api-test` để dùng curl/Postman |
| `OIDC_CLIENT_CLAIM` | `azp` | `client_id` | Staging | API | Claim chứa client id trong access token |
| `OIDC_USERINFO_URL` | (không có) | `https://<domain>.auth.<region>.amazoncognito.com/oauth2/userInfo` | Staging | API | Access token Cognito không có email: API gọi userinfo lấy email, cache theo `sub` 10 phút. Để trống với Keycloak |

### Mã hóa trường nhạy cảm

| Biến | Mặc định | Staging | Bắt buộc | Dùng bởi | Ý nghĩa |
|---|---|---|---|---|---|
| `FIELD_ENCRYPTION_KEY` | Khóa dev cố định trong code | Secrets Manager (`app_secrets:FIELD_ENCRYPTION_KEY`, Terraform sinh ngẫu nhiên) | **Có** khi production, và không được là khóa dev | Tất cả | Khóa AES-256-GCM, **32 byte mã hóa base64**, mã hóa CCCD, số tài khoản, lương (ADR-08). Tạo khóa: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. **Đổi khóa thì dữ liệu cũ không giải mã được** |

### Queue

Dùng cho outbox publisher (trong API) và notification worker. Chi tiết: [hợp đồng event](../architecture/event-contract.md).

| Biến | Mặc định | Staging | Bắt buộc | Dùng bởi | Ý nghĩa |
|---|---|---|---|---|---|
| `QUEUE_DRIVER` | Suy ra: có `RABBITMQ_URL` → `rabbitmq`; có `SQS_QUEUE_URL` → `sqs`; không có gì → `none` | `sqs` | Worker: phải khác `none` | API, Worker | `none`: API vẫn ghi outbox nhưng không đẩy đi (dùng khi chạy test); worker không chạy được với `none` |
| `RABBITMQ_URL` | (không có) | (không dùng) | **Có** khi `rabbitmq` | API, Worker | Ví dụ `amqp://hr:hr@localhost:5672` |
| `SQS_QUEUE_URL` | (không có) | URL queue `hr-platform-staging-leave-notifications` | **Có** khi `sqs` | API, Worker | Quyền gửi/nhận lấy từ IAM role, không cần access key |
| `AWS_REGION` | (không có) | `var.aws_region` (ví dụ `ap-southeast-1`) | **Có** khi `sqs` | API, Worker | Region của SQS; cũng là region mặc định cho kho tài liệu |
| `SQS_ASSISTANT_QUEUE_URL` | (không có) | URL queue `<project>-<env>-assistant-document` (Terraform `assistant.tf`, 25/11: [staging-readiness F4](../cloud/staging-readiness.md#4-trợ-lý-chính-sách-trên-staging-f4-chi-tiết)) | Không | API, Assistant service | Queue nhận event tài liệu (UC6). API thiếu biến này thì bỏ qua event tài liệu khi dùng SQS; assistant service dùng nó khi `QUEUE_DRIVER=sqs` |

### Email (notification worker)

| Biến | Mặc định | Staging | Bắt buộc | Dùng bởi | Ý nghĩa |
|---|---|---|---|---|---|
| `MAIL_DRIVER` | `smtp` | `ses` (task worker) | Không | Worker | `smtp`: gửi qua `SMTP_HOST`/`SMTP_PORT` (local Mailpit). `ses`: gửi bằng Amazon SES API v2 (`@aws-sdk/client-sesv2`) với IAM task role, không cần SMTP credentials ([staging-readiness F1](../cloud/staging-readiness.md#3-chức-năng-hỏng-nếu-không-sửa-làm-trước-demo)). Nhiều người nhận thì đặt Bcc, chia lô 49 địa chỉ |
| `SES_REGION` | `AWS_REGION` | (dùng `AWS_REGION`) | Không | Worker | Region của SES identity nếu khác region chạy worker |
| `SMTP_HOST` | `localhost` | Không dùng (`MAIL_DRIVER=ses`) | Khi `smtp` | Worker | Local là Mailpit (giao diện xem mail http://localhost:8025) |
| `SMTP_PORT` | `1025` | | Khi `smtp` | Worker | Kết nối không TLS (`secure: false`) |
| `SMTP_FROM` | `no-reply@hr.local` | ✓ (email đã xác minh trong SES) | Staging | Worker | Địa chỉ người gửi, dùng cho cả hai driver |

### Đồng bộ tài khoản sang IdP (UC8 FR-8.3, 8.4, 8.6, 8.7)

Worker `identity-sync` (trong tiến trình worker) tạo, mời, khóa, mở tài khoản và đổi nhóm trên IdP theo event trong outbox.

| Biến | Mặc định | Staging | Bắt buộc | Dùng bởi | Ý nghĩa |
|---|---|---|---|---|---|
| `IDP_ADMIN_DRIVER` | `none` | `cognito` | Không | Worker | `keycloak`, `cognito` hoặc `none`. `none`: không gọi IdP, tài khoản coi như đã có (dùng với `AUTH_MODE=dev` và test). docker-compose đặt `keycloak` |
| `KEYCLOAK_ADMIN_URL` | `OIDC_ISSUER` bỏ `/realms/<realm>` | (không dùng) | Không | Worker | Gốc Admin REST API. Trong docker-compose là `http://keycloak:8080` |
| `KEYCLOAK_REALM` | Lấy từ `OIDC_ISSUER`, nếu không có thì `hr` | (không dùng) | Không | Worker | Realm chứa tài khoản nhân viên |
| `KEYCLOAK_ADMIN_CLIENT_ID` | `hr-api-admin` | (không dùng) | Không | Worker | Client có service account, chỉ có `manage-users`, `view-users`, `view-realm` của `realm-management` |
| `KEYCLOAK_ADMIN_CLIENT_SECRET` | (không có) | (không dùng) | **Có** khi `keycloak` | Worker | Local là `dev-only-hr-api-admin-secret` (khớp `keycloak/realm-hr.json`) |
| `COGNITO_USER_POOL_ID` | (không có) | Id user pool | **Có** khi `cognito` | Worker | Quyền `cognito-idp:Admin*` lấy từ IAM role của worker; region lấy từ `AWS_REGION` |
| `IDP_SYNC_ATTEMPTS` | `5` | `5` | Không | Worker | Số lần thử khi IdP lỗi tạm thời (mạng, 5xx, 429). Hết lượt thì tài khoản `FAILED`, message vào DLQ |
| `IDP_SYNC_RETRY_DELAY_MS` | `1000` | `1000` | Không | Worker | Thời gian chờ lần đầu, nhân đôi mỗi lần |

Web: `VITE_IDLE_TIMEOUT_MINUTES` (mặc định `30`) là số phút không thao tác thì tự đăng xuất, cảnh báo trước 1 phút (AC-8.1.6).

### Giới hạn tần suất (NFR-5.21, UC1 FR-1.14)

| Biến | Mặc định | Staging | Bắt buộc | Dùng bởi | Ý nghĩa |
|---|---|---|---|---|---|
| `RATE_LIMIT_ENABLED` | `true` | `true` | Không | API | `false` tắt hẳn giới hạn (chỉ dùng khi debug local) |
| `RATE_LIMIT_OVERRIDES` | (không có) | Để trống | Không | API | JSON đổi ngưỡng từng nhóm, ví dụ `{"global":{"minute":1000}}` khi load test. Nhóm và ngưỡng mặc định ở `backend/src/common/rate-limit/rate-limit-rules.ts`: `global` 100/phút, `search` 20/phút, `profile-write` 30/phút và 300/ngày, `profile-upload` 10/giờ và 30/ngày, `avatar-upload` 5/ngày, `profile-download` 60/giờ, `sensitive-view` 100/giờ, `assistant` 10/phút và 100/ngày (UC6). Giới hạn ngày đếm trong bảng `iam.rate_limit_counter` |

### Kho tài liệu (object storage)

| Biến | Mặc định | Staging | Bắt buộc | Dùng bởi | Ý nghĩa |
|---|---|---|---|---|---|
| `STORAGE_BUCKET` | (không có) | **Chưa đặt** | Để dùng UC5 | API | Tên bucket. Để trống thì API tài liệu trả **503** `Kho tài liệu chưa được cấu hình` |
| `PROFILE_STORAGE_BUCKET` | (không có) | **Chưa đặt** (TV3: `hr-profile-files-staging`) | Để dùng file hồ sơ (UC1 FR-1.10) | API | Bucket riêng cho file hồ sơ, dùng chung endpoint và khóa với `STORAGE_*`. Chặn public, SSE-KMS, lifecycle xóa object có tag `deleted=true` sau 30 ngày. Để trống thì thao tác file hồ sơ trả **503**, xem và sửa hồ sơ vẫn chạy |
| `STORAGE_REGION` | `AWS_REGION`, nếu không có thì `ap-southeast-1` | | Không | API | Region bucket |
| `STORAGE_ENDPOINT` | (không có) | Để trống | Không | API | Chỉ dùng với S3Mock hoặc S3 tương thích, ví dụ `http://localhost:9090` (hoặc `http://s3mock:9090` trong Docker). Trên AWS để trống |
| `STORAGE_PUBLIC_ENDPOINT` | Bằng `STORAGE_ENDPOINT` | Để trống | Không | API | Địa chỉ trình duyệt dùng khi upload bằng presigned URL. Cần khi API chạy trong Docker (`s3mock:9090` khác `localhost:9090`) |
| `STORAGE_ACCESS_KEY_ID` | (không có) | Để trống | Không | API | Chỉ local (S3Mock/MinIO, mặc định `test`). Trên AWS dùng IAM role |
| `STORAGE_SECRET_ACCESS_KEY` | (không có) | Để trống | Không | API | Như trên (mặc định `test`) |

### Seed

| Biến | Mặc định | Staging | Bắt buộc | Dùng bởi | Ý nghĩa |
|---|---|---|---|---|---|
| `SEED_EMPLOYEES` | `2000` | (mặc định) | Không | CLI seed | Số nhân viên mẫu được sinh |

### Trợ lý chính sách (UC6, API gọi assistant service)

| Biến | Mặc định | Staging | Bắt buộc | Dùng bởi | Ý nghĩa |
|---|---|---|---|---|---|
| `ASSISTANT_URL` | (không có) | URL nội bộ của task assistant | Không | API | Không đặt thì `POST /assistant/questions` trả `fallback = true` ("Trợ lý tạm thời không dùng được"), không lỗi 5xx (UC6 E5) |
| `ASSISTANT_INTERNAL_TOKEN` | (không có) | Secrets Manager, chung với assistant service | **Có** khi có `ASSISTANT_URL` | API | Ít nhất 16 ký tự; gửi ở header `Authorization: Bearer` khi gọi `POST /internal/answers` |
| `ASSISTANT_TIMEOUT_MS` | `15000` | `15000` | Không | API | Chờ assistant service tối đa; lớn hơn timeout LLM (10 s) để service kịp trả fallback |

## 2a. Assistant service (`services/assistant/`, UC6)

Service riêng, đọc cấu hình bằng code của nó (không import `backend/`). Thiếu biến bắt buộc thì không khởi động.

| Biến | Mặc định | Staging | Bắt buộc | Ý nghĩa |
|---|---|---|---|---|
| `PORT` | `3100` | `3100` | Không | HTTP nội bộ (`/health`) |
| `ASSISTANT_DB_URL` | (không có) | `postgres://assistant_svc:<secret>@<rds>/hr` | **Có** | Chỉ có quyền trên schema `assistant` (ADR-16). Local dùng user `hr` |
| `DB_SSL`, `DB_SSL_CA_FILE` | `off` | `verify` + CA của RDS | Không | Như backend |
| `QUEUE_DRIVER` | Suy ra: có `SQS_ASSISTANT_QUEUE_URL` → `sqs`, không thì `rabbitmq` | `sqs` | Không | |
| `RABBITMQ_URL` | (không có) | (không dùng) | **Có** khi `rabbitmq` | Nghe queue `assistant.document` |
| `SQS_ASSISTANT_QUEUE_URL`, `AWS_REGION` | (không có), `ap-southeast-1` | URL queue, region | **Có** khi `sqs` | |
| `STORAGE_BUCKET`, `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY` | Như backend | Bucket tài liệu, IAM chỉ đọc | `STORAGE_BUCKET` **có** | Đọc file để trích văn bản, tối đa 20 MiB |
| `ASSISTANT_EMBEDDING_MODEL` | `embeddinggemma-300m` | `embeddinggemma-300m` | Không | `id` trong registry embedder (ADR-16 mục 4); `hash-256` chỉ để test. `id` lạ thì không khởi động |
| `ASSISTANT_INTERNAL_TOKEN` | (không có) | Secrets Manager | **Có** | Trùng giá trị ở API, ít nhất 16 ký tự |
| `ASSISTANT_LLM_TIMEOUT_MS` | `10000` | `10000` | Không | Timeout gọi nhà cung cấp LLM, không thử lại (NFR-3.5); 1000–60000 |
| `ASSISTANT_CONFIG_KEY` | (không có; docker-compose có khóa chỉ dùng local) | Secrets Manager | **Có** | 32 byte base64 (`openssl rand -base64 32`), mã hóa AES-256-GCM API key nhà cung cấp AI trong `assistant.llm_config` (FR-6.4, ADR-16 mục 7). Đổi hoặc mất khóa: ADMIN dán lại API key trên `/admin/assistant`. Nhà cung cấp, model, API key **không** đặt bằng biến môi trường |
| `ASSISTANT_MODEL_DIR` | `./.model-cache` (Docker: `/app/.model-cache`) | Như Docker | Không | Thư mục model đã tải sẵn lúc build image; service không tải model khi chạy |

## 3. Frontend (Vite, đọc lúc build)

Giá trị được **nhúng vào bundle khi build**: đổi biến thì phải build lại, và không đặt secret ở đây (ai cũng đọc được).
Staging đặt trong bước build của `deploy-staging.yml`.

| Biến | Mặc định | Staging | Ý nghĩa |
|---|---|---|---|
| `VITE_API_URL` | `http://localhost:3000/api/v1` | URL App Runner + `/api/v1` | Địa chỉ API |
| `VITE_AUTH_MODE` | `oidc` | `oidc` | `dev`: màn hình chọn tài khoản demo (backend cũng phải `AUTH_MODE=dev`) |
| `VITE_OIDC_AUTHORITY` | `http://localhost:8080/realms/hr` | Issuer Cognito | Địa chỉ IdP |
| `VITE_OIDC_CLIENT_ID` | `hr-web` | Id client web Cognito | |
| `VITE_OIDC_LOGOUT_URL` | (trống) | Biến repo `VITE_OIDC_LOGOUT_URL` | URL `/logout` của Cognito Hosted UI. Để trống với Keycloak |

## 4. Bộ giá trị theo môi trường

| Môi trường | Lấy cấu hình ở đâu | Ghi chú |
|---|---|---|
| Docker local (`docker compose up`) | `docker-compose.yml` | `NODE_ENV=production` + `ALLOW_DEV_SECRETS=true`, Keycloak, RabbitMQ, Mailpit |
| Chạy từng phần (hot reload) | `backend/.env` (chép từ `.env.example`), `frontend/.env.local` | `NODE_ENV=development` |
| Test e2e | Biến môi trường của shell; `app.e2e-spec.ts` tự đặt `AUTH_MODE=dev` | Không đặt biến queue thì `none`. Nhóm test kho tài liệu chạy với S3Mock khi có `STORAGE_BUCKET`, không có thì dùng bucket giả trong bộ nhớ |
| Staging AWS | `infra/staging/app_runner.tf`, Secrets Manager, `deploy-staging.yml` | Không có `ALLOW_DEV_SECRETS` |

## 5. Điểm còn thiếu trên staging

Rà lại ngày 25/11/2026 trước khi `apply`: [staging-readiness.md](../cloud/staging-readiness.md), mục 8 là bảng biến theo từng
thành phần (API, worker, assistant), có biến nào chưa có trong Terraform. Chính:

- ~~Worker gửi mail bằng SMTP; `MAIL_DRIVER=ses` chưa được code đọc (F1)~~: đã sửa 25/11 (`feat/mail-ses-trust-proxy`), cùng `TRUST_PROXY=1` cho API (F5).
- Worker thiếu `IDP_ADMIN_DRIVER`, `COGNITO_USER_POOL_ID` (F2); API thiếu `PROFILE_STORAGE_BUCKET` (F3). `ASSISTANT_URL`,
  `ASSISTANT_INTERNAL_TOKEN`, `SQS_ASSISTANT_QUEUE_URL` (F4) đã có trong Terraform từ 25/11 (`infra/assistant-staging`).

**Khi thêm biến mới:** đọc trong `config.ts` (có mặc định cho dev hoặc kiểm tra trong `assertValid`), thêm vào `.env.example`,
`docker-compose.yml` nếu cần, Terraform hoặc workflow cho staging, và một dòng vào file này, trong cùng PR.
