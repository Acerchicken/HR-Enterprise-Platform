# Tuần 11 – TV1 (Duong, nhóm trưởng): 5 UC code xong

Vai trò: code chính, review PR, merge PR, báo cáo thứ 2. Mỗi lúc chỉ code một UC theo thứ tự ở
[kế hoạch tổng mục 7.2](../ke-hoach-tong.md#72-thứ-tự-và-mốc); việc chung (bảo mật, ADR-15) xen giữa.

## Hạn chót

| Hạn | Việc |
|---|---|
| CN (15/11) – T2 (16/11) | **Đã xong:** UC1 (#80, #84 → #87, #89, #90), rate limit và header (#85, #93), ADR-14 (#83), ADR-15 (#92) |
| **T3 (17/11)** | Mở PR `feat/leave-privacy`, `fix/auth-email-verified`; review lại #70 của TV3 |
| **T4 (18/11)** | Mở PR `feat/leave-delegation`; merge `infra/idp-hardening` nếu đạt |
| **T5 (19/11)** | Mở PR `fix/leave-balance-rules` (theo `docs/leave-rules-week11` của TV2), `feat/leave-hr-approval` |
| **T6 (20/11)** | Mở PR `feat/audit-ui`, `feat/org-unit-types`; hỗ trợ TV4 chạy `test/load-k6` |
| **T7 (21/11)** | Mở PR `feat/document-ui` |
| **CN (22/11)** | Mở PR `feat/notification-service` (cần merge trước khi TV3 `apply` staging T3 24/11) |
| Trong 24 giờ kể từ khi PR mở | Review PR của TV2, TV3, TV4 trên GitHub |
| **T2 (23/11)** | Báo cáo tuần 11, tạo thư mục tuần 12, PR `dev` → `main`, tag `week-11`; mở `docs/adr-16-policy-assistant` |

## Việc cần làm

### 1. UC3, UC4 – nghỉ phép (T3 → T6)

- `feat/leave-privacy` (mức M, làm trước): ẩn lý do nghỉ ốm với quản lý ở chi tiết, danh sách, lịch sử; audit khi HR đọc lý do;
  bỏ `comment` khỏi audit; email và payload outbox chỉ báo chung; email đơn CEO tới HR.
- `feat/leave-delegation`: người duyệt thay không chồng lấn, quyền duyệt theo ngày thực hiện (BR-06); tạo đơn hộ, lưu riêng người
  tạo và chủ đơn (BR-12). Dùng bản vẽ UC4 ở #81.
- `fix/leave-balance-rules`: theo `leave-rules.md` sau khi TV2 merge `docs/leave-rules-week11`. Nếu đến T5 (19/11) chưa có thì làm
  theo đề xuất trong `requirements.md` UC3, UC4 và ghi trong mô tả PR để TV2 góp ý.
- `feat/leave-hr-approval`: `PENDING_HR`, cấu hình loại phép, API `pending-hr`, `hr-approve`, `hr-reject` (BR-16).

### 2. UC7, UC2, UC5 (T6 → CN)

- `feat/audit-ui`: tra cứu audit cho HR, ADMIN theo đối tượng, người thực hiện, khoảng thời gian; `to` tính cả ngày kết thúc.
- `feat/org-unit-types`: cột loại đơn vị, luật loại cha, loại con, đổi seed (Công ty, Trung tâm, Phòng, Nhóm) theo ADR-14.
  Migration mới, không sửa migration cũ.
- `feat/document-ui`: trang "Tra cứu tài liệu" `/documents`, danh sách theo phạm vi, tải lên (HR), phiên bản; dùng API #64 và bản
  vẽ UC5 ở #81. Ô tìm tài liệu để `feat/search-service` (tuần 12).

### 3. Việc chung

- `fix/auth-email-verified`: chỉ liên kết tài khoản khi `email_verified`; có test.
- `feat/notification-service` (ADR-15 bước 1, thay `feat/mail-driver-ses` lên kế hoạch 14/11): tách worker thành
  `services/notification/` (package và Dockerfile riêng, không import `backend/`); API ghi sẵn `recipientEmail`, `recipientName`
  vào payload outbox; driver `MAIL_DRIVER=smtp|ses` (local SMTP tới Mailpit, AWS dùng `@aws-sdk/client-sesv2` với task role).
  Unit test hai driver; cập nhật `configuration.md`, `event-contract.md`; thống nhất biến môi trường với `infra/service-extraction`
  của TV3.

### 4. Việc của nhóm trưởng

- Mỗi PR cập nhật `requirements.md` (bỏ *chưa có*), mục 12 `spec.md`, bảng phủ `test.md`, cột FR trong SRS.
- Merge sau 24 giờ nếu chưa có review, ghi trong báo cáo PR nào thiếu review.
- Báo cáo tuần ghi đúng người viết: tài liệu TV1 viết thay là của TV1; thành viên được ghi phần review.

## Góp ý review

_Góp ý ghi trực tiếp trên PR._

## Việc đã làm

_Điền T2 (23/11)._
