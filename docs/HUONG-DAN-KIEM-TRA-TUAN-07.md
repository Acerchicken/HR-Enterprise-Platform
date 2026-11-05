# Hướng dẫn kiểm tra toàn bộ hệ thống tuần 7 trên máy của bạn

Người làm: TV1 (Duong). Thời gian: khoảng 20–30 phút (lần đầu tải image mất thêm vài phút).

## Vì sao cần làm

Phần code tuần 7 đã được kiểm tra như sau. Bước còn thiếu là chạy **cả hệ thống có Keycloak** bằng Docker và đăng nhập thật
trên trình duyệt: máy kiểm tra không tải được image `quay.io/keycloak/keycloak:26.0.7` (bị chặn mạng), nên phần này cần
chạy trên máy bạn.

| Đã kiểm tra (27/10) | Kết quả |
|---|---|
| `npm run lint`, `npm run build` backend; `npm run build` frontend | Qua |
| Migration + seed trên PostgreSQL 16 | Qua: 25 phòng ban, 9 chức danh, 2,000 nhân viên (148 quản lý, 26 HR) |
| Test tự động có sẵn trong repo (unit + e2e) | Qua |
| Build image `backend/Dockerfile` và `frontend/Dockerfile` | Qua |
| `docker compose up` các service `db`, `api`, `seed`, `web` (không có Keycloak) | Qua: `db`, `api` healthy, `seed` chạy xong, web trả 200, `/api/v1/health` trả `{"status":"ok"}`, gọi API không có token trả 401 |
| `keycloak` trong docker-compose, đăng nhập OIDC trên trình duyệt | **Chưa kiểm tra được** → làm theo hướng dẫn này |

## Bước 0 – Chuẩn bị

- Cài và mở **Docker Desktop**, chờ biểu tượng chuyển sang "Engine running".
- Các cổng sau phải trống: `5432` (PostgreSQL), `8080` (Keycloak), `3000` (API), `5173` (web).
  Nếu máy đang chạy PostgreSQL riêng ở 5432 thì tắt nó đi trước.
- Mở terminal (PowerShell hoặc Git Bash) tại thư mục repo:

```bash
cd "D:\Git_repo\HR Enterprise"
git checkout dev
git pull
```

## Bước 1 – Chạy toàn bộ hệ thống

```bash
docker compose down -v          # xóa dữ liệu cũ nếu từng chạy (an toàn khi chạy lần đầu)
docker compose up -d --build
docker compose ps
```

Kết quả mong đợi sau 1–2 phút (`docker compose ps`):

| Service | Trạng thái |
|---|---|
| `db` | running (healthy) |
| `keycloak` | running. Lần đầu khởi động mất khoảng 30–60 giây; xem `docker compose logs keycloak` có dòng `Keycloak ... started` |
| `api` | running (healthy) |
| `seed` | exited (0) |
| `web` | running |

Xem seed đã xong chưa:

```bash
docker compose logs seed
```

Phải có dòng: `Seed xong: 25 phòng ban, 9 chức danh, 2000 nhân viên (148 quản lý, 26 HR), 3 văn phòng.`

## Bước 2 – Kiểm tra từng địa chỉ

| Mở | Kết quả mong đợi |
|---|---|
| http://localhost:3000/api/v1/health | `{"status":"ok"}` |
| http://localhost:3000/api/docs | Trang Swagger liệt kê các API |
| http://localhost:8080 | Trang Keycloak, đăng nhập `admin` / `admin` được; có realm **hr** |
| http://localhost:5173 | Trang web HR Platform, có nút đăng nhập |

## Bước 3 – Đăng nhập bằng 4 tài khoản demo

Mật khẩu chung: `Passw0rd!`. Sau mỗi tài khoản bấm **Đăng xuất** rồi mới đăng nhập tài khoản tiếp theo.

| Tài khoản | Làm gì | Kết quả mong đợi |
|---|---|---|
| `employee` | Đăng nhập, mở "Hồ sơ của tôi", sửa số điện thoại, mở danh bạ, bấm vào một người khác | Sửa số điện thoại được; danh bạ hiện danh sách; hồ sơ người khác chỉ có thông tin danh bạ, không có ngày sinh, địa chỉ, lương |
| `manager` | Mở hồ sơ của nhân viên "Trần Thị Nhân" | Xem được thông tin cá nhân (vì là quản lý trực tiếp), không thấy CCCD, số tài khoản, lương |
| `hr` | Mở hồ sơ một nhân viên, bấm xem trường nhạy cảm; mở sơ đồ tổ chức; tìm "nguyen" trong danh bạ | Thấy CCCD, số tài khoản, lương; sơ đồ tổ chức hiện cây phòng ban; tìm kiếm có kết quả |
| `admin` | Mở hồ sơ một nhân viên | Chỉ thấy thông tin danh bạ |

Kiểm tra audit: đăng nhập `hr`, gọi `GET /api/v1/audit-logs` trong Swagger (bấm **Authorize** và dán token, hoặc xem
trên giao diện nếu có). Phải có dòng `VIEW_SENSITIVE` cho lần xem trường nhạy cảm ở trên.

## Bước 4 – Ghi kết quả

- Tất cả đúng như bảng: không cần sửa báo cáo tuần 7. Nhắn Claude để xóa dòng "Chưa kiểm tra được" trong file này
  hoặc xóa luôn file hướng dẫn.
- Có lỗi: chụp màn hình hoặc copy log (`docker compose logs <service>`), mở issue trên GitHub hoặc gửi cho Claude để sửa
  trên một nhánh `fix/...` tách từ `dev`.

## Lỗi thường gặp

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `bind: address already in use` / `port is already allocated` | Cổng 5432, 8080, 3000 hoặc 5173 đang bị chương trình khác dùng | Tắt chương trình đó, hoặc đổi cổng bên trái trong `ports:` của `docker-compose.yml` (ví dụ `"5433:5432"`) |
| `api` khởi động lại liên tục | Database chưa sẵn sàng hoặc thiếu biến môi trường | `docker compose logs api`, xem dòng lỗi đầu tiên |
| Đăng nhập xong quay về web báo lỗi 401 | Keycloak chưa khởi động xong khi API kiểm tra token, hoặc đồng hồ máy lệch | Chờ `keycloak` healthy rồi tải lại trang; đồng bộ giờ Windows |
| Trang Keycloak báo "Invalid redirect uri" | Mở web bằng địa chỉ khác `http://localhost:5173` (ví dụ `127.0.0.1`) | Mở đúng `http://localhost:5173` |
| Build image báo `sh: tsc: not found` | `npm ci` trong Docker không tải được package (mạng, proxy, VPN) | Tắt VPN/proxy rồi chạy lại `docker compose build --no-cache` |
| `seed` báo "Đã có 2000 nhân viên, bỏ qua" | Dữ liệu từ lần chạy trước còn trong volume | Bình thường. Muốn làm lại từ đầu: `docker compose down -v` |

## Dừng hệ thống

```bash
docker compose down        # dừng, giữ dữ liệu
docker compose down -v     # dừng và xóa dữ liệu
```
