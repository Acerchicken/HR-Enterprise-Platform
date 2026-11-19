# UC8 – Đăng nhập và tài khoản

| Mục | Nội dung |
|---|---|
| Mục tiêu kinh doanh | MT-3 (bảo vệ dữ liệu nhân sự), hỗ trợ MT-1 (BRD) |
| Tác nhân chính | Nhân viên (mọi vai trò), HR |
| Tác nhân phụ, hệ thống ngoài | Identity provider (Keycloak local, Amazon Cognito staging), dịch vụ email (Mailpit, Amazon SES), ADMIN |
| Yêu cầu (SRS) | FR-8.1 → FR-8.6; NFR-5.1 → NFR-5.10 |
| Quy tắc | ADR-17, ADR-03, ADR-15, ADR-10; threat model T-02, T-03, T-06 |
| Mức ưu tiên | M (FR-8.6 là S) |
| Trạng thái | Một phần: đăng nhập, đăng xuất đã có; còn lại kế hoạch tuần 11 – 12 |
| Phiên bản | 1.0 – 17/11/2026 |

## 1. Mô tả ngắn

Người dùng đăng nhập bằng email công ty trên trang của identity provider (IdP), không bao giờ nhập mật khẩu vào ứng dụng. IdP lo
mật khẩu, MFA, quên mật khẩu, khóa khi dò. Ứng dụng lo phần nghiệp vụ: tạo tài khoản khi HR tạo hồ sơ, khóa khi nghỉ việc, gắn tài
khoản với hồ sơ theo email đã xác minh.

## 2. Tác nhân và quyền

| Tác nhân | Được làm gì trong use case này | Giới hạn theo dữ liệu |
|---|---|---|
| Mọi người dùng | Đăng nhập, đăng xuất, quên mật khẩu, đăng ký TOTP | Chỉ tài khoản của mình |
| HR | Tạo hồ sơ (kéo theo tạo tài khoản), cho nghỉ việc, khôi phục (khóa, mở tài khoản), xem trạng thái tài khoản, gửi lại lời mời | Mọi nhân viên |
| ADMIN | Đặt lại MFA, cấp vai trò `hr`, `admin` trên console IdP | Không xem hồ sơ cá nhân (NFR-5.13) |

## 3. Điều kiện

- **Điều kiện trước:** người dùng có hồ sơ với email công ty duy nhất; IdP có tài khoản cùng email, đã xác minh, đang mở.
- **Kích hoạt:** mở web khi chưa có token; hoặc HR lưu hồ sơ mới, đổi trạng thái nghỉ việc.
- **Điều kiện sau khi thành công:** web có access token trong `sessionStorage`; `iam.user_account` có `subject` và `last_login_at`;
  với vòng đời tài khoản, `idp_status` khớp trạng thái trên IdP.
- **Điều kiện sau khi thất bại:** không có token; hồ sơ HR vừa lưu vẫn giữ, tài khoản ở `FAILED` để thử lại.

## 4. Luồng chính

### 4.1 Đăng nhập (FR-8.1)

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Mở web | Web không có token, tạo `code_verifier`, `state`, chuyển tới `/authorize` của IdP với `code_challenge` S256 |
| 2 | Nhập email, mật khẩu | IdP kiểm mật khẩu, đếm lần sai |
| 3 | Nhập mã TOTP (nếu bắt buộc, FR-8.5) | IdP kiểm mã |
| 4 | | IdP chuyển về `/callback?code=…&state=…`; web kiểm `state`, đổi `code` + `code_verifier` lấy token |
| 5 | | Web gọi `GET /me`; API kiểm chữ ký JWKS, issuer, client; tìm tài khoản theo `sub`, chưa có thì theo email đã xác minh |
| 6 | | Web hiện trang chủ theo vai trò; token tự gia hạn trước khi hết hạn |

### 4.2 Tạo tài khoản khi HR tạo hồ sơ (FR-8.3)

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | HR lưu hồ sơ mới | API lưu hồ sơ, tạo `iam.user_account` (`idp_status = PENDING`) và event `employee.created` trong outbox, cùng một giao dịch |
| 2 | | Relay đẩy event lên queue (local RabbitMQ; staging SNS `hr-events` → SQS `identity-sync`) |
| 3 | | Consumer `identity-sync` gọi `IdentityProviderAdmin.createUser(email, tên, nhóm employee)` |
| 4 | | IdP tạo tài khoản, email đã xác minh, gửi email mời có mật khẩu tạm hoặc link đặt mật khẩu |
| 5 | | Consumer ghi `idp_status = INVITED` |
| 6 | Người được mời đăng nhập, đổi mật khẩu tạm | Luồng 4.1; API gắn `subject`, ghi `idp_status = ACTIVE` |

