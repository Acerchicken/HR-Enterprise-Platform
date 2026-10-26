# Tuần 6 – TV4: Integration architecture, Failure handling

## Việc đã làm

| Việc | Output | Trạng thái |
|---|---|---|
| Thiết kế integration với 5 hệ thống ngoài | Mục 1 | Xong |
| Phân tích 8 tình huống lỗi và cách xử lý | Mục 2 | Xong |
| Map capability sang dịch vụ của cloud provider | – | Chưa làm: chờ chốt provider |

## 1. Integration architecture

| Hệ thống ngoài | Pattern | Sync / Async | Xử lý lỗi |
|---|---|---|---|
| Identity provider (OIDC) | OIDC redirect + JWKS | Sync | Cache JWKS; IdP lỗi → không đăng nhập mới được, token còn hạn vẫn dùng |
| Email service | Queue → worker gọi REST/SMTP | Async | Retry exponential backoff tối đa 5 lần → dead-letter queue |
| Object storage | Presigned URL | Upload sync từ client; xử lý sau upload async | Metadata chỉ chuyển "active" khi file đã có |
| Payroll (mô phỏng, ngoài MVP) | File export CSV hàng đêm | Async batch | Job chạy lại được, idempotent theo ngày |
| LLM API (tuần 12) | REST | Sync có timeout | Timeout + fallback chỉ đến tài liệu gốc |

## 2. Failure handling

| Tình huống | Cách xử lý |
|---|---|
| Client timeout khi gửi đơn, bấm gửi lại | Idempotency-Key → trả lại đơn đã tạo, không tạo đơn thứ hai |
| Manager duyệt hai lần hoặc từ hai tab | Kiểm tra trạng thái + optimistic locking (version) → trả kết quả cũ hoặc 409 |
| Email provider lỗi | Retry backoff tối đa 5 lần → dead-letter queue + cảnh báo; trạng thái đơn không đổi |
| Message bị gửi trùng | Consumer lưu eventId đã xử lý (processed_event), bỏ qua bản trùng |
| Queue lỗi tạm thời | Event nằm trong outbox, publisher đẩy lại khi queue hoạt động |
| Database lỗi | Backup tự động + point-in-time recovery (RPO ≤ 1 giờ); app trả 503 kèm thông báo |
| Identity provider lỗi | Không đăng nhập mới được; phiên còn hạn vẫn dùng được |
| Upload file lỗi giữa chừng | Metadata ở trạng thái "pending", job dọn dẹp sau 24 giờ |

Mỗi dòng của bảng này sẽ thành một kịch bản thử lỗi ở tuần 11 (P4 – Production Engineering).
