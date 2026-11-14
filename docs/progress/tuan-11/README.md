# Tuần 11 (16/11 – 23/11) – Hoàn thành UC1, P4 Production Engineering

Mục tiêu tuần:
1. **UC1 – Hồ sơ nhân viên xong và sẵn sàng lên cloud** (bước 1 của
   [kế hoạch tổng mục 7](../ke-hoach-tong.md#7-kế-hoạch-hoàn-thành-từng-chức-năng-tuần-10--13)), gồm phần mức M của UC2
   (chặn gốc thứ hai, kiểm `headEmployeeId`).
2. **Bảo mật đăng nhập và API:** header bảo mật, giới hạn tần suất, MFA cho HR và ADMIN, kiểm `email_verified`.
3. **P4:** load test local theo NFR-1, NFR-2; dashboard SLI; chi phí/tháng theo kết quả đo.
4. **Chuẩn bị bước 2 (UC3, UC4):** TV2 chốt quy tắc nghỉ phép còn mở, TV4 viết ca kiểm thử trước khi TV1 code từ T2 (23/11).

Phân vai theo ADR-11: TV1 Duong code, TV2 Thanh nghiệp vụ, TV3 Bảo cloud, IaC, CI/CD, TV4 Duy kiểm thử.

> File này là kế hoạch đầu tuần. Thứ 2 (23/11) nhóm điền mục 1–3 để làm báo cáo.

## Quy trình

Như tuần 10 ([`CONVENTIONS.md` mục 6](../../CONVENTIONS.md#quy-trình-cho-một-việc)): mỗi việc một nhánh tách từ `dev`, mỗi nhánh
một PR vào `dev`, review và sửa ngay trên PR tới khi được approve. Góp ý và review phải có trên GitHub.

**"Mở PR"** là hạn mở PR, **"Merge"** là hạn PR được approve và merge. PR code ghi mã AC trong mô tả.

**Một chức năng "xong"** khi: AC đã merge và có test; `deploy.md` và Terraform `validate`/`plan` không lỗi; TV4 merge biên bản
kiểm thử chạy thật; TV2 đã review nghiệp vụ trên PR (chi tiết ở kế hoạch tổng mục 7.1). TV1 chỉ code UC1 trong tuần này, không
mở nhánh của chức năng khác (trừ việc chung).

## Kế hoạch tuần 11 theo nhánh

### UC1 – Hồ sơ nhân viên

| Nhánh | Người | Việc | Tiêu chí | Mở PR | Merge | Review |
|---|---|---|---|---|---|---|
| `feat/profile-layout` | TV1 Duong | Trang hồ sơ theo nhóm, màu cyan, mục chưa có tiêu đề đỏ, tải theo nhu cầu; chủ hồ sơ tự xem lương, số tài khoản | AC-1.8.x, AC-1.3.5 | CN (15/11) | T3 (17/11) | TV2, TV4 |
| `docs/org-integrity-rules` | TV2 Thanh | Chốt nghỉ việc khi còn cấp dưới, `headEmployeeId`, audit theo nhóm trường, thời gian lưu audit, mục được gửi yêu cầu sửa, thời hạn HR xử lý | AC-1.7.1, AC-1.4.3, FR-1.9, FR-1.14 | T2 (16/11), 21:00 | T3 (17/11) | TV1, TV4 |
| `docs/test-cases-uc1` | TV4 Duy | Ca còn thiếu ở mục 7 `test.md` UC1 | Mọi AC-1.x | T3 (17/11), 21:00 | T4 (18/11) | TV2, TV1 |
| `fix/employee-org-integrity` | TV1 Duong | Bắt buộc `version`, audit theo nhóm trường, sửa `hireDate`/`workEmail`, nghỉ việc, trường nhạy cảm tải khi bấm hiện; UC2 gốc thứ hai, `headEmployeeId` | AC-1.3.4, AC-1.4.3, AC-1.4.4, AC-1.6.2, AC-1.6.3, AC-1.7.1, AC-1.7.2, AC-2.4.6, AC-2.4.7 | T4 (18/11) | T5 (19/11) | TV2, TV4 |
| `infra/profile-files` | TV3 Bảo | Bucket hồ sơ, lifecycle 30 ngày, quyền App Runner, alarm 429, `PROFILE_STORAGE_BUCKET` (MinIO local, S3 staging). Chỉ `validate`, `plan` | AC-1.10.7, AC-1.10.9, AC-1.14.4, AC-1.14.5 | T4 (18/11), 21:00 | T5 (19/11) | TV1 |
| `feat/profile-change-requests` | TV1 Duong | `profile_item`, yêu cầu cập nhật hồ sơ, màn hình HR duyệt, email khi đổi tài khoản ngân hàng, nhật ký thay đổi | AC-1.2.1, AC-1.9.x, AC-1.6.4, AC-1.11.x | T5 (19/11) | T6 (20/11) | TV2, TV4 |
| `feat/profile-files` | TV1 Duong | File hồ sơ, ảnh đại diện, hạn mức, xóa mềm | AC-1.10.x | T6 (20/11) | T7 (21/11) | TV3, TV4 |
| `docs/test-report-uc1` | TV4 Duy | Chạy mọi ca UC1 trên `dev` (local) | `test.md` UC1 | CN (22/11), 12:00 | T2 (23/11), 9:00 | TV1 |

### Việc chung (bảo mật, P4)

| Nhánh | Người | Việc | Tiêu chí | Mở PR | Merge | Review |
|---|---|---|---|---|---|---|
| `infra/idp-hardening` | TV3 Bảo | Việc tuần 10: tắt tự đăng ký, chính sách mật khẩu, khóa 5 lần sai, thời hạn token và phiên | NFR-5.2, 5.3, 5.5, 5.9 | CN (15/11), 12:00 | T2 (16/11), 9:00 | TV1, TV4 |
| `feat/security-headers-ratelimit` | TV1 Duong | Header bảo mật; 100 request/phút mỗi người, 20/phút cho tìm kiếm, vượt thì 429; ngưỡng qua biến môi trường | NFR-5.21, 5.22, AC-1.14.x | T3 (17/11) | T4 (18/11) | TV3, TV4 |
| `fix/auth-email-verified` | TV1 Duong | Chỉ liên kết tài khoản khi email đã xác minh (T-02) | – | T4 (18/11) | T5 (19/11) | TV3, TV4 |
| `docs/security-test-cases-week11` | TV4 Duy | Tự đăng ký, mật khẩu yếu, khóa 5 lần sai, hết phiên, MFA, 429, header | NFR-5.2 → 5.5, 5.9, 5.21, 5.22 | T4 (18/11), 21:00 | T5 (19/11) | TV1, TV3 |
| `infra/idp-mfa` | TV3 Bảo | MFA TOTP cho HR, ADMIN (Keycloak và Cognito) | NFR-5.4 | T5 (19/11), 21:00 | T6 (20/11) | TV1 |
| `test/load-k6` | TV4 Duy, TV1 hỗ trợ | Load test local 50 request/giây 15 phút; NFR-1.1 → 1.3, NFR-2.1, NFR-2.4 | NFR-1, NFR-2 | T6 (20/11) | CN (22/11) | TV1, TV3 |
| `docs/slo-dashboard-cost` | TV3 Bảo | Dashboard CloudWatch theo SLI (SRS 6.13); chi phí/tháng theo kết quả load test | SRS 6.13 | T7 (21/11), 21:00 | CN (22/11) | TV1 |

### Chuẩn bị bước 2 (UC3, UC4)

| Nhánh | Người | Việc | Tiêu chí | Mở PR | Merge | Review |
|---|---|---|---|---|---|---|
| `docs/leave-rules-week11` | TV2 Thanh | Cách tính phép năm, nghỉ theo sự kiện, đơn qua hai năm, hủy đơn đã duyệt, hoàn tất sau ngày kết thúc, nhắc đơn chờ lâu | AC-3.1.3, AC-3.1.4, AC-3.2.4, AC-4.5.3 | T5 (19/11), 21:00 | T6 (20/11) | TV1, TV4 |
| `docs/test-cases-uc3-uc4` | TV4 Duy | Đổi quản lý khi đơn đang chờ, người duyệt thay, tạo đơn hộ, riêng tư, HR duyệt thêm | AC-3.7.x, AC-4.2.6, AC-4.3.x, AC-4.6.3, AC-4.7.3, AC-4.8.x | T7 (21/11), 21:00 | CN (22/11) | TV2, TV1 |

### Review phần TV1 đã viết thay

Theo [kế hoạch tổng mục 7.9](../ke-hoach-tong.md#79-phần-tv1-đã-làm-thay-thành-viên-đọc-review-và-góp-ý). Người viết là TV1;
thành viên đọc, đối chiếu và góp ý bằng review trên PR. Báo cáo ghi "review", không ghi là người viết.

| Người | Tài liệu | PR | Hạn |
|---|---|---|---|
| TV2 Thanh | `requirements.md`, `spec.md` UC1, UC2; bảng FR trong SRS; ma trận phân quyền | #76, #71 | T2 (16/11), 21:00 |
| TV2 Thanh | `requirements.md`, `spec.md` UC3, UC4 | #76 | T6 (20/11) |
| TV3 Bảo | `deploy.md` UC1 | #76 | T3 (17/11) |
| TV3 Bảo | `deploy.md` UC2 → UC7, `configuration.md` | #76, #74 | T6 (20/11) |
| TV4 Duy | `test.md` UC1 | #76 | T2 (16/11), 21:00 |
| TV4 Duy | `test.md` UC3, UC4 | #76 | T6 (20/11) |

Thứ tự phụ thuộc:

1. T2 (16/11): TV2, TV4 review UC1 trên #76 → TV1 sửa đặc tả trước khi code tiếp.
2. T3 (17/11): `docs/org-integrity-rules` merge → TV1 làm `fix/employee-org-integrity`.
3. T4 (18/11): rate limit merge trước load test; `infra/profile-files` merge trước `feat/profile-files`.
4. T5–T6: TV2 chốt quy tắc nghỉ phép → TV4 viết ca UC3, UC4.
5. CN (22/11): TV4 merge biên bản UC1 → **UC1 xong**. T2 (23/11), 9:00: mọi người điền "Việc đã làm"; TV1 viết báo cáo, PR
   `dev` → `main`, tag `week-11`, bắt đầu bước 2.

## Chi tiết từng người

| Thành viên | File |
|---|---|
| TV1 (Duong, nhóm trưởng) | [TV1_Duong.md](TV1_Duong.md) |
| TV2 (Thanh) | [TV2_Thanh.md](TV2_Thanh.md) |
| TV3 (Bảo) | [TV3_Bao.md](TV3_Bao.md) |
| TV4 (Duy) | [TV4_Duy.md](TV4_Duy.md) |

## 1. Các công việc đã hoàn thành

_Điền cuối tuần._

| Thành viên | Công việc đã hoàn thành | Output | Chi tiết |
|---|---|---|---|
| TV1 (Duong, nhóm trưởng) | | | [TV1_Duong.md](TV1_Duong.md) |
| TV2 (Thanh) | | | [TV2_Thanh.md](TV2_Thanh.md) |
| TV3 (Bảo) | | | [TV3_Bao.md](TV3_Bao.md) |
| TV4 (Duy) | | | [TV4_Duy.md](TV4_Duy.md) |

## 2. Tóm tắt kế hoạch tuần tiếp theo (tuần 12: 23/11 – 30/11)

_Điền cuối tuần._ Lịch đã có ở kế hoạch tổng mục 7.5 (bước 2: UC3, UC4) và 7.3 (staging `apply` T3 24/11).

## 3. Quyết định quan trọng

### Làm xong từng chức năng một (14/11/2026)

**Bối cảnh:** đến 14/11 chưa chức năng nào đạt đủ tiêu chí, dù UC nào cũng có một phần. Tuần 10 mở nhiều nhánh cùng lúc nên
cuối tuần việc nào cũng dở.

**Quyết định:** TV1 code một chức năng tại một thời điểm theo thứ tự UC1 → UC3, UC4 → UC7 → UC5 → UC6; chức năng chỉ xong khi
sẵn sàng lên cloud. Chi tiết: kế hoạch tổng mục 7.

**Đánh đổi:** UC5, UC6, UC7 làm muộn (cuối tuần 12); nếu trễ thì phần mức S và trợ lý (mức C) bị cắt trước.

**Khi nào xem lại:** nếu UC1 chưa xong vào T2 (23/11), nhóm cắt `feat/profile-files` sang danh sách cắt và ghi vào báo cáo.
