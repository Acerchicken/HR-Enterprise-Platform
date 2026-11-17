# UC8 – Đăng nhập và tài khoản: yêu cầu và tiêu chí chấp nhận

> Đọc file này trước khi mở nhánh. Luồng chi tiết: [`spec.md`](spec.md). Nguồn FR: SRS mục 4.8. Quyết định: [ADR-17](../../architecture/adr/ADR-17-authentication.md).
> Mỗi tiêu chí `AC-x.y.z` là một ca kiểm thử. PR làm chức năng ghi mã AC đã làm trong mô tả PR.

UC8 gồm những việc **người dùng làm** với tài khoản: đăng nhập, đăng xuất, quên mật khẩu, MFA, và việc HR tạo, khóa tài khoản theo
hồ sơ. Các yêu cầu bảo mật dùng chung cho mọi UC (header, rate limit, mã hóa, kiểm token ở API) vẫn là NFR-5 trong SRS, không thuộc
UC8. Tách UC8 ngày 17/11/2026 (Duong hỏi, TV1 đề xuất); 7 UC cũ giữ nguyên mã.

## 1. User story

| Mã | Là | Tôi muốn | Để | FR |
|---|---|---|---|---|
| US-8.1 | Nhân viên | Đăng nhập bằng email công ty và đăng xuất | Dùng hệ thống, và không ai dùng tiếp phiên của tôi | FR-8.1 |
| US-8.2 | Nhân viên | Tự đặt lại mật khẩu khi quên | Không phải nhờ ADMIN | FR-8.2 |
| US-8.3 | HR | Khi tôi tạo hồ sơ nhân viên mới, người đó tự nhận email mời đăng nhập | Không phải tạo tài khoản bằng tay ở hai nơi | FR-8.3 |
| US-8.4 | HR | Khi cho nhân viên nghỉ việc, tài khoản bị khóa ngay | Người đã nghỉ không vào được hệ thống | FR-8.4 |
| US-8.5 | HR, ADMIN | Đăng nhập bằng mật khẩu và mã TOTP | Lộ mật khẩu cũng không mất tài khoản có quyền cao | FR-8.5 |
| US-8.6 | HR | Xem tài khoản của nhân viên đã kích hoạt chưa và gửi lại lời mời | Xử lý khi nhân viên báo không nhận được email | FR-8.6 |

## 2. Tiêu chí chấp nhận

Môi trường: **L** = local (Keycloak), **S** = staging (Cognito). Không ghi thì áp dụng cả hai.

### FR-8.1 Đăng nhập, đăng xuất qua identity provider (M, một phần)

- **AC-8.1.1** Giả sử người dùng chưa đăng nhập. Khi mở bất kỳ trang nào của web. Thì web chuyển sang trang đăng nhập của IdP với
  `response_type=code`, `code_challenge_method=S256`; web không có ô nhập mật khẩu.
- **AC-8.1.2** *(chưa đạt ở S)* Giả sử nhập đúng email, mật khẩu (và mã TOTP nếu có). Khi IdP chuyển về `/callback`. Thì web vào trang
  chủ theo vai trò. Trên S hiện lỗi `redirect_mismatch` vì `callback_urls` thiếu `/callback`.
- **AC-8.1.3** Giả sử nhập sai mật khẩu. Khi bấm đăng nhập. Thì thông báo lỗi không cho biết sai email hay sai mật khẩu.
- **AC-8.1.4** *(chưa đạt ở L)* Giả sử sai mật khẩu 5 lần liên tiếp trong 15 phút. Khi thử lần 6 bằng mật khẩu đúng. Thì L từ chối
  trong 15 phút; S từ chối theo cơ chế tự tăng thời gian chờ của Cognito (ghi rõ khác biệt, NFR-5.3).
