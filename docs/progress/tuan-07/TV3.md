# Tuần 7 – TV3: Frontend

## Việc đã làm

| Việc | Output | Trạng thái |
|---|---|---|
| Khung frontend React + Vite (TypeScript) | `frontend/` | Xong |
| Đăng nhập OIDC (Authorization Code + PKCE) | `frontend/src/auth/auth.tsx` | Xong |
| Màn hình hồ sơ, danh bạ, chi tiết nhân viên, sơ đồ tổ chức | `frontend/src/pages/` | Xong |

## 1. Màn hình

| Màn hình | Đường dẫn | Chức năng |
|---|---|---|
| Đăng nhập | / (khi chưa đăng nhập) | Chuyển sang Keycloak; chế độ dev thì chọn tài khoản demo |
| Hồ sơ của tôi | / | Xem hồ sơ, sửa SĐT và địa chỉ (gửi kèm `version`), xem số dư phép năm nay |
| Danh bạ | /directory | Tìm theo tên/email/mã (chờ 300 ms sau khi gõ mới gọi API), lọc phòng ban, phân trang 20 người/trang; bộ lọc nằm trên URL nên gửi link được |
| Chi tiết nhân viên | /employees/{id} | Hiện đúng mức thông tin theo quyền; HR có nút "Xem trường nhạy cảm (sẽ ghi audit)"; danh sách nhân viên trực thuộc |
| Sơ đồ tổ chức | /org | Cây phòng ban đóng/mở được; bấm phòng ban để xem thành viên, đánh dấu trưởng đơn vị |

Thanh trên cùng hiện tên người đăng nhập và các role (EMPLOYEE, MANAGER, HR, ADMIN).

## 2. Cách frontend gọi API

- `src/api/client.ts`: hàm `api()` tự gắn `Authorization: Bearer <token>`, đọc lỗi `{code, message, traceId}` và hiện cả
  traceId trên màn hình để báo lỗi cho backend dễ tra.
- `src/api/useApi.ts`: hook gọi API, trả về `data`, `error`, `loading`, `reload`.
- Token giữ trong sessionStorage (đóng tab là mất), tự gia hạn trước khi hết hạn.

## 3. Cấu hình

File `frontend/.env.example`, sao chép thành `.env.local`:

| Biến | Ý nghĩa |
|---|---|
| VITE_API_URL | Địa chỉ API, mặc định http://localhost:3000/api/v1 |
| VITE_AUTH_MODE | `oidc` (Keycloak) hoặc `dev` (chọn tài khoản demo, backend cũng phải `AUTH_MODE=dev`) |
| VITE_OIDC_AUTHORITY | http://localhost:8080/realms/hr |
| VITE_OIDC_CLIENT_ID | hr-web |

Chạy: `cd frontend && npm install && npm run dev` → http://localhost:5173.

## 4. Kiểm thử

Đã thử bằng trình duyệt với Keycloak thật, tài khoản `hr`: đăng nhập, tìm "nguyen" trong danh bạ (128 kết quả), mở hồ sơ,
xem trường nhạy cảm, mở sơ đồ tổ chức, sửa số điện thoại. Không có lỗi trên console.

## Việc mang sang tuần 8

Màn hình tạo đơn, đơn của tôi, duyệt đơn (manager), xử lý đơn (HR), tra cứu audit (HR).
