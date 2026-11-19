# Tuần 11 (16/11 – 23/11) – 5 UC code xong, P4 Production Engineering

> **Cập nhật 16/11:** UC1 đã code xong trong hai ngày 15–16/11, sớm 5 ngày. Kế hoạch tuần được xếp lại: mục tiêu nâng lên
> 5 UC code xong. Bản đầu tuần (lập 14/11, chỉ có UC1) xem trong lịch sử git của file này.

Mục tiêu tuần:
1. **5 UC code xong (dev xong):** UC1 (đã xong 16/11), UC3, UC4 (nghỉ phép), UC7 (màn hình audit), UC5 (giao diện kho tài liệu);
   cùng phần mức M của UC2 (đã có gốc thứ hai, `headEmployeeId`; thêm loại đơn vị theo ADR-14). Thứ tự và mốc:
   [kế hoạch tổng mục 7.2](../ke-hoach-tong.md#72-thứ-tự-và-mốc).
2. **Kiểm thử đi kịp code:** TV4 viết ca trước khi TV1 code mỗi UC, chạy biên bản UC1 trên local cuối tuần.
3. **Bảo mật đăng nhập:** siết cấu hình Keycloak và Cognito, MFA cho HR và ADMIN, kiểm `email_verified`.
4. **P4 và chuẩn bị staging:** load test local, dashboard SLI, chi phí; hạ tầng ADR-15 và notification service để T3 (24/11)
   dựng staging.

Phân vai theo ADR-11: TV1 Duong code, TV2 Thanh nghiệp vụ, TV3 Bảo cloud, IaC, CI/CD, TV4 Duy kiểm thử.

> File này là kế hoạch tuần. Thứ 2 (23/11) nhóm điền mục 1–3 để làm báo cáo.

## Quy trình

Như tuần 10 ([`CONVENTIONS.md` mục 6](../../CONVENTIONS.md#quy-trình-cho-một-việc)): mỗi việc một nhánh tách từ `dev`, mỗi nhánh
một PR vào `dev`, review và sửa ngay trên PR. **"Mở PR"** là hạn mở PR, **"Merge"** là hạn PR được approve và merge.

- **Dev xong:** code đã merge vào `dev`, có test tự động, CI xanh. **Xong** (kế hoạch tổng 7.1): thêm biên bản kiểm thử chạy thật
  của TV4 và kiểm tra trên staging (tuần 12).
- **Review trong 24 giờ.** Tuần 10 không có review nào của TV2, TV3 trên PR của TV1. Tuần này PR code nào của TV1 cũng cần review
  của người ghi ở cột "Review", trên GitHub, nêu đã đối chiếu gì hoặc đã chạy gì. TV1 merge sau 24 giờ dù chưa có review để giữ
  tiến độ; review đến sau thì góp ý trên PR đã merge, TV1 sửa ở PR mới. Báo cáo tuần ghi rõ PR nào thiếu review.
- **Quá hạn:** việc quá hạn mở PR 24 giờ được ghi "trễ" trong báo cáo. TV1 không làm thay; việc nào chặn TV1 code thì TV1 làm theo
  đề xuất có sẵn trong `requirements.md` và thành viên góp ý trên PR code.

## Kế hoạch theo ngày của TV1 (code)

| Ngày | Mở PR | UC |
|---|---|---|
| CN (15/11) – T2 (16/11) | #80, #84 → #87, #89, #90, #93 (đã merge) | UC1, UC2 (M), chung |
| T3 (17/11) | `feat/leave-privacy`, `fix/auth-email-verified` | UC4, chung |
| T4 (18/11) | `feat/leave-delegation` | UC3, UC4 |
| T5 (19/11) | `fix/leave-balance-rules`, `feat/leave-hr-approval` | UC3, UC4 |
| T6 (20/11) | `feat/audit-ui`, `feat/org-unit-types` | UC7, UC2 |
| T7 (21/11) | `feat/document-ui` | UC5 |
| CN (22/11) | `feat/notification-service` (ADR-15, gồm driver email SES) | chung |
| T2 (23/11) | Báo cáo tuần 11, `docs/adr-16-policy-assistant` | UC6 |

## Kế hoạch tuần 11 theo nhánh

### UC1 – Hồ sơ nhân viên (đã code xong 16/11)

| Nhánh | Người | Việc | Tiêu chí | Mở PR | Merge | Review |
|---|---|---|---|---|---|---|
| `feat/profile-layout`, `fix/employee-org-integrity`, `feat/profile-change-requests`, `feat/profile-files`, `feat/profile-hr-sections`, `feat/profile-computed` | TV1 Duong | Đã merge (#80, #84, #86, #87, #89, #90) | AC-1.x, AC-2.4.6, AC-2.4.7 | – | 15–16/11 | TV2, TV4 rà sau, comment trên PR: hạn T4 (18/11), 21:00 |
| `docs/org-integrity-rules` | TV2 Thanh | Rà lại quy tắc TV1 đã code (#84, #86) và ADR-14 (#83): nghỉ việc khi còn cấp dưới, `headEmployeeId`, audit theo nhóm trường, thời gian lưu audit, mục được gửi yêu cầu sửa, thời hạn HR xử lý; ghi điểm khác vào file quy tắc | AC-1.7.1, AC-1.4.3, FR-1.9, FR-1.14 | T3 (17/11), 21:00 | T4 (18/11) | TV1, TV4 |
| `docs/test-cases-uc1` | TV4 Duy | Ca còn thiếu ở mục 7 `test.md` UC1 (gồm yêu cầu cập nhật, file hồ sơ, mục HR, thông tin tự tính) | Mọi AC-1.x | T3 (17/11), 21:00 | T4 (18/11) | TV2, TV1 |
| `docs/test-report-uc1` | TV4 Duy | Chạy mọi ca UC1 trên `dev` (local), ghi ngày, commit | `test.md` UC1 | CN (22/11), 12:00 | T2 (23/11), 9:00 | TV1 |

### UC3, UC4 – Nghỉ phép

| Nhánh | Người | Việc | Tiêu chí | Mở PR | Merge | Review |
|---|---|---|---|---|---|---|
| `docs/leave-rules-week11` | TV2 Thanh | Phép năm (tỉ lệ khi chưa đủ 12 tháng, thâm niên), nghỉ theo sự kiện, đơn qua hai năm, hủy đơn đã duyệt, hoàn tất sau ngày kết thúc, nhắc đơn chờ lâu | AC-3.1.3, AC-3.1.4, AC-3.2.4, AC-4.5.3 | T4 (18/11), 12:00 | T4 (18/11), 21:00 | TV1, TV4 |
| `feat/leave-privacy` | TV1 Duong | Ẩn lý do nghỉ ốm với quản lý; audit HR đọc lý do; bỏ `comment` khỏi audit; email, payload outbox chỉ báo chung; email đơn CEO tới HR | AC-4.6.3, AC-4.6.5, AC-4.7.3, AC-4.7.4 | T3 (17/11) | T4 (18/11) | TV2, TV4 |
| `feat/leave-delegation` | TV1 Duong | Người duyệt thay (BR-06), tạo đơn hộ (BR-12) | AC-3.7.x, AC-4.3.x | T4 (18/11) | T5 (19/11) | TV2, TV4 |
| `fix/leave-balance-rules` | TV1 Duong | Cấp số dư theo luật, đơn qua hai năm, 403 khi chưa gắn hồ sơ, chỉ hoàn tất sau ngày kết thúc, hủy đơn đã duyệt | AC-3.1.3, AC-3.1.4, AC-3.2.4, AC-3.2.5, AC-4.5.3 | T5 (19/11) | T6 (20/11) | TV2, TV4 |
| `feat/leave-hr-approval` | TV1 Duong | `PENDING_HR`, cấu hình "Cần HR duyệt thêm", API `pending-hr`, `hr-approve`, `hr-reject` (BR-16) | AC-4.8.x | T5 (19/11) | T6 (20/11) | TV2, TV4 |
| `docs/test-cases-uc3-uc4` | TV4 Duy | Đổi quản lý khi đơn đang chờ, người duyệt thay, tạo đơn hộ, riêng tư, số dư, HR duyệt thêm | AC-3.x, AC-4.2.6, AC-4.3.x, AC-4.6.3, AC-4.7.3, AC-4.8.x | T5 (19/11), 21:00 | T6 (20/11) | TV2, TV1 |

### UC7, UC2 loại đơn vị, UC5

| Nhánh | Người | Việc | Tiêu chí | Mở PR | Merge | Review |
|---|---|---|---|---|---|---|
| `feat/audit-ui` | TV1 Duong | Màn hình tra cứu audit cho HR, ADMIN; `to` tính cả ngày kết thúc | AC-7.3.4, AC-7.3.5 | T6 (20/11) | T7 (21/11) | TV2, TV4 |
| `feat/org-unit-types` | TV1 Duong | Loại đơn vị và luật cha con (ADR-14), đổi seed | AC-2.4.8, AC-2.4.9, AC-2.2.3 | T6 (20/11) | T7 (21/11) | TV2, TV4 |
| `feat/document-ui` | TV1 Duong | Giao diện kho tài liệu cho HR và nhân viên, trang "Tra cứu tài liệu" `/documents` | AC-5.1.8, AC-5.2.7 | T7 (21/11) | CN (22/11) | TV2, TV4 |
| `docs/test-cases-uc2-uc5-uc7` | TV4 Duy | Ca loại đơn vị, giao diện kho tài liệu, lọc audit; audit không chứa giá trị nhạy cảm | AC-2.4.8, AC-2.4.9, AC-5.x, AC-7.1.2, AC-7.1.3, AC-7.3.1 | T7 (21/11), 21:00 | CN (22/11) | TV2, TV1 |

### Việc chung (bảo mật, P4, chuẩn bị staging)

| Nhánh | Người | Việc | Tiêu chí | Mở PR | Merge | Review |
|---|---|---|---|---|---|---|
| `infra/idp-hardening` | TV3 Bảo | Việc tuần 10, đã trễ hai lần: tắt tự đăng ký, chính sách mật khẩu, khóa 5 lần sai, thời hạn token và phiên | NFR-5.2, 5.3, 5.5, 5.9 | T3 (17/11), 21:00 | T4 (18/11) | TV1, TV4 |
| `fix/auth-email-verified` | TV1 Duong | Chỉ liên kết tài khoản khi email đã xác minh (T-02) | – | T3 (17/11) | T4 (18/11) | TV3, TV4 |
| `infra/profile-files` | TV3 Bảo | Bucket hồ sơ, lifecycle 30 ngày, quyền App Runner, alarm 429 cho phần file đã merge ở #87. Chỉ `validate`, `plan` | AC-1.10.7, AC-1.10.9, AC-1.14.5 | T4 (18/11), 21:00 | T5 (19/11) | TV1 |
| `infra/idp-mfa` | TV3 Bảo | MFA TOTP cho HR, ADMIN (Keycloak và Cognito) | NFR-5.4 | T5 (19/11), 21:00 | T6 (20/11) | TV1 |
| `docs/security-test-cases-week11` | TV4 Duy | Tự đăng ký, mật khẩu yếu, khóa 5 lần sai, hết phiên, MFA, 429, header | NFR-5.2 → 5.5, 5.9, 5.21, 5.22 | T6 (20/11), 21:00 | T7 (21/11) | TV1, TV3 |
| `test/load-k6` | TV4 Duy, TV1 hỗ trợ | Load test local 50 request/giây 15 phút; NFR-1.1 → 1.3, NFR-2.1, NFR-2.4 | NFR-1, NFR-2 | T6 (20/11) | CN (22/11) | TV1, TV3 |
| `infra/service-extraction` | TV3 Bảo | Hạ tầng ADR-15: SNS `hr-events` và filter policy, task Fargate notification và search, DB user riêng, X-Ray. Chỉ `validate`, `plan` | Tiêu chí ADR-15 | T7 (21/11), 21:00 | CN (22/11) | TV1 |
| `docs/slo-dashboard-cost` | TV3 Bảo | Dashboard theo SLI (SRS 6.13); chi phí/tháng theo load test và task thêm của ADR-15 | SRS 6.13 | CN (22/11), 12:00 | T2 (23/11) | TV1 |
| `feat/notification-service` | TV1 Duong | ADR-15 bước 1: `services/notification/`, payload outbox có người nhận, `MAIL_DRIVER=smtp\|ses` (thay `feat/mail-driver-ses`) | Tiêu chí ADR-15 | CN (22/11) | T2 (23/11) | TV3, TV4 |

### Việc tuần 10 còn tồn

| Việc | Người | Hạn mới |
|---|---|---|
| Sửa #68 (MinIO local): đổi image S3 cả nhóm pull được, rebase `dev` cho hết conflict | TV3 | T3 (17/11), 21:00 |
| Sửa #91 (biên bản tuần 10): viết ca cho #60, #63, #64 rồi chạy thật, ghi commit, "Phạm vi chưa kiểm" | TV4 | T4 (18/11), 21:00 |
| `docs/matrix-week10`: phần TV1 chưa làm (threat model, API tài liệu nếu thiếu) | TV2 | T5 (19/11), 21:00 |
| Review lại #70 (TV3 đã sửa 15/11) | TV1 | T3 (17/11) |

### Review phần TV1 đã viết thay

Theo [kế hoạch tổng mục 7.9](../ke-hoach-tong.md#79-phần-tv1-đã-làm-thay-thành-viên-đọc-review-và-góp-ý). Người viết là TV1;
thành viên đọc, đối chiếu và góp ý bằng review trên PR. Báo cáo ghi "review", không ghi là người viết. Các hạn 16/11 chưa làm
nên dời.

| Người | Tài liệu | PR | Hạn |
|---|---|---|---|
| TV2 Thanh | `requirements.md`, `spec.md` UC1, UC2; bảng FR trong SRS; ma trận phân quyền | #76, #71 | T3 (17/11), 21:00 |
| TV2 Thanh | `requirements.md`, `spec.md` UC3, UC4 | #76 | T4 (18/11), 12:00 |
| TV2 Thanh | Bản vẽ giao diện UC2 → UC7, đề xuất `frontend.md` mục 10.8 | #81 | T4 (18/11), 21:00 |
| TV2 Thanh | `requirements.md`, `spec.md` UC5, UC7 | #76 | T6 (20/11) |
| TV3 Bảo | `deploy.md` UC1 | #76 | T3 (17/11) |
| TV3 Bảo | `deploy.md` UC2 → UC7, `configuration.md` | #76, #74 | T6 (20/11) |
| TV4 Duy | `test.md` UC1 | #76 | T3 (17/11), 21:00 |
| TV4 Duy | Bản vẽ giao diện UC3, UC4 | #81 | T5 (19/11) |
| TV4 Duy | `test.md` UC3, UC4, UC5, UC7 | #76 | Trước hạn mở PR ca kiểm thử tương ứng |

Thứ tự phụ thuộc:

1. T3 (17/11): TV2 review UC1, UC2 và mở `docs/org-integrity-rules`; TV4 mở `docs/test-cases-uc1`; TV3 mở `infra/idp-hardening`,
   sửa #68.
2. T4 (18/11), 12:00: TV2 mở `docs/leave-rules-week11` → TV1 làm `fix/leave-balance-rules` T5; TV4 viết ca UC3, UC4.
3. T6 (20/11): UC3, UC4 dev xong → TV4 có đủ ca UC3, UC4.
4. CN (22/11): UC5 dev xong; TV4 merge biên bản UC1 → **UC1 xong**; TV3 merge hạ tầng ADR-15.
5. T2 (23/11), 9:00: mọi người điền "Việc đã làm"; TV1 viết báo cáo, PR `dev` → `main`, tag `week-11`.
6. T3 (24/11): TV3 `apply` staging (tuần 12), TV4 kiểm thử UC1, UC3, UC4 trên staging.

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

_Điền cuối tuần._ Lịch đã có ở kế hoạch tổng mục 7.3 (staging `apply` T3 24/11, hạ tầng ADR-15) và 7.7 (UC6 qua search service,
trợ lý), cùng biên bản kiểm thử UC3, UC4, UC2, UC5, UC7 trên staging.

## 3. Quyết định quan trọng

### Làm xong từng chức năng một (14/11/2026)

**Bối cảnh:** đến 14/11 chưa chức năng nào đạt đủ tiêu chí, dù UC nào cũng có một phần. Tuần 10 mở nhiều nhánh cùng lúc nên
cuối tuần việc nào cũng dở.

**Quyết định:** TV1 code một chức năng tại một thời điểm theo thứ tự UC1 → UC3, UC4 → UC7 → UC5 → UC6; chức năng chỉ xong khi
sẵn sàng lên cloud. Chi tiết: kế hoạch tổng mục 7.

**Khi nào xem lại:** nếu UC3, UC4 chưa dev xong vào T6 (20/11), dời UC5 sang tuần 12 và ghi vào báo cáo.

### Nâng mục tiêu tuần 11 lên 5 UC (16/11/2026)

**Bối cảnh:** UC1 code xong ngày 16/11, sớm 5 ngày so với kế hoạch 14/11. Nhóm trưởng muốn tuần 11 code xong 4–5 UC.

**Quyết định:** tuần 11 code UC3, UC4, UC7, UC5 (và loại đơn vị của UC2) sau UC1; UC6 làm tuần 12 cùng search service của
ADR-15. Ca kiểm thử của TV4 và quy tắc của TV2 dời lên sớm hơn để đi trước code.

**Đánh đổi:** biên bản kiểm thử của UC3, UC4, UC5, UC7 chạy ở tuần 12 trên staging, chậm hơn code vài ngày. Thời gian review
của TV2, TV4 ngắn (24 giờ một PR).
