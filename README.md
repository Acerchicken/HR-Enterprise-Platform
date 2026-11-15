# HRHelper – HR Enterprise Platform

> **HRHelper** là tên dự án từ tuần 9 (trước đó gọi là Enterprise HR Platform); "HR Enterprise Platform" là chú giải đi kèm.

Đồ án môn Cloud Application Development – đề tài số 3. Hệ thống HR nội bộ cho doanh nghiệp ~2,000 nhân viên:
hồ sơ nhân viên, sơ đồ tổ chức, đơn nghỉ phép có duyệt, kho tài liệu chính sách, tìm kiếm, audit.

Trạng thái (tuần 10, 13/11/2026): đã có đăng nhập OIDC (Keycloak local, Cognito cho staging), hồ sơ nhân viên, sơ đồ tổ chức,
audit, quy trình nghỉ phép đầy đủ (tạo, duyệt, từ chối, hủy, hoàn tất) kèm email thông báo qua outbox + queue + worker, kho tài
liệu HR, dữ liệu mẫu 2,000 nhân viên, Terraform cho staging AWS. Tiến độ từng tuần: [docs/progress/](docs/progress/README.md).

## Kiến trúc (tóm tắt)

Kiến trúc đầy đủ: [kiến trúc hệ thống](docs/architecture/SAD-1-system-architecture.md) (khối, hạ tầng, NFR, CI/CD) và [kiến trúc phần mềm](docs/architecture/SAD-2-software-architecture.md) (module, code, pattern) – mục lục ở [`docs/architecture/`](docs/architecture/SAD.md).
Bộ tài liệu yêu cầu và thiết kế đi theo thứ tự BRD → SRS → SAD: mục lục ở [`docs/README.md`](docs/README.md).

- **Modular monolith** (ADR-01): một API NestJS, mỗi module một thư mục và một schema PostgreSQL.
- **PostgreSQL** (ADR-02): schema `org`, `employee`, `iam`, `leave`, `notification`, `audit`, `document`. Không có foreign key
  chéo schema. Chi tiết bảng, cột, khóa: [database schema](docs/architecture/database-schema.md).
- **Event bất đồng bộ**: transactional outbox → RabbitMQ (local) / SQS (AWS) → notification worker gửi email
  ([hợp đồng event](docs/architecture/event-contract.md)).
- **Đăng nhập**: Keycloak (OIDC, Authorization Code + PKCE). API kiểm tra chữ ký JWT bằng JWKS.
  Trên cloud, Keycloak và PostgreSQL được thay bằng dịch vụ managed (ADR-00).
- **Bảo mật dữ liệu**: CCCD, số tài khoản, lương mã hóa AES-256-GCM ở tầng ứng dụng; chỉ HR được xem, mỗi lần xem đều ghi audit.
  `audit.audit_log` có trigger chặn UPDATE/DELETE.

```
HR-Enterprise-Platform/
├── backend/                 NestJS API (TypeScript)
│   ├── src/
│   │   ├── common/          lỗi chuẩn {code,message,traceId}, traceId, phân trang, cache TTL, mã hóa trường
│   │   ├── config/          đọc biến môi trường
│   │   ├── database/        data-source, migrations/, seed.ts
│   │   ├── messaging/       EventBus: driver RabbitMQ và SQS
│   │   ├── worker/          notification worker (nhận event, gửi email)
│   │   └── modules/
│   │       ├── identity/    xác thực token, map tài khoản ↔ nhân viên, role, guard
│   │       ├── organization/ phòng ban, chức danh, cây tổ chức
│   │       ├── employee/    hồ sơ, danh bạ, quy tắc phân quyền, trường nhạy cảm
│   │       ├── audit/       ghi/tra cứu audit log
│   │       ├── leave/       đơn nghỉ phép, state machine, số dư, ngày lễ, outbox
│   │       └── document/    kho tài liệu HR, phiên bản file trên object storage
│   └── test/                e2e test
├── frontend/                React + Vite (TypeScript)
├── keycloak/realm-hr.json   realm "hr": client, role, 4 tài khoản demo
├── infra/                   Terraform cho AWS staging (xem infra/README.md)
├── docs/                    BRD, SRS, SAD, openapi.yaml, tài liệu cho dev, CONVENTIONS.md, progress/
└── docker-compose.yml
```

## Chạy nhanh bằng Docker (cách khuyên dùng)

Cần: Docker Desktop.

```bash
docker compose up -d --build
docker compose logs -f seed      # chờ dòng "Seed xong: ... 2000 nhân viên"
```

| Thành phần | Địa chỉ |
|---|---|
| Web | http://localhost:5173 |
| API | http://localhost:3000/api/v1 |
| Swagger (thử API trên trình duyệt) | http://localhost:3000/api/docs |
| Keycloak admin | http://localhost:8080 (admin / admin) |
| RabbitMQ Management | http://localhost:15672 (hr / hr) |
| Mailpit (Web UI xem email) | http://localhost:8025 |

Tài khoản demo (mật khẩu chung `Passw0rd!`):

