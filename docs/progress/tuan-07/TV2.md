# Tuần 7 – TV2: Migration, module Employee, Organization, Audit, OpenAPI

## Việc đã làm

| Việc | Output | Trạng thái |
|---|---|---|
| Migration đầu tiên | `backend/src/database/migrations/1729900000000-InitSchemas.ts` | Xong |
| Module Employee | `backend/src/modules/employee/` | Xong |
| Module Organization | `backend/src/modules/organization/` | Xong |
| Module Audit | `backend/src/modules/audit/` | Xong |
| Đặc tả OpenAPI | `docs/openapi.yaml` (sinh bằng `npm run openapi`) | Xong |

## 1. Database

| Schema | Bảng |
|---|---|
| org | department (parent_id tạo cây), position |
| employee | employee, employee_sensitive (chỉ chứa dữ liệu đã mã hóa) |
| iam | user_account, role_assignment |
| leave | leave_type, leave_balance, leave_request, leave_request_history |
| audit | audit_log |

Ràng buộc đặt trong database:
- `audit_log`: trigger chặn UPDATE và DELETE (QĐ-05).
- `leave_balance`: `used + pending ≤ entitled`.
- `leave_request`: unique `(employee_id, idempotency_key)`; `end_date ≥ start_date`.
- `employee`: không tự làm quản lý của chính mình; `status` chỉ nhận ACTIVE, ON_LEAVE, TERMINATED.

Index: trigram trên tên + email + mã nhân viên (tìm được khi gõ một phần tên); `(employee_id, status)` và
`(approver_id, status)` cho đơn nghỉ; `(entity_type, entity_id, at)` cho audit.

Lệnh: `npm run migration:run`, `npm run migration:revert`.

## 2. API đã chạy

| Method | Endpoint | Ai gọi được |
|---|---|---|
| GET | /health | Không cần đăng nhập |
| GET | /me | Mọi người |
| GET | /employees?q=&dept=&page=&size= | Mọi người |
| GET | /employees/{id} (thêm ?include=sensitive) | Theo bảng phân quyền mục 3 |
| PATCH | /employees/{id} | Chính mình (SĐT, địa chỉ), HR |
| POST | /employees | HR |
| GET | /employees/{id}/direct-reports | Mọi người |
| GET | /departments, /departments/tree, /departments/{id}, /departments/{id}/members | Mọi người |
| POST, PATCH | /departments, /departments/{id} | HR, Admin |
| GET | /positions | Mọi người |
| GET | /audit-logs?entity=&entityId=&actor=&from=&to= | HR, Admin |

Mọi endpoint có tiền tố `/api/v1`. Thử trực tiếp ở Swagger: http://localhost:3000/api/docs.

## 3. Phân quyền trên hồ sơ

| Người xem | Thấy gì | Sửa được gì |
|---|---|---|
| Chính mình | Danh bạ + ngày sinh, địa chỉ, ngày vào làm, trạng thái | SĐT, địa chỉ |
| Quản lý trực tiếp | Như trên, với nhân viên trực thuộc | Không |
| Nhân viên khác, quản lý khác team | Chỉ thông tin danh bạ | Không |
| HR | Toàn bộ; trường nhạy cảm chỉ khi gọi `?include=sensitive`, mỗi lần đều ghi audit | Mọi trường |
| Admin | Chỉ thông tin danh bạ | Không |

Quy tắc viết thành hàm thuần trong `employee-access.ts`, có 7 unit test.

Các kiểm tra khác khi sửa hồ sơ:
- `version` cũ → 409 (optimistic locking).
- Gán quản lý tạo vòng lặp (A quản lý B, B quản lý A) → 400; kiểm tra bằng truy vấn đệ quy lên chuỗi quản lý.
- Đổi phòng ban cha tạo vòng lặp trong cây tổ chức → 400.

## 4. Audit

`AuditService.record(entry, manager)` được các module khác gọi trong cùng transaction. Các thao tác đang ghi audit:
tạo/sửa nhân viên, tạo/sửa phòng ban, HR xem trường nhạy cảm (`VIEW_SENSITIVE`). Khi sửa lương hay CCCD, audit chỉ ghi
tên trường với giá trị `***`. Mỗi dòng audit có `traceId` để đối chiếu với log của request.

## 5. Test

- Unit test: phân quyền hồ sơ (7), mã hóa trường (4), cây tổ chức và vòng lặp (2), cache (2).
- 18 e2e test trong `backend/test/app.e2e-spec.ts`, chạy với database đã seed: `npm run test:e2e`.

## Việc mang sang tuần 8

Bảng outbox, publisher đẩy event sang queue, API tra cứu đơn nghỉ theo scope.
