# Tuần 6 – TV3 (Bảo): Storage & cache, Sync/Async, Event model

## Việc đã làm

| Việc | Output | Trạng thái |
|---|---|---|
| Chọn chiến lược lưu trữ và cache cho từng loại dữ liệu | Mục 1 (ADR-07) | Xong |
| Lập bảng sync/async | Mục 2 | Xong |
| Định nghĩa event model | Mục 3 | Xong |

## 1. Storage & cache strategy

| Loại dữ liệu | Ví dụ | Lưu ở đâu | Lý do |
|---|---|---|---|
| Transactional | leave_request, leave_balance | PostgreSQL | ACID; số dư phép cần strong consistency |
| Reference | department, position, leave_type | PostgreSQL + cache in-memory | Đọc nhiều, ít đổi |
| User data | employee, employee_sensitive | PostgreSQL, trường nhạy cảm mã hóa | Quan hệ nhiều, cần bảo vệ |
| Document | PDF/DOCX chính sách | Object storage; metadata trong PostgreSQL | File lớn không để trong DB |
| Events | LeaveRequestApproved | Outbox → message queue | Không mất event khi queue lỗi tạm thời |
| Audit | audit_log | PostgreSQL append-only | Truy vết, cùng transaction với thao tác |
| Search index | Tên, phòng ban, nội dung tài liệu | PostgreSQL full-text | Quy mô nhỏ, không cần search engine riêng |

Không dùng Redis ở MVP (ADR-07). Dữ liệu tham chiếu cache in-memory kiểu cache-aside, TTL 10 phút, xóa cache khi cập nhật.
Không cache số dư phép, quyền truy cập và dữ liệu nhạy cảm.

## 2. Sync vs Async

| Tương tác | Kiểu | Lý do |
|---|---|---|
| Đăng nhập, xem hồ sơ, tìm kiếm | Sync | Người dùng chờ kết quả |
| Tạo / gửi đơn | Sync | Phải trả mã đơn và kết quả kiểm tra số dư ngay |
| Duyệt / từ chối, HR hoàn tất | Sync | Đơn + số dư + audit trong một ACID transaction |
| Ghi audit log | Sync, cùng transaction | Không được mất log |
| Gửi thông báo email / in-app | Async (queue) | Provider có thể lỗi hoặc chậm, cần retry, người dùng không phải chờ |
| Index tài liệu sau upload | Async (queue → worker) | Trích text mất thời gian; giao diện hiện "Đang xử lý…" |
| Export nghỉ phép cho Payroll | Async batch hàng đêm | Hệ thống đối tác kiểu legacy |

## 3. Event model

| Event | Phát bởi | Consumer |
|---|---|---|
| LeaveRequestSubmitted | Leave | Notification (báo manager) |
| LeaveRequestApproved | Leave | Notification (báo employee và HR) |
| LeaveRequestRejected | Leave | Notification (báo employee) |
| LeaveRequestCompleted | Leave | Notification; Payroll export (sau MVP) |
| LeaveRequestCancelled | Leave | Notification |
| DocumentUploaded | Document | Indexer; embedding cho RAG (tuần 12) |

Event được ghi vào bảng outbox trong cùng transaction với đơn, rồi một publisher đẩy sang queue (ADR-03).