- **AC-8.1.5** Giả sử đang đăng nhập. Khi bấm Đăng xuất rồi bấm Back hoặc Đăng nhập lại. Thì phải nhập lại mật khẩu (phiên ở IdP đã kết thúc).
- **AC-8.1.6** *(chưa có)* Giả sử không thao tác chuột, bàn phím 30 phút. Thì web tự đăng xuất và báo "Phiên đã hết, vui lòng đăng nhập lại".
- **AC-8.1.7** *(chưa đạt ở S)* Giả sử đang dùng liên tục. Thì token tự gia hạn; sau 10 giờ kể từ lúc đăng nhập phải đăng nhập lại.
- **AC-8.1.8** *(chưa đạt ở S)* Giả sử gọi `InitiateAuth` với `USER_PASSWORD_AUTH` tới app client của web. Thì Cognito từ chối.
- **AC-8.1.9** *(chưa đạt ở S)* Giả sử chưa có tài khoản. Khi tìm nút "Đăng ký" trên trang đăng nhập. Thì không có (NFR-5.9).

### FR-8.2 Quên mật khẩu (M, chưa có)

- **AC-8.2.1** *(chưa có)* Giả sử tài khoản đang hoạt động. Khi bấm "Quên mật khẩu" và nhập email. Thì email có mã hoặc link đặt lại
  được gửi (L: Mailpit; S: SES), hiệu lực ≤ 1 giờ.
- **AC-8.2.2** *(chưa có)* Giả sử nhập email không tồn tại. Khi gửi. Thì màn hình hiện cùng thông báo như AC-8.2.1 và không gửi thư.
- **AC-8.2.3** *(chưa có)* Giả sử đặt mật khẩu mới yếu (dưới 8 ký tự, thiếu chữ hoa, chữ thường hoặc số). Thì bị từ chối (NFR-5.2).
- **AC-8.2.4** *(chưa có)* Giả sử đặt lại thành công. Thì mật khẩu cũ không dùng được nữa, các phiên khác của tài khoản phải đăng nhập lại.
- **AC-8.2.5** *(chưa có)* Giả sử tài khoản đã bị khóa vì nghỉ việc. Khi yêu cầu đặt lại mật khẩu. Thì không đăng nhập được dù đặt lại.

### FR-8.3 Tạo tài khoản khi HR tạo hồ sơ (M, chưa có)

- **AC-8.3.1** *(chưa có)* Giả sử HR tạo hồ sơ có email công ty chưa có tài khoản. Khi lưu. Thì trong 1 phút IdP có tài khoản với email
  đã xác minh, nhóm `employee`, và người đó nhận email mời.
- **AC-8.3.2** *(chưa có)* Giả sử người được mời đăng nhập lần đầu. Thì bị bắt đổi mật khẩu tạm; mật khẩu tạm hết hạn sau 7 ngày.
- **AC-8.3.3** *(chưa có)* Giả sử IdP lỗi khi tạo. Thì hồ sơ vẫn lưu; hệ thống thử lại tối đa 5 lần; hết lần thử thì trạng thái tài
  khoản là `FAILED` và có message trong DLQ.
- **AC-8.3.4** *(chưa có)* Giả sử event `employee.created` bị giao hai lần. Thì chỉ có một tài khoản, một email mời.
- **AC-8.3.5** *(chưa có)* Giả sử đăng nhập lần đầu xong. Thì `iam.user_account` gắn `subject` với hồ sơ và trạng thái là `ACTIVE`.

### FR-8.4 Khóa tài khoản khi nghỉ việc (M, một phần)

- **AC-8.4.1** Giả sử nhân viên đã `TERMINATED` còn access token hạn. Khi gọi API. Thì 403 (đã có, FR-1.7).
- **AC-8.4.2** *(chưa có)* Giả sử HR cho nhân viên nghỉ việc. Thì trong 1 phút tài khoản trên IdP bị khóa và refresh token bị thu hồi;
  đăng nhập lại bị từ chối.