### 4.3 Khóa tài khoản khi nghỉ việc (FR-8.4)

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | HR cho nhân viên nghỉ việc (FR-1.7) | API đổi trạng thái `TERMINATED`, ghi event `employee.terminated` trong outbox |
| 2 | | Consumer gọi `disableUser` và `signOutAll` (Cognito `AdminDisableUser`, `AdminUserGlobalSignOut`) |
| 3 | | Ghi `idp_status = DISABLED`. Access token còn hạn (≤ 15 phút) vẫn bị API trả 403 vì kiểm `TERMINATED` |

## 5. Luồng thay thế

- **A1 (từ bước 2 của 4.1) – Quên mật khẩu (FR-8.2):** bấm "Quên mật khẩu", nhập email; IdP gửi mã hoặc link; nhập mật khẩu mới theo
  NFR-5.2; quay lại bước 2.
- **A2 (từ bước 3 của 4.1) – Đăng ký TOTP lần đầu (FR-8.5):** IdP hiện mã QR, người dùng quét bằng ứng dụng xác thực và nhập mã đầu tiên.
- **A3 (từ bước 6 của 4.1) – Đăng xuất:** web xóa token; Keycloak gọi `end_session_endpoint`, Cognito gọi `/logout` của Managed Login.
- **A4 (sau bước 6 của 4.1) – Hết phiên:** 30 phút không thao tác thì web tự đăng xuất như A3; refresh token hết sau 10 giờ thì về bước 1.
- **A5 (từ bước 1 của 4.3) – Khôi phục:** event `employee.reinstated`, consumer gọi `enableUser`, `idp_status = ACTIVE`.
- **A6 (FR-8.6) – Gửi lại lời mời:** HR bấm "Gửi lại lời mời" khi `idp_status` là `INVITED` hoặc `FAILED`; API ghi event
  `account.invite_requested`; consumer gọi `resendInvite` (Cognito `AdminCreateUser` với `MessageAction=RESEND`).

## 6. Ngoại lệ

| Mã | Tình huống | Hệ thống phản hồi |
|---|---|---|
| E1 | `state` ở `/callback` không khớp hoặc thiếu `code` | Web báo "Đăng nhập không thành công", nút thử lại; không lưu token |
| E2 | Token sai chữ ký, hết hạn, sai client | HTTP 401 `UNAUTHORIZED` |
| E3 | Email trong token chưa xác minh, hoặc email đã gắn với `subject` khác | HTTP 401 `UNAUTHORIZED` (T-02) |
| E4 | Tài khoản không có hồ sơ hoặc hồ sơ `TERMINATED` | HTTP 403 `FORBIDDEN` |
| E5 | Sai mật khẩu nhiều lần | IdP khóa tạm (NFR-5.3) |
| E6 | IdP không gọi được khi tạo, khóa tài khoản | Thử lại theo SQS, tối đa 5 lần; rồi `idp_status = FAILED`, message vào DLQ |
| E7 | Email đã có tài khoản trên IdP khi tạo | Consumer lấy tài khoản sẵn có, không tạo trùng (idempotent) |

## 7. Quy tắc áp dụng

[ADR-17](../../architecture/adr/ADR-17-authentication.md) (toàn bộ), [ADR-03](../../architecture/adr/ADR-03-sync-workflow-async-notification.md)
(outbox), [ADR-15](../../architecture/adr/ADR-15-service-extraction.md) (SNS `hr-events`), [ADR-10](../../architecture/adr/ADR-10-manager-role-derived.md)
(MANAGER không phải nhóm trên IdP), [threat model](../../security/threat-model.md) T-02, T-03, T-06.

## 8. Dữ liệu vào

| Trường | Bắt buộc | Kiểm tra |
|---|---|---|
| Email (trên trang IdP) | Có | Đúng định dạng; thông báo lỗi không phân biệt sai email hay sai mật khẩu |
| Mật khẩu mới | Có | ≥ 8 ký tự, có chữ hoa, chữ thường, số; không trùng email (NFR-5.2) |
| Mã TOTP | Khi MFA bật | 6 số, theo thời gian 30 giây |

## 9. Giao diện và API

