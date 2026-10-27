# Tuần 6 – TV1 (nhóm trưởng): Capability map, Application components, ADR-01, ADR-03

## Việc đã làm

| Việc | Output | Trạng thái |
|---|---|---|
| Lập business capability map | Mục 1 | Xong |
| Thiết kế application components | Mục 2 | Xong |
| Viết ADR-01 (Monolith vs Microservices) | [README tuần 6](README.md#adr-01--modular-monolith-thay-vì-microservices) | Xong |
| Viết ADR-03 (Sync vs Async) | [README tuần 6](README.md#adr-03--workflow-đồng-bộ-thông-báo-và-index-bất-đồng-bộ) | Xong |

## 1. Business capability map

| Nhóm | Capability |
|---|---|
| Core HR | Employee profile · Organization (phòng ban, chức danh, quan hệ quản lý) |
| HR Operations | Leave request & approval · Leave balance |
| Knowledge | Policy documents · Self-service search · AI assistant (tuần 12) |
| Platform | Identity & access · Audit · Notification |

Một capability không đồng nghĩa với một microservice: các capability trên được hiện thực thành module trong cùng một deployment unit (ADR-01).

## 2. Application components

| Module | Trách nhiệm | Dữ liệu sở hữu | Giao tiếp |
|---|---|---|---|
| Identity & Access | Xác thực token OIDC, map tài khoản ↔ nhân viên, role, kiểm tra quyền | user_account, role_assignment | Gọi in-process từ mọi module |
| Employee | Hồ sơ nhân viên, trường nhạy cảm (mã hóa) | employee, employee_sensitive | REST /employees |
| Organization | Phòng ban, chức danh, sơ đồ tổ chức | department, position | REST /departments |
| Leave | Đơn nghỉ, state machine, số dư phép | leave_type, leave_balance, leave_request, leave_request_history | REST /leave-requests; phát event |
| Document | Metadata, phạm vi truy cập, presigned URL | document | REST /documents; phát DocumentUploaded |
| Search | Tìm danh bạ và tài liệu, lọc theo quyền | Search index (full-text) | Tham số q= trên /employees và /documents |
| Audit | Ghi và truy vấn log append-only | audit_log | Interface in-process; REST /audit-logs |
| Worker (Notification, Indexer) | Tiêu thụ event: gửi email/in-app, trích text tài liệu để index | notification, processed_event | Message queue |

Module Leave cập nhật đơn, số dư, audit và ghi event vào outbox trong cùng một transaction; mọi việc sau đó (email, index)
đi qua queue nên lỗi ở phía đó không ảnh hưởng quy trình duyệt.
