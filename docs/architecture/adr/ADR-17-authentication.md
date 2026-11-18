# ADR-17 – Đăng nhập, MFA, quên mật khẩu và vòng đời tài khoản qua identity provider managed

| Mục | Nội dung |
|---|---|
| Trạng thái | Đề xuất (Duong chọn phạm vi "đủ bộ, chưa có SSO" ngày 17/11/2026) |
| Ngày quyết định | Ngày merge PR |
| Thời điểm | Tuần 11 (16/11 – 22/11/2026) |
| Người viết | TV1 (Dương) |
| Góc nhìn | Cả hai |
| ADR liên quan | ADR-00, ADR-03, ADR-04, ADR-10, ADR-12, ADR-15 |
| Yêu cầu liên quan | NFR-5.1 → NFR-5.10, FR-1.7, FR-8.1 → FR-8.6 (UC8), UC7 AC-7.4.1 (SRS) |

## Lịch sử thay đổi

- 17/11/2026: bản đề xuất đầu tiên. Đặc tả chi tiết: [`docs/features/UC8-authentication/`](../../features/UC8-authentication/requirements.md).

## Nội dung quyết định

**Bối cảnh:**

Đăng nhập đã có từ tuần 7 – 9 (ADR-04, ADR-12): web đăng nhập OIDC Authorization Code + PKCE bằng `oidc-client-ts`, token chỉ ở
`sessionStorage`; API kiểm chữ ký bằng JWKS và đọc được token của cả Keycloak (local) lẫn Cognito (staging). Kế hoạch tuần 10 – 11
đã giao `infra/idp-hardening` và `infra/idp-mfa` cho TV3. Rà lại ngày 17/11/2026 (trên `dev` sau PR #94) thấy các điểm chưa ai nhận:

| # | Vấn đề | Ảnh hưởng |
|---|---|---|
| 1 | `callback_urls` của Cognito chỉ có `/`, web chuyển về `/callback` | Lên staging thì đăng nhập lỗi `redirect_mismatch` |
| 2 | App client Cognito bật `ALLOW_USER_PASSWORD_AUTH` | Mở đường gửi mật khẩu thẳng tới Cognito, trái NFR-5.1 |
| 3 | Chưa có quên mật khẩu | Người quên mật khẩu phải nhờ ADMIN đặt lại bằng tay |
| 4 | HR thêm nhân viên thì không ai tạo tài khoản đăng nhập; nghỉ việc thì tài khoản trên IdP vẫn mở | Phải tạo, khóa tay trên console; FR-1.7 mới chặn ở API |
| 5 | Cognito không bắt MFA theo nhóm; chỉ có tắt, tùy chọn, hoặc bắt buộc cả pool | NFR-5.4 không làm đúng nguyên văn trên Cognito |
| 6 | Cognito không có "hết phiên sau 30 phút không thao tác", không chỉnh được ngưỡng khóa 5 lần | NFR-5.3, NFR-5.5 khác giữa local và staging |
| 7 | Chưa ghi sự kiện đăng nhập (NFR-5.10, AC-7.4.1) | Không truy được ai đăng nhập lúc nào |

Ràng buộc: managed service cho identity (ADR-00); ngân sách AWS ~50 USD/tháng, biên còn ~3 USD (ADR-12); feature freeze 2/12/2026;
một người code (ADR-11).

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | IdP managed, trang đăng nhập của IdP, vòng đời tài khoản qua event | Giữ Keycloak (local) và Amazon Cognito gói Essentials (staging). Đăng nhập, MFA, quên mật khẩu dùng trang Managed Login của Cognito và trang đăng nhập Keycloak. Khi HR tạo hoặc cho nghỉ việc nhân viên, API phát event qua outbox, SNS, SQS; worker gọi Admin API của IdP để tạo, khóa tài khoản |
| B | Tự chạy Keycloak trên AWS | Một Keycloak cho cả local và staging: task ECS Fargate + database trong RDS. Mọi tính năng giống hệt hai môi trường |
| C | Tự làm đăng nhập trong NestJS | Passport local, băm mật khẩu bcrypt, API tự ký JWT, tự làm MFA TOTP, khóa tài khoản, email đặt lại mật khẩu |

**Tiêu chí lựa chọn** (điểm 1–5, không trọng số):

| Tiêu chí | A | B | C |
|---|---|---|---|
| Đạt NFR-5.1 → 5.10 (OWASP ASVS mức 2) | 4 | 5 | 2 |
| Chi phí AWS thêm mỗi tháng | 5 | 2 | 5 |
| Công sức trước 2/12 với một người code | 4 | 3 | 1 |
| Đúng ADR-00 (managed service cho identity) | 5 | 2 | 1 |
| Giống nhau giữa local và staging | 3 | 5 | 5 |
| Thể hiện được dịch vụ cloud khi bảo vệ đồ án | 5 | 3 | 2 |
| **Tổng điểm** | **26** | **20** | **16** |

B tốn thêm một task Fargate (~0,5 vCPU, 1 GB, khoảng 15 – 18 USD/tháng nếu chạy 24/7), vượt hạn mức thẻ. C buộc ứng dụng nhận và
lưu mật khẩu, trái NFR-5.1 và là phần dễ sai nhất về bảo mật.

**Giải pháp được chọn:** A. Chi tiết từng phần:

1. **Luồng đăng nhập (giữ nguyên, sửa cấu hình).** OIDC Authorization Code + PKCE S256, client public, không client secret trong
   trình duyệt. Trang đăng nhập là của IdP (Cognito Managed Login có logo HRHelper; theme Keycloak), ứng dụng không có form mật khẩu.
   Sửa trong `infra/idp-hardening`: thêm `/callback` vào `callback_urls`, bỏ `ALLOW_USER_PASSWORD_AUTH` và `ALLOW_USER_SRP_AUTH`
   (chỉ giữ `ALLOW_REFRESH_TOKEN_AUTH`, vì đăng nhập đi qua Managed Login), đặt gói `ESSENTIALS` cho user pool.
2. **MFA bằng ứng dụng TOTP.**
   - Keycloak (local): luồng đăng nhập có bước OTP có điều kiện (Conditional OTP) bắt với role `hr`, `admin`; nhân viên tự bật.
     Đúng nguyên văn NFR-5.4, dùng để demo.
   - Cognito (staging): `mfa_configuration = "ON"`, chỉ bật TOTP (không SMS để không tốn tiền và không cần số điện thoại). Mọi tài
     khoản phải đăng ký TOTP ở lần đăng nhập đầu. Staging chỉ có tài khoản demo nên không vướng người dùng thật.
     Cognito chỉ cho đặt `ON` lúc tạo user pool, nên phải khai báo trước lần `apply` đầu tiên (staging tạo T3 24/11).
   - Chốt câu hỏi số 2 ở SRS mục 8 theo hướng này. Nếu sau này cần đúng "chỉ HR, ADMIN bắt buộc" trên Cognito thì để pool ở
     `OPTIONAL` và API trả `403 MFA_REQUIRED` cho token có nhóm `hr`, `admin` mà tài khoản chưa bật TOTP; việc này để sau freeze.
3. **Quên mật khẩu: dùng chức năng sẵn có của IdP, không code.** Cognito khôi phục qua email đã xác minh
   (`account_recovery_setting`: `verified_email`), gửi bằng Amazon SES (cùng identity với notification service, ADR-15) thay cho
   email mặc định giới hạn 50 thư/ngày. Keycloak bật `resetPasswordAllowed`, gửi qua Mailpit. Thông báo sau khi bấm gửi luôn giống
   nhau dù email có tồn tại hay không.
4. **Vòng đời tài khoản qua event (ADR-03, ADR-15).**
   - Khi HR tạo hồ sơ, API ghi event `employee.created` vào outbox trong cùng giao dịch. Relay đẩy lên SNS `hr-events`; queue SQS
     `identity-sync` lọc các event `employee.created`, `employee.terminated`, `employee.reinstated`.
   - Consumer `identity-sync` chạy trong worker của lõi (không phải service mới) gọi Admin API qua interface `IdentityProviderAdmin`
     có hai driver `keycloak` và `cognito`, chọn bằng `IDP_ADMIN_DRIVER` (giống `QUEUE_DRIVER`).
   - Tạo: Cognito `AdminCreateUser` (email đã xác minh, gửi thư mời kèm mật khẩu tạm 7 ngày, bắt đổi lần đầu); Keycloak tạo user
     với `requiredActions` đổi mật khẩu và gửi thư qua `execute-actions-email`.
   - Nghỉ việc: `AdminDisableUser` và `AdminUserGlobalSignOut` (thu hồi refresh token). Access token còn hạn tối đa 15 phút vẫn bị
     API chặn 403 nhờ kiểm trạng thái `TERMINATED` đã có (FR-1.7).
   - Mỗi lệnh idempotent; lỗi thì SQS gửi lại, quá 5 lần vào DLQ. Trạng thái đồng bộ lưu ở `iam.user_account.idp_status` để HR
     xem và gửi lại lời mời.
   - Quyền tối thiểu: role IAM của worker chỉ có các lệnh `cognito-idp:Admin*` cần dùng, giới hạn theo ARN của user pool.
5. **Phiên làm việc.** Cognito: access token và ID token 15 phút, refresh token 10 giờ. Phần "30 phút không thao tác" mà Cognito
   không có thì web tự đăng xuất sau 30 phút không có thao tác chuột, bàn phím (áp dụng cả hai môi trường cho thống nhất).
6. **Ghi sự kiện đăng nhập (NFR-5.10, AC-7.4.1, nhánh `infra/idp-auth-events`).** Cognito: Lambda trigger Post-authentication
   đẩy `auth.login_succeeded` lên SNS `hr-events`, audit consumer ghi vào `audit.audit_log`. Keycloak: bật event của realm
   (`LOGIN`, `LOGIN_ERROR`, `UPDATE_PASSWORD`, `UPDATE_TOTP`); worker đọc qua Admin API mỗi phút và ghi audit.
7. **Không làm SSO với Google Workspace hay Microsoft Entra ID trước freeze.** Hướng mở rộng: Cognito federation (OIDC/SAML)
   hoặc Keycloak identity brokering, liên kết theo email công ty đã xác minh (T-02).

**Triển khai trên AWS** (region ap-southeast-1, theo ADR-12):

| Thành phần | Dịch vụ | Chi phí thêm |
|---|---|---|
| Trang đăng nhập, MFA, quên mật khẩu | Cognito user pool gói Essentials + Managed Login | 0 (miễn phí dưới 10.000 MAU) |
| Email mời, đặt lại mật khẩu | Amazon SES | ~0 (vài chục thư) |
| Tạo, khóa tài khoản | SNS `hr-events` → SQS `identity-sync` → worker (ECS Fargate đã có) | ~0 (trong free tier) |
| Ghi đăng nhập | Lambda Post-authentication → SNS | ~0 (trong free tier) |
| Web | S3 + CloudFront (đã có) | 0 |
| API kiểm token | App Runner (đã có), lấy JWKS qua NAT | 0 |

**Trade-off:**

- Local và staging khác nhau ở ba điểm: MFA (theo role và cả pool), ngưỡng khóa (Keycloak 5 lần/15 phút, Cognito tự tăng thời gian
  chờ và không chỉnh được), ghi lần đăng nhập thất bại (Cognito gói Essentials chỉ ghi được lần thành công; xuất log đầy đủ cần gói
  Plus). Giảm thiểu: ghi rõ trong `deploy.md`, ca kiểm thử chạy cả hai môi trường, demo phần khác biệt bằng Keycloak.
- Vòng đời tài khoản bất đồng bộ: có độ trễ vài giây giữa lúc HR tạo hồ sơ và lúc email mời tới; IdP lỗi thì tài khoản ở
  `FAILED` để HR gửi lại. Đổi lại API không phụ thuộc IdP khi lưu hồ sơ.
- Trang đăng nhập của IdP khó chỉnh giao diện bằng form tự làm. Chấp nhận vì ứng dụng không phải giữ mật khẩu.

**Tiêu chí nghiệm thu:**

- Đăng nhập trên staging bằng 4 tài khoản demo thành công (hết lỗi `redirect_mismatch`); app client không còn `ALLOW_USER_PASSWORD_AUTH`.
- HR, ADMIN đăng nhập phải nhập mã TOTP ở cả hai môi trường; nhân viên trên Keycloak không bị hỏi nếu chưa tự bật.
- "Quên mật khẩu" gửi được email và đặt lại được mật khẩu ở cả hai môi trường.
- HR tạo nhân viên mới thì trong 1 phút người đó nhận email mời và đăng nhập được; cho nghỉ việc thì trong 1 phút không đăng nhập
  lại được và refresh token bị thu hồi.
- `audit.audit_log` có bản ghi đăng nhập thành công (cả hai môi trường) và thất bại (local).
- Các tiêu chí `AC-8.x.y` trong [`requirements.md`](../../features/UC8-authentication/requirements.md) có ca kiểm thử.

**Khi nào xem lại:**

- Cần MFA đúng theo vai trò trên Cognito, hoặc cần ghi lần đăng nhập thất bại trên AWS (cân nhắc gói Plus hoặc kiểm `MFA_REQUIRED` ở API).
- Doanh nghiệp dùng có sẵn Google Workspace hoặc Entra ID và muốn SSO.
- Chi phí Cognito vượt 0 USD (vượt 10.000 MAU) hoặc AWS bị thay bằng Azure theo phương án dự phòng của ADR-12 (khi đó dùng
  Microsoft Entra External ID với cùng luồng OIDC).
