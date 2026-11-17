# UC8 – Đăng nhập và tài khoản: kiểm thử

> Tiêu chí: [`requirements.md`](requirements.md). Cách chạy chung: [README](../README.md#kiểm-thử).

## 1. Chiến lược

- **Unit:** đọc claim Keycloak và Cognito, driver `IdentityProviderAdmin` (mock SDK, mock HTTP), consumer `identity-sync`
  idempotent, hook tự đăng xuất.
- **e2e (API):** gắn tài khoản theo `sub` và email đã xác minh, 401, 403 khi `TERMINATED`, API gửi lại lời mời chỉ HR.
- **Tay, cả hai môi trường:** mọi phần chạy trên trang của IdP (đăng nhập, khóa, quên mật khẩu, MFA) vì không tự động hóa được dễ
  dàng. Chạy trên local và staging, ghi môi trường vào biên bản.
- **Rủi ro chính:** cấu hình khác nhau giữa Keycloak và Cognito (ADR-17 mục Trade-off); gắn nhầm tài khoản theo email chưa xác
  minh (T-02); tài khoản người nghỉ việc vẫn mở.

## 2. Test tự động đã có

| Mức | File | Nội dung |
|---|---|---|
| Unit | `backend/src/modules/identity/token-verifier.spec.ts` | Đọc claim Keycloak (`azp`, `realm_access.roles`) và Cognito (`client_id`, `cognito:groups`), chỉ nhận access token |
| Unit | `backend/src/config/config.spec.ts` | Cấu hình `AUTH_MODE`, issuer, JWKS |
| e2e | `backend/test/app.e2e-spec.ts` | 401 khi không có token, token sai; 403 người đã nghỉ việc |

## 3. Bảng phủ tiêu chí

| Tiêu chí | Test tự động | Ca kiểm thử tay | Trạng thái |
|---|---|---|---|
| AC-8.1.1, 8.1.2 | – | Đăng nhập 4 tài khoản demo (biên bản tuần 8) | Có ở local; chưa ở staging |
| AC-8.1.3, 8.1.4 | – | Ca bảo mật khóa sau 5 lần sai | Chưa |
| AC-8.1.5 | – | Biên bản tuần 8, dòng 10 | Có ở local |
| AC-8.1.6 | Unit hook tự đăng xuất | Để yên 30 phút | Chưa |
| AC-8.1.7 → 8.1.9 | – | Review Terraform, `describe-user-pool-client`, tìm nút Đăng ký | Chưa |
| AC-8.2.x | – | Quên mật khẩu, email không tồn tại, mật khẩu yếu | Chưa |
| AC-8.3.x | Unit consumer, e2e tạo hồ sơ sinh event | HR tạo nhân viên, nhận thư mời, đổi mật khẩu tạm | Chưa |
| AC-8.4.1 | e2e `TERMINATED` → 403 | – | Có |
| AC-8.4.2, 8.4.3 | Unit consumer | Cho nghỉ việc rồi đăng nhập lại; khôi phục | Chưa |
| AC-8.5.x | – | HR, ADMIN bị hỏi TOTP; nhân viên (local) không bị hỏi | Chưa |
| AC-8.6.x | e2e quyền gửi lại lời mời | Xem trạng thái, gửi lại | Chưa |

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
