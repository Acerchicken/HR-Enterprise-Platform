# Tuần 6 – TV2: API specification, Data model, ADR-02

## Việc đã làm

| Việc | Output | Trạng thái |
|---|---|---|
| Viết API specification REST /api/v1 | Mục 1 | Xong |
| Thiết kế data model và data ownership | Mục 2 | Xong |
| Viết ADR-02 (PostgreSQL vs NoSQL) | [README tuần 6](README.md#adr-02--postgresql-thay-vì-nosql) | Xong |

## 1. API specification (REST, /api/v1)

| Method | Endpoint | Ai được gọi | Mô tả |
|---|---|---|---|
| GET | /me | Mọi vai trò | Hồ sơ và role của người đang đăng nhập |
| GET | /employees?q=&dept= | Mọi vai trò | Danh bạ + tìm kiếm, phân trang |
| GET | /employees/{id} | Theo quyền | Hồ sơ; ẩn trường nhạy cảm nếu không phải HR |
| PATCH | /employees/{id} | Employee (trường liên hệ), HR | Cập nhật hồ sơ, ghi audit |
| GET | /departments, /departments/{id}/members | Mọi vai trò | Cây tổ chức, thành viên phòng ban |
| GET | /leave-balances/me | Employee | Số dư phép theo loại |
| POST | /leave-requests | Employee | Tạo và gửi đơn; bắt buộc header Idempotency-Key |
| GET | /leave-requests?scope=mine\|team\|all | Theo role | Danh sách đơn |
| GET | /leave-requests/{id} | Người tạo, manager trực tiếp, HR | Chi tiết + lịch sử trạng thái |
| POST | /leave-requests/{id}/approve, /reject | Manager trực tiếp | Quyết định; 409 nếu đơn đã được quyết định khác |
| POST | /leave-requests/{id}/complete | HR | Ghi nhận, trừ số dư chính thức |
| POST | /leave-requests/{id}/cancel | Người tạo | Hủy khi chưa được duyệt |
| POST | /documents | HR | Tạo metadata, trả presigned upload URL |
| GET | /documents?q= | Mọi vai trò (lọc quyền) | Tìm tài liệu chính sách |
| GET | /documents/{id}/download | Theo phạm vi tài liệu | Presigned download URL ngắn hạn |
| GET | /audit-logs?entity=&actor=&from=&to= | HR, Admin | Tra cứu audit |

Quy ước chung:
- Xác thực bằng Bearer JWT (OIDC); phân quyền kiểm tra trong từng module, không chỉ ở cổng vào.
- Version qua tiền tố /v1.
- Lỗi trả về cùng một format `{code, message, traceId}` với mã 400/401/403/404/409/422.
- Approve lần hai với cùng quyết định trả lại kết quả cũ, không tạo thêm side-effect.

## 2. Data model & data ownership

| Entity | Module sở hữu | Trường chính |
|---|---|---|
| employee | Employee | id, employee_code, full_name, work_email, phone, department_id, position_id, manager_id, hire_date, status |
| employee_sensitive | Employee | employee_id, national_id_enc, bank_account_enc, salary_enc (mã hóa ở tầng ứng dụng) |
| department | Organization | id, name, parent_id, head_employee_id |
| position | Organization | id, title, level |
| leave_type | Leave | id, code, name, max_days_per_year |
| leave_balance | Leave | employee_id, leave_type_id, year, entitled, used, pending |
| leave_request | Leave | id, employee_id, leave_type_id, start_date, end_date, days, reason, status, approver_id, version, idempotency_key, created_at |
| leave_request_history | Leave | request_id, from_status, to_status, actor_id, comment, at |
| document | Document | id, title, category, object_key, access_scope (toàn công ty / phòng ban / role), status, version, uploaded_by |
| audit_log | Audit | id, actor_id, action, entity_type, entity_id, changed_fields, ip, at (append-only) |
| outbox | Module phát event | id, event_type, payload, status, created_at |

Một PostgreSQL, mỗi module một schema. Module khác chỉ đọc dữ liệu qua interface của module sở hữu, không JOIN chéo schema,
để có thể tách thành service sau này.

Index chính: leave_request(employee_id, status), leave_request(approver_id, status), audit_log(entity_type, entity_id, at),
unique(employee_id, idempotency_key).
