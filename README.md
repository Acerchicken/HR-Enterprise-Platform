# Enterprise HR Platform

Đồ án môn Cloud Application Development – đề tài số 3. Hệ thống HR nội bộ cho doanh nghiệp ~2,000 nhân viên:
hồ sơ nhân viên, sơ đồ tổ chức, đơn nghỉ phép có duyệt, kho tài liệu chính sách, tìm kiếm, audit.

Trạng thái: **tuần 7 – Implementation 1 (nền tảng)**. Đã có: đăng nhập OIDC, module Employee, Organization, Audit,
model + state machine của Leave, dữ liệu mẫu 2,000 nhân viên, frontend (hồ sơ, danh bạ, sơ đồ tổ chức).

## Kiến trúc (tóm tắt)

- **Modular monolith** (ADR-01): một API NestJS, mỗi module một thư mục và một schema PostgreSQL.
- **PostgreSQL** (ADR-02): schema `org`, `employee`, `iam`, `leave`, `audit`. Không có foreign key chéo schema.
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
│   │   └── modules/
│   │       ├── identity/    xác thực token, map tài khoản ↔ nhân viên, role, guard
│   │       ├── organization/ phòng ban, chức danh, cây tổ chức
│   │       ├── employee/    hồ sơ, danh bạ, quy tắc phân quyền, trường nhạy cảm
│   │       ├── audit/       ghi/tra cứu audit log
│   │       └── leave/       entity + state machine (API ở tuần 8)
│   └── test/                e2e test
├── frontend/                React + Vite (TypeScript)
├── keycloak/realm-hr.json   realm "hr": client, role, 4 tài khoản demo
├── docs/                    openapi.yaml, CONVENTIONS.md, progress/ (kế hoạch + báo cáo tuần)
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

## Test

```bash
cd backend
npm test                     # unit test (state machine, phân quyền, mã hóa, cây tổ chức, cache)
npm run test:e2e             # e2e với DB thật: cần đã migrate + seed
```

## API hiện có (tuần 7)

Chi tiết: [docs/openapi.yaml](docs/openapi.yaml) hoặc Swagger. Mọi endpoint cần Bearer token, trừ `/health`.

| Method | Endpoint | Ai gọi được |
|---|---|---|
| GET | `/health` | Không cần đăng nhập |
| GET | `/me` | Mọi người |
| GET | `/employees?q=&dept=&page=&size=` | Mọi người (danh bạ) |
| GET | `/employees/{id}` (`?include=sensitive` cho HR) | Theo quyền |
| PATCH | `/employees/{id}` | Chính mình (phone, address), HR (mọi trường) |
| POST | `/employees` | HR |
| GET | `/employees/{id}/direct-reports` | Mọi người |
| GET | `/departments`, `/departments/tree`, `/departments/{id}` | Mọi người |
| GET | `/departments/{id}/members` | Mọi người |
| POST / PATCH | `/departments`, `/departments/{id}` | HR, Admin |
| GET | `/positions`, `/leave-types` | Mọi người |
| GET | `/leave-balances/me` | Mọi người |
| GET | `/audit-logs?entity=&entityId=&actor=&from=&to=` | HR, Admin |

## Kế hoạch và tiến độ

Kế hoạch 10 tuần, báo cáo từng tuần, quyết định kiến trúc và phần việc của từng thành viên: [docs/progress/](docs/progress/README.md).

## Quy ước làm việc

Xem [docs/CONVENTIONS.md](docs/CONVENTIONS.md): cấu trúc module, đặt tên, migration, quy trình branch → PR → review.
