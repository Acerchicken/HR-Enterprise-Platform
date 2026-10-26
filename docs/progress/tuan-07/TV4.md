# Tuần 7 – TV4: docker-compose, Keycloak, đăng nhập OIDC, dữ liệu mẫu

## Việc đã làm

| Việc | Output | Trạng thái |
|---|---|---|
| docker-compose chạy toàn bộ hệ thống | `docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile` | Xong |
| Realm Keycloak | `keycloak/realm-hr.json` | Xong |
| Tích hợp OIDC ở backend | `backend/src/modules/identity/` | Xong |
| Seed 2,000 nhân viên | `backend/src/database/seed.ts` | Xong |
| Hướng dẫn chạy | README của repo + mục 1 bên dưới | Xong |
| Map capability sang cloud service | – | Chưa làm: chờ chốt provider |

## 1. Cách chạy

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

## 2. Keycloak

Realm `hr`:
- Client `hr-web`: public client, Authorization Code + PKCE (S256), redirect về http://localhost:5173.
- Client `hr-api-test`: chỉ để lấy token bằng username/password khi test bằng curl/Postman; bỏ khi deploy.
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

## 3. Đăng nhập ở backend

1. Đọc `Authorization: Bearer <token>`.
2. Kiểm tra chữ ký bằng JWKS của Keycloak, issuer, hạn dùng, và client (`azp`) thuộc danh sách `OIDC_ALLOWED_CLIENTS`.
3. Tìm tài khoản theo `sub`, không có thì theo email công ty; lần đầu thì tự tạo và gắn với hồ sơ nhân viên cùng email.
4. Role = role trong token + role trong `role_assignment` + EMPLOYEE (có hồ sơ) + MANAGER (có nhân viên trực thuộc, QĐ-06).

API gọi Keycloak qua mạng nội bộ Docker (`keycloak:8080`) nhưng token có issuer `localhost:8080`, nên cấu hình tách riêng
`OIDC_ISSUER` và `OIDC_JWKS_URI`. Khi lên cloud chỉ đổi hai biến này.

Chế độ `AUTH_MODE=dev`: token dạng `dev:<email>`, dùng khi không muốn bật Keycloak và cho e2e test. Tự bị chặn khi `NODE_ENV=production`.

## 4. Dữ liệu mẫu

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

## Vướng mắc

- Chưa chốt cloud provider, nên chưa map được capability sang dịch vụ cụ thể. Cần chốt trong tuần 8 để kịp deploy ở tuần 9.

## Việc mang sang tuần 8

RabbitMQ trong docker-compose; worker Notification gửi email qua Mailpit, retry + dead-letter queue, bỏ qua event trùng;
chốt cloud provider và bảng mapping.
