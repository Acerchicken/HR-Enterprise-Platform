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

### Xác thực (OIDC)

Local dùng Keycloak (realm `hr`), staging dùng Amazon Cognito.

| Biến | Mặc định | Staging (Cognito) | Bắt buộc | Dùng bởi | Ý nghĩa |
|---|---|---|---|---|---|
| `AUTH_MODE` | `oidc` | `oidc` | Không | API | `oidc`: kiểm tra JWT thật · `dev`: chấp nhận token `dev:<email>` để test; **bị cấm** khi `NODE_ENV=production` |
| `OIDC_ISSUER` | `http://localhost:8080/realms/hr` | `https://cognito-idp.<region>.amazonaws.com/<pool id>` | **Có** khi production + `oidc` | API | Phải khớp claim `iss` của token |
| `OIDC_JWKS_URI` | `<OIDC_ISSUER>/protocol/openid-connect/certs` | `<issuer>/.well-known/jwks.json` | Staging | API | Nơi lấy public key kiểm tra chữ ký. Mặc định là đường dẫn kiểu Keycloak, nên với Cognito phải đặt |
| `OIDC_ALLOWED_CLIENTS` | `hr-web` | Id client web của Cognito | Staging | API | Danh sách client được gọi API, cách nhau dấu phẩy. Local thêm `hr-api-test` để dùng curl/Postman |
| `OIDC_CLIENT_CLAIM` | `azp` | `client_id` | Staging | API | Claim chứa client id trong access token |
| `OIDC_ROLES_CLAIM` | `realm_access.roles` | `cognito:groups` | Staging | API | Đường dẫn claim chứa danh sách role |
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

### Email (notification worker)

| Biến | Mặc định | Staging | Bắt buộc | Dùng bởi | Ý nghĩa |
|---|---|---|---|---|---|
| `SMTP_HOST` | `localhost` | Đặt ở task definition của worker | Staging | Worker | Local là Mailpit (giao diện xem mail http://localhost:8025) |
| `SMTP_PORT` | `1025` | | Staging | Worker | Kết nối không TLS (`secure: false`) |
| `SMTP_FROM` | `no-reply@hr.local` | | Staging | Worker | Địa chỉ người gửi |

### Kho tài liệu (object storage)

| Biến | Mặc định | Staging | Bắt buộc | Dùng bởi | Ý nghĩa |
|---|---|---|---|---|---|
| `STORAGE_BUCKET` | (không có) | **Chưa đặt** | Để dùng UC5 | API | Tên bucket. Để trống thì API tài liệu trả **503** `Kho tài liệu chưa được cấu hình` |
| `STORAGE_REGION` | `AWS_REGION`, nếu không có thì `ap-southeast-1` | | Không | API | Region bucket |
| `STORAGE_ENDPOINT` | (không có) | Để trống | Không | API | Chỉ dùng với MinIO hoặc S3 tương thích, ví dụ `http://localhost:9000`. Trên AWS để trống |
| `STORAGE_PUBLIC_ENDPOINT` | Bằng `STORAGE_ENDPOINT` | Để trống | Không | API | Địa chỉ trình duyệt dùng khi upload bằng presigned URL. Cần khi API chạy trong Docker (`minio:9000` khác `localhost:9000`) |
| `STORAGE_ACCESS_KEY_ID` | (không có) | Để trống | Không | API | Chỉ local (MinIO). Trên AWS dùng IAM role |
| `STORAGE_SECRET_ACCESS_KEY` | (không có) | Để trống | Không | API | Như trên |

### Seed

| Biến | Mặc định | Staging | Bắt buộc | Dùng bởi | Ý nghĩa |
|---|---|---|---|---|---|
| `SEED_EMPLOYEES` | `2000` | (mặc định) | Không | CLI seed | Số nhân viên mẫu được sinh |

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
| Test e2e | Biến môi trường của shell; `app.e2e-spec.ts` tự đặt `AUTH_MODE=dev` | Không đặt biến queue thì `none`. Nhóm test kho tài liệu chỉ chạy khi có `STORAGE_BUCKET` |
| Staging AWS | `infra/staging/app_runner.tf`, Secrets Manager, `deploy-staging.yml` | Không có `ALLOW_DEV_SECRETS` |

## 5. Điểm còn thiếu trên staging (13/11/2026)

- `STORAGE_*` chưa được đặt trong `app_runner.tf` và Terraform chưa có bucket cho tài liệu, nên API kho tài liệu trên staging
  sẽ trả 503. docker-compose local cũng chưa có MinIO; muốn thử UC5 ở local phải tự chạy MinIO và đặt `STORAGE_*`.
- Biến của worker (`SMTP_*`, `QUEUE_DRIVER`, `SQS_QUEUE_URL`) nằm ở task definition ECS, chưa thấy trong Terraform.

**Khi thêm biến mới:** đọc trong `config.ts` (có mặc định cho dev hoặc kiểm tra trong `assertValid`), thêm vào `.env.example`,
`docker-compose.yml` nếu cần, Terraform hoặc workflow cho staging, và một dòng vào file này, trong cùng PR.
