# Tuần 7 – TV1 (Duong, nhóm trưởng): toàn bộ phần code nền tảng

Tuần 7 chỉ TV1 tham gia code; TV2, TV4, TV3 chưa có công việc hoàn thành. Từ tuần 8 nhóm điều chỉnh phân vai
(xem [ADR-11](README.md#adr-11--điều-chỉnh-phân-vai-cho-giai-đoạn-code)).

## Việc đã làm

| Phần | Việc | Output | Trạng thái |
|---|---|---|---|
| A | Chốt tech stack (ADR-04); khung modular monolith; quy ước code + quy trình PR; module Leave: entity + state machine | `backend/src/common/`, `docs/CONVENTIONS.md`, `.github/pull_request_template.md`, `backend/src/modules/leave/` | Xong (API Leave ở tuần 8) |
| B | Migration đầu tiên (5 schema, 11 bảng); module Employee, Organization, Audit; mã hóa trường nhạy cảm; OpenAPI | `backend/src/database/migrations/`, `backend/src/modules/`, `docs/openapi.yaml` | Xong |
| C | Frontend React + Vite: đăng nhập, hồ sơ, danh bạ, chi tiết nhân viên, sơ đồ tổ chức | `frontend/` | Xong |
| D | docker-compose; realm Keycloak; tích hợp OIDC; seed 2,000 nhân viên; README | `docker-compose.yml`, `keycloak/realm-hr.json`, `backend/src/database/seed.ts` | Xong |
| – | Map capability sang cloud service | – | Chưa làm: chờ chốt provider (chuyển cho TV3 tuần 8) |

## Phần A – Tech stack, khung dự án, quy ước code, module Leave

### 1. Khung dự án

```
backend/src/
├── main.ts, bootstrap.ts     khởi động API, prefix /api/v1, validation, Swagger
├── app.module.ts             ghép các module
├── health.controller.ts      GET /health cho load balancer
├── common/                   dùng chung cho mọi module
│   ├── api-error.filter.ts   mọi lỗi trả về {code, message, traceId}
│   ├── trace-id.middleware.ts gắn traceId cho mỗi request (header X-Trace-Id)
│   ├── pagination.ts         ?page=&size=, trả về {items, page, size, total}
│   ├── ttl-cache.ts          cache in-memory TTL (ADR-07)
│   └── field-crypto.ts       mã hóa AES-256-GCM (ADR-08)
├── config/                   đọc biến môi trường
├── database/                 data-source, migrations/, seed.ts
└── modules/                  identity, organization, employee, audit, leave
```

Quy tắc ranh giới module (chi tiết trong `docs/CONVENTIONS.md`):
1. Mỗi module một thư mục, một schema DB.
2. Không inject repository của module khác; chỉ gọi service mà module đó export.
3. Không foreign key chéo schema.
4. Thao tác nghiệp vụ và audit ghi trong cùng transaction.

Validation: mọi body và query đều có DTO kiểm tra bằng class-validator; trường lạ trong body bị từ chối (400).

### 2. Quy trình làm việc

- Nhánh `main` luôn chạy được, không push thẳng.
- Nhánh làm việc: `feat/<module>-<mo-ta>`, `fix/<mo-ta>`, `docs/<mo-ta>`.
- Commit theo Conventional Commits: `feat(leave): add approve endpoint`.
- Mỗi PR ít nhất 1 người review; PR đụng tới phân quyền, migration, kiến trúc thì TV1 review. Review trong 24 giờ.
- PR template có checklist: lint, cập nhật openapi, thử migration up/down, ảnh hưởng phân quyền.

### 3. Module Leave: state machine

File `leave-state-machine.ts` là hàm thuần (không đụng database), tách khỏi phần lưu dữ liệu. Tuần 8 gọi nó trong transaction rồi cập nhật bảng.

| Trạng thái hiện tại | Hành động | Ai được làm | Trạng thái mới | Thay đổi số dư |
|---|---|---|---|---|
| (tạo đơn) | submit | Nhân viên | SUBMITTED | pending + số ngày |
| SUBMITTED | approve | Quản lý trực tiếp | APPROVED | không đổi |
| SUBMITTED | reject | Quản lý trực tiếp | REJECTED | pending − số ngày |
| SUBMITTED | cancel | Người tạo đơn | CANCELLED | pending − số ngày |
| APPROVED | complete | HR | COMPLETED | pending − số ngày, used + số ngày |

Kết quả của mỗi lần gọi là một trong bốn loại:
- `changed`: chuyển trạng thái hợp lệ, kèm thay đổi số dư.
- `unchanged`: gửi lại cùng quyết định (bấm Duyệt hai lần) → trả kết quả cũ, không trừ phép lần nữa.
- `conflict` (409): quyết định ngược trạng thái hiện tại, ví dụ duyệt đơn đã bị từ chối.
- `forbidden` (403): người không đúng vai trò.

Số ngày nghỉ tính theo ngày làm việc, bỏ thứ 7 và chủ nhật (`workingDays`).

Entity đã có: `leave_type`, `leave_balance` (database chặn `used + pending > entitled`), `leave_request` (có `version`,
unique `employee_id + idempotency_key`), `leave_request_history`. Hai API đọc đã chạy: `GET /leave-types`, `GET /leave-balances/me`.

## Phần B – Migration, module Employee, Organization, Audit, OpenAPI

### 1. Database

| Schema | Bảng |
|---|---|
| org | department (parent_id tạo cây), position |
| employee | employee, employee_sensitive (chỉ chứa dữ liệu đã mã hóa) |
| iam | user_account, role_assignment |
| leave | leave_type, leave_balance, leave_request, leave_request_history |
| audit | audit_log |

Ràng buộc đặt trong database:
- `audit_log`: trigger chặn UPDATE và DELETE (ADR-09).
- `leave_balance`: `used + pending ≤ entitled`.
- `leave_request`: unique `(employee_id, idempotency_key)`; `end_date ≥ start_date`.
- `employee`: không tự làm quản lý của chính mình; `status` chỉ nhận ACTIVE, ON_LEAVE, TERMINATED.

Index: trigram trên tên + email + mã nhân viên (tìm được khi gõ một phần tên); `(employee_id, status)` và
`(approver_id, status)` cho đơn nghỉ; `(entity_type, entity_id, at)` cho audit.

Lệnh: `npm run migration:run`, `npm run migration:revert`.

### 2. API đã chạy

| Method | Endpoint | Ai gọi được |
|---|---|---|
| GET | /health | Không cần đăng nhập |
| GET | /me | Mọi người |
| GET | /employees?q=&dept=&page=&size= | Mọi người |
| GET | /employees/{id} (thêm ?include=sensitive) | Theo bảng phân quyền mục 3 |
| PATCH | /employees/{id} | Chính mình (SĐT, địa chỉ), HR |
| POST | /employees | HR |
| GET | /employees/{id}/direct-reports | Mọi người |
| GET | /departments, /departments/tree, /departments/{id}, /departments/{id}/members | Mọi người |
| POST, PATCH | /departments, /departments/{id} | HR, Admin |
| GET | /positions | Mọi người |
| GET | /audit-logs?entity=&entityId=&actor=&from=&to= | HR, Admin |

Mọi endpoint có tiền tố `/api/v1`. Thử trực tiếp ở Swagger: http://localhost:3000/api/docs.

### 3. Phân quyền trên hồ sơ

| Người xem | Thấy gì | Sửa được gì |
|---|---|---|
| Chính mình | Danh bạ + ngày sinh, địa chỉ, ngày vào làm, trạng thái | SĐT, địa chỉ |
| Quản lý trực tiếp | Như trên, với nhân viên trực thuộc | Không |
| Nhân viên khác, quản lý khác team | Chỉ thông tin danh bạ | Không |
| HR | Toàn bộ; trường nhạy cảm chỉ khi gọi `?include=sensitive`, mỗi lần đều ghi audit | Mọi trường |
| Admin | Chỉ thông tin danh bạ | Không |

Quy tắc viết thành hàm thuần trong `employee-access.ts`.

Các kiểm tra khác khi sửa hồ sơ:
- `version` cũ → 409 (optimistic locking).
- Gán quản lý tạo vòng lặp (A quản lý B, B quản lý A) → 400; kiểm tra bằng truy vấn đệ quy lên chuỗi quản lý.
- Đổi phòng ban cha tạo vòng lặp trong cây tổ chức → 400.

### 4. Audit

`AuditService.record(entry, manager)` được các module khác gọi trong cùng transaction. Các thao tác đang ghi audit:
tạo/sửa nhân viên, tạo/sửa phòng ban, HR xem trường nhạy cảm (`VIEW_SENSITIVE`). Khi sửa lương hay CCCD, audit chỉ ghi
tên trường với giá trị `***`. Mỗi dòng audit có `traceId` để đối chiếu với log của request.

## Phần C – Frontend

### 1. Màn hình

| Màn hình | Đường dẫn | Chức năng |
|---|---|---|
| Đăng nhập | / (khi chưa đăng nhập) | Chuyển sang Keycloak; chế độ dev thì chọn tài khoản demo |
| Hồ sơ của tôi | / | Xem hồ sơ, sửa SĐT và địa chỉ (gửi kèm `version`), xem số dư phép năm nay |
| Danh bạ | /directory | Tìm theo tên/email/mã (chờ 300 ms sau khi gõ mới gọi API), lọc phòng ban, phân trang 20 người/trang; bộ lọc nằm trên URL nên gửi link được |
| Chi tiết nhân viên | /employees/{id} | Hiện đúng mức thông tin theo quyền; HR có nút "Xem trường nhạy cảm (sẽ ghi audit)"; danh sách nhân viên trực thuộc |
| Sơ đồ tổ chức | /org | Cây phòng ban đóng/mở được; bấm phòng ban để xem thành viên, đánh dấu trưởng đơn vị |

Thanh trên cùng hiện tên người đăng nhập và các role (EMPLOYEE, MANAGER, HR, ADMIN).

### 2. Cách frontend gọi API

- `src/api/client.ts`: hàm `api()` tự gắn `Authorization: Bearer <token>`, đọc lỗi `{code, message, traceId}` và hiện cả
  traceId trên màn hình để báo lỗi cho backend dễ tra.
- `src/api/useApi.ts`: hook gọi API, trả về `data`, `error`, `loading`, `reload`.
- Token giữ trong sessionStorage (đóng tab là mất), tự gia hạn trước khi hết hạn.

### 3. Cấu hình

File `frontend/.env.example`, sao chép thành `.env.local`:

| Biến | Ý nghĩa |
|---|---|
| VITE_API_URL | Địa chỉ API, mặc định http://localhost:3000/api/v1 |
| VITE_AUTH_MODE | `oidc` (Keycloak) hoặc `dev` (chọn tài khoản demo, backend cũng phải `AUTH_MODE=dev`) |
| VITE_OIDC_AUTHORITY | http://localhost:8080/realms/hr |
| VITE_OIDC_CLIENT_ID | hr-web |

Chạy: `cd frontend && npm install && npm run dev` → http://localhost:5173.

## Phần D – docker-compose, Keycloak, đăng nhập OIDC, dữ liệu mẫu

### 1. Cách chạy

Cách nhanh (cần Docker Desktop):

1. `docker compose up -d --build`
2. `docker compose logs -f seed`, chờ dòng "Seed xong: … 2000 nhân viên".
3. Web http://localhost:5173 · API http://localhost:3000/api/v1 · Swagger http://localhost:3000/api/docs · Keycloak http://localhost:8080 (admin / admin).

Chạy từng phần để có hot reload:

```bash
docker compose up -d db keycloak
cd backend && cp .env.example .env && npm install
npm run migration:run && npm run seed
npm run start:dev
```

Xóa sạch và làm lại: `docker compose down -v`, hoặc chỉ dữ liệu: `npm run seed -- --reset`.

| Service | Image | Vai trò |
|---|---|---|
| db | postgres:16-alpine | Database, có healthcheck |
| keycloak | quay.io/keycloak/keycloak:26.0.7 | Identity provider, tự nạp realm khi khởi động |
| api | build từ backend/ | Chạy migration rồi khởi động API |
| seed | build từ backend/ | Chạy một lần sau khi API khỏe, nạp dữ liệu mẫu |
| web | build từ frontend/, chạy bằng nginx | Giao diện |

### 2. Keycloak

Realm `hr`:
- Client `hr-web`: public client, Authorization Code + PKCE (S256), redirect về http://localhost:5173.
- Client `hr-api-test`: chỉ để lấy token bằng username/password khi gọi API bằng curl/Postman; bỏ khi deploy.
- 4 realm role: employee, manager, hr, admin. Access token hết hạn sau 15 phút; bật chống dò mật khẩu.

Tài khoản demo, mật khẩu chung `Passw0rd!`:

| Username | Vai trò | Dùng để thử |
|---|---|---|
| employee | Nhân viên Trần Thị Nhân (Web Engineering) | Xem/sửa hồ sơ của mình; xem người khác chỉ thấy danh bạ |
| manager | Quản lý trực tiếp của employee | Xem thông tin cá nhân của nhân viên trực thuộc |
| hr | HR, phòng C&B | Xem trường nhạy cảm (có audit), sửa mọi trường, tạo phòng ban, xem audit |
| admin | Quản trị hệ thống | Xem audit; không xem dữ liệu cá nhân |

Lấy token để gọi API bằng curl:

```bash
curl -s -d client_id=hr-api-test -d grant_type=password -d username=hr -d password='Passw0rd!' \
  http://localhost:8080/realms/hr/protocol/openid-connect/token
```

### 3. Đăng nhập ở backend

1. Đọc `Authorization: Bearer <token>`.
2. Kiểm tra chữ ký bằng JWKS của Keycloak, issuer, hạn dùng, và client (`azp`) thuộc danh sách `OIDC_ALLOWED_CLIENTS`.
3. Tìm tài khoản theo `sub`, không có thì theo email công ty; lần đầu thì tự tạo và gắn với hồ sơ nhân viên cùng email.
4. Role = role trong token + role trong `role_assignment` + EMPLOYEE (có hồ sơ) + MANAGER (có nhân viên trực thuộc, ADR-10).

API gọi Keycloak qua mạng nội bộ Docker (`keycloak:8080`) nhưng token có issuer `localhost:8080`, nên cấu hình tách riêng
`OIDC_ISSUER` và `OIDC_JWKS_URI`. Khi lên cloud chỉ đổi hai biến này.

Chế độ `AUTH_MODE=dev`: token dạng `dev:<email>`, dùng khi không muốn bật Keycloak. Tự bị chặn khi `NODE_ENV=production`.

### 4. Dữ liệu mẫu

| Dữ liệu | Số lượng |
|---|---|
| Phòng ban | 25, cây 3 cấp, gốc là Ban Giám đốc; 3 văn phòng Hà Nội, TP.HCM, Đà Nẵng |
| Chức danh | 9, từ Thực tập sinh đến Tổng Giám đốc |
| Nhân viên | 2,000 tên tiếng Việt; 148 người có nhân viên trực thuộc; 26 người khối HR có role HR |
| Trường nhạy cảm | CCCD, số tài khoản, lương cho mọi người, đã mã hóa |
| Loại phép | 4: phép năm, ốm, cưới, không lương |
| Số dư phép 2026 | Phép năm = 12 ngày + 1 ngày mỗi 5 năm thâm niên; phép ốm 30 ngày |

Seed dùng số ngẫu nhiên cố định nên ai chạy cũng ra cùng dữ liệu; chạy lại khi đã có dữ liệu thì tự bỏ qua.
Nạp 2,000 nhân viên mất khoảng 1 giây.

### Vướng mắc

- Chưa chốt cloud provider, nên chưa map được capability sang dịch vụ cụ thể. Cần chốt trong tuần 8 để kịp deploy ở tuần 9.