| Username | Vai trò | Dùng để thử |
|---|---|---|
| `employee` | Nhân viên (Trần Thị Nhân, Web Engineering) | Xem/sửa hồ sơ của mình, danh bạ; không xem được hồ sơ chi tiết người khác |
| `manager` | Quản lý trực tiếp của `employee` | Xem thông tin cá nhân của nhân viên trực thuộc |
| `hr` | HR (C&B) | Xem trường nhạy cảm (có audit), sửa hồ sơ, tạo phòng ban, xem audit log |
| `admin` | Quản trị hệ thống | Xem audit log; mặc định **không** xem dữ liệu cá nhân |

Xóa sạch dữ liệu và làm lại: `docker compose down -v && docker compose up -d --build`.

## Chạy từng phần để phát triển (hot reload)

Cần: Node.js 20+, Docker Desktop (cho PostgreSQL, Keycloak, RabbitMQ và Mailpit).

```bash
docker compose up -d db keycloak rabbitmq mailpit

cd backend
cp .env.example .env
npm install
npm run migration:run
npm run seed                 # thêm "-- --reset" để tạo lại từ đầu
npm run start:dev            # http://localhost:3000/api/docs
npm run start:worker         # (terminal khác) worker gửi email thông báo nghỉ phép qua Mailpit

cd ../frontend
cp .env.example .env.local
npm install
npm run dev                  # http://localhost:5173
```

**Chế độ dev không cần Keycloak:** đặt `AUTH_MODE=dev` (backend) và `VITE_AUTH_MODE=dev` (frontend).
Khi đó token có dạng `dev:<email>`, ví dụ `Authorization: Bearer dev:hr@hr.local`. Chế độ này bị chặn khi `NODE_ENV=production`.

## Gọi API bằng curl / Postman

```bash
TOKEN=$(curl -s -d client_id=hr-api-test -d grant_type=password \
  -d username=hr -d password='Passw0rd!' \
  http://localhost:8080/realms/hr/protocol/openid-connect/token | jq -r .access_token)

curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/me
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/v1/employees?q=nguyen&size=5"
```

Client `hr-api-test` (password grant) chỉ dùng cho test local, sẽ bỏ khi deploy.

## Secret khi chạy staging/production

- `NODE_ENV=production` thì API, worker, seed **không khởi động** nếu thiếu `FIELD_ENCRYPTION_KEY`, `DB_PASSWORD`, `OIDC_ISSUER`
  (khi `AUTH_MODE=oidc`) hoặc `FIELD_ENCRYPTION_KEY` còn là khóa dev. Lỗi chỉ nêu tên biến, không in giá trị.
- `docker-compose.yml` đặt `ALLOW_DEV_SECRETS=true` để chạy local bằng khóa dev; staging/production **không** đặt biến này,
  secret lấy từ AWS Secrets Manager (Terraform trong `infra/`).
- TLS tới PostgreSQL: `DB_SSL=require` (mã hóa) hoặc `DB_SSL=verify` + `DB_SSL_CA_FILE` (kiểm tra chứng chỉ RDS). Local để `off`.

## Test

```bash
cd backend
npm test                     # unit test (state machine, phân quyền, mã hóa, cây tổ chức, cache)
npm run test:e2e             # e2e với DB thật: cần đã migrate + seed
```

## API

Hợp đồng API đầy đủ (endpoint, request, response, quyền): [`docs/openapi.yaml`](docs/openapi.yaml), hoặc Swagger tại
http://localhost:3000/api/docs khi đang chạy. File này sinh từ code bằng `npm run openapi` (backend), nên luôn khớp với code.
Mọi endpoint có tiền tố `/api/v1` và cần Bearer token, trừ `/health`.

Nhóm endpoint: `employee` (hồ sơ, danh bạ, `/me`), `organization` (phòng ban, chức danh, cây tổ chức), `leave` (loại phép,
ngày lễ, số dư, đơn nghỉ và duyệt), `documents` (kho tài liệu), `audit` (tra cứu audit log).

## Tài liệu cho người viết code

| Tài liệu | Nội dung |
|---|---|
| [CONVENTIONS](docs/CONVENTIONS.md) | Ranh giới module, đặt tên, API, migration, git và review |
| [Biến môi trường](docs/development/configuration.md) | Mỗi biến dùng làm gì, mặc định, giá trị trên staging, biến nào bắt buộc |
| [Mã lỗi API](docs/development/error-codes.md) | Format `{ code, message, traceId }`, mã lỗi và message theo từng module |
| [Database schema](docs/architecture/database-schema.md) | ERD, bảng, cột, khóa, index, lịch sử migration |
| [Hợp đồng event và queue](docs/architecture/event-contract.md) | 5 event nghỉ phép, payload, exchange/queue, chống trùng |
| [SAD phần 2](docs/architecture/SAD-2-software-architecture.md) | Kiến trúc phần mềm: module, luồng request, pattern |
| [Hạ tầng staging](infra/README.md) | Terraform, deploy, rollback (TV3) |

## Kế hoạch và tiến độ

Kế hoạch 10 tuần, báo cáo từng tuần, quyết định kiến trúc và phần việc của từng thành viên: [docs/progress/](docs/progress/README.md).

## Quy ước làm việc

Xem [docs/CONVENTIONS.md](docs/CONVENTIONS.md): cấu trúc module, đặt tên, migration, quy trình branch → PR → review.
