# Tuần 11 – TV1 (Duong, nhóm trưởng): UC1, bảo mật API

Vai trò: code chính, review PR, merge PR, báo cáo thứ 2. Tuần này chỉ code UC1 và việc chung, không mở nhánh chức năng khác.

## Hạn chót

| Hạn | Việc |
|---|---|
| **CN (15/11)** | Mở PR `feat/profile-layout` |
| T2 (16/11), 9:00 | Merge `infra/idp-hardening` (TV3) nếu đạt; review xong #68, #69, #70 của TV3 |
| Trong 24 giờ kể từ khi PR mở | Review PR của TV2, TV3, TV4 trên GitHub |
| T2 (16/11) – T3 (17/11) | Xử lý góp ý của TV2, TV3, TV4 trên #76 (phần UC1) |
| **T3 (17/11)** | Mở PR `feat/security-headers-ratelimit` |
| **T4 (18/11)** | Mở PR `fix/employee-org-integrity`, `fix/auth-email-verified` |
| **T5 (19/11)** | Mở PR `feat/profile-self-service` |
| **T6 (20/11)** | Mở PR `feat/profile-files`; hỗ trợ TV4 chạy `test/load-k6` |
| **T2 (23/11)** | Báo cáo tuần 11, tạo thư mục tuần 12, PR `dev` → `main`, tag `week-11` |

## Việc cần làm

### 1. `feat/profile-layout` – AC-1.8.x, AC-1.3.5

Theo [`spec.md` UC1](../../features/UC1-employee-profile/spec.md) mục 9 và [`frontend.md`](../../features/frontend.md):
trang hồ sơ theo nhóm (cá nhân, công việc, tài chính, phúc lợi, khác), màu cyan, mục chưa có hiện tiêu đề đỏ, tải `summary` trước
rồi API từng mục; chủ hồ sơ tự xem lương, số tài khoản. e2e cho chủ hồ sơ, quản lý, HR.

### 2. `fix/employee-org-integrity` – sau khi `docs/org-integrity-rules` merge

Bắt buộc `version` khi sửa (409 khi lệch), audit theo nhóm trường, HR sửa `hireDate`, `workEmail`, chặn nghỉ việc khi còn cấp
dưới, trường nhạy cảm chỉ tải khi bấm hiện; UC2 chặn gốc thứ hai, kiểm `headEmployeeId`.

### 3. `feat/profile-self-service`, `feat/profile-files`

Theo AC-1.9.x, AC-1.11.x, AC-1.10.x. File hồ sơ dùng `PROFILE_STORAGE_BUCKET` từ `infra/profile-files` (TV3), không ghi cố định
tên bucket. Cập nhật `deploy.md`, `configuration.md` trong cùng PR.

### 4. Việc chung

- `feat/security-headers-ratelimit`: CSP, HSTS, `nosniff`, chặn iframe; giới hạn theo người dùng, ngưỡng qua biến môi trường.
- `fix/auth-email-verified`: chỉ liên kết tài khoản khi `email_verified`; có test.

### 5. Việc của nhóm trưởng

- Mỗi PR UC1 cập nhật `requirements.md` (bỏ *chưa có*), mục 12 `spec.md`, bảng phủ `test.md`, cột FR trong SRS.
- Báo cáo tuần ghi đúng người viết: tài liệu TV1 viết thay là của TV1; thành viên được ghi phần review.

## Góp ý review

_Góp ý ghi trực tiếp trên PR._

## Việc đã làm

_Điền T2 (23/11)._
