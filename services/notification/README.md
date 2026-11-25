# Notification service

Service gửi email, tách khỏi worker của backend ở bước 1 của
[ADR-15](../../docs/architecture/adr/ADR-15-service-extraction.md). Không import code của `backend/` (CI kiểm).

- Nghe queue `notification.leave` (RabbitMQ local, bind `leave.*` trên exchange `hr.events`; SQS trên AWS): event nghỉ phép
  (UC3, UC4) và yêu cầu cập nhật hồ sơ (UC1).
- **Không tra cứu người nhận.** API (outbox publisher) gắn sẵn danh sách email vào event lúc đẩy lên queue
  (`payload.mail = [{ group: 'OWNER' | 'APPROVERS' | 'HR', to: [...] }]`, event-carried state transfer). Service chỉ có quyền
  trên schema `notification` (user `notification_svc`).
- Nội dung email là câu báo chung theo nhóm người nhận (BR-15, NFR-5.18), xem `src/templates.ts`. Nhiều người nhận thì đặt ở Bcc.
- Chống trùng: `notification.processed_event` ghi id event và từng nhóm đã gửi (`<id>#<nhóm>`), nên queue giao lại không gửi lại
  nhóm đã nhận.
- Thử lại (NFR-3.5): mỗi lần gửi chờ tối đa `MAIL_TIMEOUT_MS` (≤ 10 s), tối đa `MAIL_ATTEMPTS` lần, chờ 1 s, 2 s, 4 s giữa các
  lần. Vẫn lỗi thì event vào DLQ (`notification.leave.dlq`; SQS: sau `maxReceiveCount` lần nhận).
- HR nhận tối đa một email báo có yêu cầu cập nhật hồ sơ trong mỗi `HR_DIGEST_MINUTES` phút (AC-1.9.13).

| Thư mục, file | Nội dung |
|---|---|
| `src/handler.ts` | Xử lý một event: chống trùng, gửi theo nhóm, gộp email HR |
| `src/mail/` | Gửi SMTP (Mailpit) hoặc SES, thử lại có giãn cách |
| `src/messaging/` | Consumer RabbitMQ (local) và SQS (AWS) |
| `src/templates.ts` | Tiêu đề, nội dung email |

## Chạy

- Docker: `docker compose up -d --build` ở thư mục gốc. Kiểm: `curl http://localhost:3200/health`; email xem ở Mailpit
  http://localhost:8025.
- Không Docker: `npm ci`, đặt biến theo [configuration.md mục 2b](../../docs/development/configuration.md), `npm run start:dev`.
- Test: `npm test`; thêm `TEST_DB_URL=postgres://hr:hr@localhost:5432/hr` (đã chạy migration của backend) để chạy cả test với
  PostgreSQL.

## Khi triển khai bản này lần đầu

Event đã nằm trong queue từ bản API cũ không có `payload.mail`: service báo lỗi và chuyển vào DLQ (không lặng lẽ bỏ email).
Event tài khoản phát trước bản này (routing key `leave.*` cũ) cũng nằm trong `notification.leave`: service chuyển chúng vào DLQ.
Triển khai API và notification cùng lúc, hoặc để worker cũ xử lý hết queue trước khi dừng. Còn sót trong DLQ thì lấy id
event (`messageId`, cũng là `leave.outbox.id`) và cho API mới đẩy lại kèm người nhận:
`UPDATE leave.outbox SET published_at = NULL WHERE id IN (...)`. Id giữ nguyên nên không gửi trùng.