> Trang đăng nhập, quên mật khẩu, MFA là của IdP. Ứng dụng chỉ có các phần dưới đây; nav bar, màu, cách báo lỗi theo
> [giao diện chung](../frontend.md).

| Bước | Màn hình | API |
|---|---|---|
| 4.1 bước 1 | `/` khi chưa đăng nhập: chuyển thẳng sang IdP (local có thêm trang chọn tài khoản demo khi `VITE_AUTH_MODE=dev`) | – |
| 4.1 bước 4 | `/callback` | – |
| 4.1 bước 5 | – | `GET /me` |
| A4 | Hộp thông báo "Phiên đã hết" | – |
| FR-8.6 | Hồ sơ nhân viên (góc nhìn HR), dòng "Tài khoản đăng nhập": trạng thái + nút "Gửi lại lời mời" | `GET /employees/{id}/account`, `POST /employees/{id}/account/invite` (đề xuất, mục 13) |

## 10. Yêu cầu phi chức năng liên quan

NFR-5.1 → NFR-5.10. Riêng UC8: email mời tới trong 1 phút kể từ khi HR lưu (khi IdP, SES bình thường).

## 11. Kiểm thử

Xem [`test.md`](test.md).

## 12. Hiện trạng và việc còn lại

Trên `dev` (17/11/2026, sau PR #94):

- Đã có: `frontend/src/auth/auth.tsx` (OIDC Code + PKCE bằng `oidc-client-ts`, `sessionStorage`, tự gia hạn, đăng xuất cả hai IdP);
  `CallbackPage`; `backend/src/modules/identity/token-verifier.ts` (Keycloak và Cognito); `identity.service.ts` gắn tài khoản theo
  `sub` hoặc email, chặn `TERMINATED`; realm `keycloak/realm-hr.json` (tắt tự đăng ký, token 15 phút, idle 30 phút, chống dò);
  `infra/staging/cognito.tf` (Hosted UI domain, app client public, 4 nhóm, 4 tài khoản demo).
- Thiếu: `callback_urls` của Cognito; quên mật khẩu; MFA; tạo, khóa tài khoản tự động; trạng thái tài khoản; tự đăng xuất khi không
  thao tác; kiểm `email_verified` khi gắn theo email (nhánh `fix/auth-email-verified`).

Ai làm, tuần nào: mục 4 của [`requirements.md`](requirements.md).

## 13. Thiết kế đề xuất cho phần chưa có

**Interface (backend `src/modules/identity/idp-admin/`):**

```ts
interface IdentityProviderAdmin {
  createUser(input: { email: string; fullName: string; groups: string[] }): Promise<{ subject: string; created: boolean }>;
  resendInvite(email: string): Promise<void>;
  disableUser(email: string): Promise<void>;
  enableUser(email: string): Promise<void>;
  signOutAll(email: string): Promise<void>;
}
```

Driver chọn bằng `IDP_ADMIN_DRIVER=keycloak|cognito|none` (`none` cho `AUTH_MODE=dev` và test).

- `cognito`: `@aws-sdk/client-cognito-identity-provider`, các lệnh `AdminCreateUser` (`DesiredDeliveryMediums=EMAIL`,
  `email_verified=true`), `AdminAddUserToGroup`, `AdminDisableUser`, `AdminEnableUser`, `AdminUserGlobalSignOut`.
- `keycloak`: Admin REST API bằng client `hr-api-admin` (client credentials, chỉ role `manage-users` của realm `hr`):
  `POST /admin/realms/hr/users` với `requiredActions: ["UPDATE_PASSWORD"]`, `PUT …/execute-actions-email`, `PUT …/users/{id}`
  (`enabled`), `POST …/users/{id}/logout`.

**Dữ liệu:** migration thêm `iam.user_account.idp_status` (`PENDING`, `INVITED`, `ACTIVE`, `DISABLED`, `FAILED`),
`idp_synced_at`, `idp_last_error` (chỉ mã lỗi, không có dữ liệu cá nhân).

**Event** (payload tối thiểu, theo quy ước event của [ADR-15](../../architecture/adr/ADR-15-service-extraction.md)): `employee.created`
(`employeeId`, `email`, `fullName`), `employee.terminated`, `employee.reinstated` (`employeeId`, `email`),
`account.invite_requested` (`employeeId`, `email`).

**Web:** hook `useIdleLogout(30 phút)` trong `AuthProvider`, nghe `mousemove`, `keydown`, `click`, đồng bộ giữa các tab bằng
`BroadcastChannel`.
