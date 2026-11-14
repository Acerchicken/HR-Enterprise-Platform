# Tuần 11 – TV4 (Duy): kiểm thử UC1, bảo mật, load test

Vai trò: viết ca kiểm thử trước một bước, chạy thật chức năng vừa code xong, ghi đúng kết quả quan sát được (nguyên tắc ghi kết quả
như [tuần 10](../tuan-10/TV4_Duy.md#nguyên-tắc-ghi-kết-quả-kiểm-thử-bắt-buộc)).

## Hạn chót

| Hạn | Việc |
|---|---|
| **T2 (16/11), 21:00** | Review `test.md` UC1 trên #76 |
| **T3 (17/11), 21:00** | Mở PR `docs/test-cases-uc1` |
| **T4 (18/11), 21:00** | Mở PR `docs/security-test-cases-week11` |
| Trong 24 giờ kể từ khi PR mở | Review `feat/profile-layout`, `fix/employee-org-integrity`, `feat/profile-self-service`, `feat/profile-files`: kết quả có khớp ca kiểm thử không |
| **T6 (20/11)** | Review `test.md` UC3, UC4 trên #76; mở PR `test/load-k6` |
| **T7 (21/11), 21:00** | Mở PR `docs/test-cases-uc3-uc4` |
| **CN (22/11), 12:00** | Mở PR `docs/test-report-uc1` |
| **T2 (23/11), 9:00** | Điền mục "Việc đã làm" |

## Việc cần làm

### 1. Review phần TV1 đã viết thay (#76)

TV1 đã viết `test.md` của UC1 → UC7. Người viết là TV1. TV4 đọc và góp ý bằng review trên PR: bảng phủ AC có đúng với test đang
có trên `dev` không, ca nào thiếu. Ca thiếu thì tự viết ở nhánh của mình. Báo cáo ghi "TV4 review", không ghi là người viết.

### 2. `docs/test-cases-uc1`

Ca còn thiếu ở mục 7 `test.md` UC1: trang hồ sơ theo nhóm và theo vai trò, trường nhạy cảm, xung đột `version` (409), nghỉ việc
khi còn cấp dưới, yêu cầu cập nhật hồ sơ, file hồ sơ (loại file, dung lượng, người khác không tải được).

### 3. `docs/security-test-cases-week11`

Tự đăng ký, mật khẩu yếu, khóa sau 5 lần sai, hết phiên, MFA cho HR/ADMIN, 429 khi vượt ngưỡng, header bảo mật. Thêm vào
`docs/business/security-test-cases.md`.

### 4. `test/load-k6` (P4, TV1 hỗ trợ)

Chạy local sau khi rate limit merge: 50 request/giây trong 15 phút; đo NFR-1.1 → 1.3, NFR-2.1, NFR-2.4 (3,75 triệu bản ghi audit
giả). Dùng nhiều tài khoản hoặc nâng ngưỡng qua biến môi trường để 429 không làm sai số đo. Ghi máy chạy, commit, kết quả p95.

### 5. `docs/test-cases-uc3-uc4`, `docs/test-report-uc1`

- Ca UC3, UC4 theo `leave-rules.md` sau khi `docs/leave-rules-week11` merge (T6).
- Biên bản UC1: chạy mọi ca UC1 trên `dev` sau khi `feat/profile-files` merge; ca chưa chạy đưa vào "Phạm vi chưa kiểm".

## Góp ý review

_Góp ý ghi trực tiếp trên PR._

## Việc đã làm

_Điền T2 (23/11), 9:00._
