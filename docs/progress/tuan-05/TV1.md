# Tuần 5 – TV1 (nhóm trưởng): Problem statement, Users, Architecture Canvas, ADR-00

## Việc đã làm

| Việc | Output | Trạng thái |
|---|---|---|
| Viết business problem statement có số đo | Mục 1 | Xong |
| Xác định users và stakeholders | Mục 2 | Xong |
| Tổng hợp Architecture Canvas từ output của cả nhóm | Mục 3 | Xong |
| Viết ADR-00 | [README tuần 5](README.md#adr-00--dùng-managed-services-cho-database-storage-và-identity) | Xong |

## 1. Business problem statement

Một doanh nghiệp (giả định) khoảng 2,000 nhân viên, 25 phòng ban, 3 văn phòng, đang quản lý hồ sơ nhân sự bằng Excel và
duyệt đơn nghỉ phép qua email. Doanh nghiệp cần một HR platform nội bộ tập trung vì hồ sơ bị phân tán, đơn từ thất lạc và
không truy vết được ai đã xem hay sửa dữ liệu nhạy cảm.

Người dùng chính là nhân viên, quản lý trực tiếp, HR và quản trị hệ thống.

Kết quả mong đợi (đo được):
- Thời gian duyệt đơn giảm từ khoảng 3 ngày xuống dưới 1 ngày làm việc.
- 100% thao tác trên dữ liệu nhạy cảm được audit.
- Nhân viên tự tra cứu thông tin và chính sách mà không phải hỏi HR.

## 2. Users & stakeholders

| Vai trò | Số lượng (giả định) | Nhu cầu chính | Phạm vi dữ liệu được xem |
|---|---|---|---|
| Employee | ~2,000 | Xem/sửa hồ sơ cá nhân, tạo đơn, tra cứu chính sách và danh bạ | Dữ liệu của mình + danh bạ công khai |
| Manager | ~150 | Duyệt đơn, xem thông tin team | Nhân viên trực thuộc |
| HR Staff | ~15 | Xử lý đơn, quản lý hồ sơ, đăng tài liệu, xem audit | Hồ sơ trong phạm vi được giao, gồm trường nhạy cảm |
| Administrator | 2–3 | Quản lý tài khoản, role, cấu hình | Cấu hình hệ thống; mặc định không xem dữ liệu nhạy cảm |

Stakeholder ngoài hệ thống: ban giám đốc (cần báo cáo) và bộ phận Payroll (nhận dữ liệu nghỉ phép – chỉ export, ngoài phạm vi MVP).

## 3. Architecture Canvas

| # | Ô | Nội dung |
|---|---|---|
| 1 | Business | Số hóa hồ sơ và quy trình nghỉ phép; duyệt < 1 ngày; audit 100% dữ liệu nhạy cảm |
| 2 | Users | Employee ~2,000 · Manager ~150 · HR ~15 · Admin 2–3 |
| 3 | Requirements | UC1–UC7 + AI assistant (mở rộng) |
| 4 | NFR | p95 < 300/500 ms · 99.5% · RPO 1 giờ / RTO 4 giờ · < 100 USD/tháng |
| 5 | Workload | Online transactional, read-heavy, peak ≈ 10 RPS, thiết kế cho 50 RPS |
| 6 | Data | Hồ sơ, đơn, số dư → SQL · tài liệu → object storage · audit → SQL append-only |
| 7 | Architecture | DNS → CDN/WAF → Load balancer → App (2 instance) → PostgreSQL + object storage |
| 8 | Cloud | Managed services; provider chưa chốt |
| 9 | Security | OIDC/SSO-ready, RBAC + phạm vi phòng ban, mã hóa trường nhạy cảm, audit log |
| 10 | Cost | < 100 USD/tháng: tier nhỏ nhất, tắt môi trường staging ngoài giờ demo |

## Vướng mắc

- Các con số 2,000 nhân viên, 99.5%, < 100 USD/tháng là giả định của nhóm, cần thầy xác nhận có hợp lý không.