- **AC-8.4.3** *(chưa có)* Giả sử HR khôi phục nhân viên đã nghỉ. Thì tài khoản được mở lại và người đó đăng nhập bằng mật khẩu cũ.

### FR-8.5 Xác thực hai lớp TOTP (M, chưa có)

- **AC-8.5.1** *(chưa có)* Giả sử tài khoản HR hoặc ADMIN chưa đăng ký TOTP. Khi đăng nhập. Thì IdP hiện mã QR bắt đăng ký trước khi vào.
- **AC-8.5.2** *(chưa có)* Giả sử đã đăng ký TOTP. Khi đăng nhập. Thì phải nhập mã 6 số; mã sai thì không vào được.
- **AC-8.5.3** *(chưa có, L)* Giả sử tài khoản nhân viên. Thì không bị hỏi TOTP trừ khi tự bật trong trang tài khoản Keycloak.
- **AC-8.5.4** *(chưa có, S)* Giả sử tài khoản bất kỳ. Thì phải đăng ký và nhập TOTP (pool bật MFA bắt buộc, ADR-17 mục 2).
- **AC-8.5.5** *(chưa chốt cách làm ở S)* Giả sử người dùng mất điện thoại. Khi ADMIN đặt lại MFA. Thì lần đăng nhập sau phải đăng ký TOTP mới.

### FR-8.6 HR xem trạng thái tài khoản, gửi lại lời mời (S, chưa có)

- **AC-8.6.1** *(chưa có)* Giả sử HR mở hồ sơ một nhân viên. Thì thấy trạng thái tài khoản: Đang tạo, Chờ kích hoạt, Đang dùng, Đã khóa, Lỗi.
- **AC-8.6.2** *(chưa có)* Giả sử trạng thái Chờ kích hoạt hoặc Lỗi. Khi HR bấm "Gửi lại lời mời". Thì có email mời mới, mật khẩu tạm cũ hết hiệu lực; ghi audit.
- **AC-8.6.3** *(chưa có)* Giả sử vai trò khác HR. Khi gọi API gửi lại lời mời. Thì 403.

## 3. Yêu cầu phi chức năng liên quan

[SRS mục 6.6 a)](../../requirements/SRS.md#66-nfr-5--bảo-mật): NFR-5.1 → NFR-5.10. Ghi sự kiện đăng nhập (NFR-5.10) được kiểm ở UC7
AC-7.4.1. Kiểm token ở API (NFR-5.8) dùng chung mọi UC.

## 4. Việc còn lại

| Việc | Tiêu chí | Người | Nhánh | Tuần |
|---|---|---|---|---|
| Sửa `callback_urls`, bỏ `USER_PASSWORD_AUTH`, tắt tự đăng ký, mật khẩu, khóa, thời hạn token; bật quên mật khẩu (Keycloak, Cognito + SES) | AC-8.1.2, 8.1.4, 8.1.7 → 8.1.9, AC-8.2.x | TV3 | `infra/idp-hardening` | 11 |
| MFA TOTP | AC-8.5.x | TV3 | `infra/idp-mfa` | 11 |
| Tự đăng xuất sau 30 phút không thao tác | AC-8.1.6 | TV1 | `feat/idp-account-lifecycle` | 12 |
| Event, consumer `identity-sync`, driver Keycloak/Cognito, trạng thái tài khoản, gửi lại lời mời | AC-8.3.x, 8.4.2, 8.4.3, AC-8.6.x | TV1 | `feat/idp-account-lifecycle` | 12 |
| SNS → SQS `identity-sync`, DLQ, quyền IAM `cognito-idp:Admin*`, SES cho Cognito | AC-8.3.3, 8.4.2 | TV3 | `infra/idp-account-lifecycle` | 12 |
| Ca kiểm thử UC8 | Mọi AC | TV4 | `docs/test-cases-uc8` | 12 |
| Ghi sự kiện đăng nhập | UC7 AC-7.4.1 | TV3 | `infra/idp-auth-events` | 13 (danh sách cắt) |
