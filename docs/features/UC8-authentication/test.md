# UC8 – Đăng nhập và tài khoản: kiểm thử

> Tiêu chí: [`requirements.md`](requirements.md). Cách chạy chung: [README](../README.md#kiểm-thử).

## 1. Chiến lược

- **Unit:** đọc claim Keycloak và Cognito, driver `IdentityProviderAdmin` (mock SDK, mock HTTP), consumer `identity-sync`
  idempotent, hook tự đăng xuất.
- **e2e (API):** gắn tài khoản theo `sub` và email đã xác minh, 401, 403 khi `TERMINATED`, API gửi lại lời mời chỉ HR; token có
  nhóm `hr` nhưng database không thì 403; API cấp, thu hồi vai trò (mỗi lỗi E10 → E14 một ca; audit; outbox có event).
- **Tay, cả hai môi trường:** mọi phần chạy trên trang của IdP (đăng nhập, khóa, quên mật khẩu, MFA) vì không tự động hóa được dễ
  dàng. Chạy trên local và staging, ghi môi trường vào biên bản.
- **Rủi ro chính:** cấu hình khác nhau giữa Keycloak và Cognito (ADR-17 mục Trade-off); gắn nhầm tài khoản theo email chưa xác
  minh (T-02); tài khoản người nghỉ việc vẫn mở.

## 2. Test tự động đã có

| Mức | File | Nội dung |
|---|---|---|
| Unit | `backend/src/modules/identity/token-verifier.spec.ts` | Đọc claim Keycloak (`azp`, `email`) và Cognito (`client_id`, email qua userinfo), không đọc nhóm; chỉ nhận access token |
| Unit | `backend/src/modules/identity/identity.service.spec.ts` | Vai trò chỉ từ database: nhóm trong token bị bỏ qua; dòng `MANAGER` cũ bị bỏ qua; MANAGER khi có cấp dưới; `TERMINATED` → 403 |
| Unit | `backend/src/config/config.spec.ts` | Cấu hình `AUTH_MODE`, issuer, JWKS |
| e2e | `backend/test/app.e2e-spec.ts` | 401 khi không có token, token sai; 403 người đã nghỉ việc |
| Unit | `backend/src/worker/identity-sync.spec.ts` | Mỗi event → thao tác IdP và trạng thái mới; gửi lại thư khi đang `INVITED`; thử lại lỗi tạm thời; hết lượt ghi `FAILED`, audit, ném lỗi; lỗi cố định không thử lại |
| Unit | `backend/src/modules/identity/idp-admin/keycloak-admin.spec.ts` | Admin REST giả: tạo, gán role, thư `UPDATE_PASSWORD` 7 ngày; đã có thì không tạo, không gửi thư; dùng lại token; phân loại lỗi tạm thời, cố định |
| e2e | `app.e2e-spec.ts`, describe `UC8 FR-8.3, FR-8.6` (6 ca) | Tạo hồ sơ → tài khoản `PENDING`, event `EmployeeCreated`; chỉ HR xem, gửi lời mời; 409, 400, 404; `FAILED` → gửi lại; `NONE` → tạo tài khoản; nghỉ việc, khôi phục, đổi email sinh event |
| Tay (đã chạy 18/11) | Driver `keycloak` với Keycloak 26.0.7 thật | Tạo (thư vào Mailpit), tạo lại (không trùng), gắn tài khoản demo, gửi lại thư, thêm, bỏ nhóm `hr`, khóa, đăng xuất mọi phiên, mở, đổi email, người không tồn tại → `IDP_USER_NOT_FOUND` |
| Tay (đã chạy 18/11) | Web, `VITE_AUTH_MODE=dev`, `VITE_IDLE_TIMEOUT_MINUTES=1.5` | Dòng "Tài khoản đăng nhập" của HR; hộp "Phiên sắp hết", tự đăng xuất, trang "Phiên đã hết"; `/callback` sai `state` hiện "Đăng nhập không thành công" |

## 3. Bảng phủ tiêu chí

| Tiêu chí | Test tự động | Ca kiểm thử tay | Trạng thái |
|---|---|---|---|
| AC-8.1.1, 8.1.2 | – | Đăng nhập 4 tài khoản demo (biên bản tuần 8) | Có ở local; chưa ở staging |
| AC-8.1.3, 8.1.4 | – | Ca bảo mật khóa sau 5 lần sai | Chưa |
| AC-8.1.5 | – | Biên bản tuần 8, dòng 10 | Có ở local |
| AC-8.1.6 | – (web chưa có bộ test unit) | Để yên 30 phút (đặt `VITE_IDLE_TIMEOUT_MINUTES=2` để thử nhanh); mở hai tab, bấm "Tiếp tục" ở một tab | Có ở local (chạy tay 18/11, một tab) |
| AC-8.1.7 → 8.1.9 | – | Review Terraform, `describe-user-pool-client`, tìm nút Đăng ký | Chưa |
| AC-8.2.x | – | Quên mật khẩu, email không tồn tại, mật khẩu yếu | Chưa |
| AC-8.3.x | Unit `identity-sync.spec.ts`, `keycloak-admin.spec.ts`; e2e tạo hồ sơ sinh event | HR tạo nhân viên, nhận thư mời, đặt mật khẩu qua link | Tự động có; tay qua docker-compose chưa (driver đã chạy với Keycloak thật) |
| AC-8.4.1 | e2e `TERMINATED` → 403 | – | Có |
| AC-8.4.2, 8.4.3 | Unit `identity-sync.spec.ts`; e2e nghỉ việc, khôi phục sinh event | Cho nghỉ việc rồi đăng nhập lại; khôi phục | Tự động có; tay chưa |
| AC-8.5.x | – | HR, ADMIN bị hỏi TOTP; nhân viên (local) không bị hỏi | Chưa |
| AC-8.1.10 | Unit `identity.service.spec.ts` (token có `hr`, `manager`, `admin` mà database không có → chỉ `EMPLOYEE`) | Đăng nhập `manager@hr.local` sau khi import lại realm: vẫn là MANAGER nhờ có cấp dưới | Có |
| AC-8.1.11 | – | Sửa `state` trong URL `/callback` | Có ở local (chạy tay 18/11) |
| AC-8.3.6 | e2e đổi email đổi `iam.user_account.email`, sinh `EmployeeEmailChanged`; driver đổi email trên Keycloak thật | Đổi email, đăng nhập bằng email mới | Tự động có; tay chưa |
| AC-8.6.x | e2e `UC8 FR-8.3, FR-8.6` | Xem trạng thái, gửi lại | Có |
| AC-8.7.1 → 8.7.7 | e2e `UC8 FR-8.7` trong `app.e2e-spec.ts` (5 ca); unit `role-access.spec.ts` | ADMIN cấp HR rồi người đó đăng nhập lại bị hỏi TOTP (cần `identity-sync`) | Có; đồng bộ nhóm: unit `identity-sync.spec.ts`; TOTP chờ `infra/idp-mfa` |
| AC-8.7.8 | e2e lọc theo vai trò, tìm theo email | Trang Phân quyền | Có |

## 4. Dữ liệu và tài khoản

`employee@hr.local`, `manager@hr.local`, `hr@hr.local`, `admin@hr.local`. Local mật khẩu `Passw0rd!` (đạt NFR-5.2); staging lấy từ
Secrets Manager. Cần một ứng dụng TOTP (Google Authenticator, Microsoft Authenticator) cho tài khoản HR, ADMIN. Nhân viên thử tạo
mới dùng email đã xác minh trên SES khi chạy staging.

## 5. Cách chạy

Unit, e2e theo README chung. Ca tay: local `docker compose up -d --build`, Mailpit ở `http://localhost:8025`; staging theo
[`deploy.md`](deploy.md) mục 5.

## 6. Kiểm thử phi chức năng

- NFR-5.7: mở DevTools, token chỉ trong `sessionStorage`, không có trong `localStorage`, URL sau `/callback`.
- NFR-5.5: giải mã access token, `exp - iat` = 900 giây.
- AC-8.3.1: đo thời gian từ lúc HR lưu tới lúc thư mời tới (≤ 1 phút).

## 7. Ca còn thiếu (TV4)

Toàn bộ ca tay ở mục 3 cột "Chưa", nhánh `docs/test-cases-uc8` (tuần 12). Ca MFA, khóa, tự đăng ký đã giao ở
`docs/security-test-cases-week11` thì dẫn chiếu sang, không viết lại.
