# UC4 – Duyệt đơn nghỉ: triển khai

> Cách chạy chung, staging, rollback chung: [README](../README.md#môi-trường). File này chỉ ghi phần riêng của UC4.
> Module, bảng và migration dùng chung với [UC3](../UC3-create-leave-request/deploy.md).

## 1. Thành phần

| Thành phần | Phần của UC4 |
|---|---|
| API | `backend/src/modules/leave` (pending-approval, approve, reject, complete, chi tiết và lịch sử) |
| Outbox, queue, worker | API ghi event vào `leave.outbox` trong cùng giao dịch; publisher đẩy lên RabbitMQ hoặc SQS; worker `backend/src/worker` gửi email, chống gửi trùng bằng `notification.processed_event` |
| Web | `/leave/approvals` (quản lý, HR với đơn CEO), `/leave/hr` (HR hoàn tất), `/leave/:id` |
| Database | `leave.leave_request_history`, `leave.outbox`, `notification.processed_event` |

## 2. Biến môi trường

| Biến | Local | Staging | Thiếu thì sao |
|---|---|---|---|
| `QUEUE_DRIVER` | Suy ra `rabbitmq` | `sqs` | Worker không khởi động nếu `none` |
| `RABBITMQ_URL` / `SQS_QUEUE_URL`, `AWS_REGION` | `amqp://hr:hr@rabbitmq:5672` | URL queue SQS | Event nằm trong outbox |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` | Mailpit `1025` | Đặt ở task definition worker | Email lỗi, event thử lại rồi vào DLQ |

## 3. Hạ tầng

| Môi trường | Tài nguyên | File |
|---|---|---|
| Local | RabbitMQ (queue `notification.leave`, DLQ `notification.leave.dlq`), Mailpit | `docker-compose.yml` |
| Staging | SQS + DLQ, ECS Fargate worker, email (SES theo `infra/documents-email`, chưa merge) | `infra/staging/sqs_worker.tf` |

## 4. Các bước

- Worker deploy cùng image với API (lệnh `node dist/worker/main.js`). Deploy Staging cập nhật cả App Runner và ECS worker.
- Kiểm DLQ sau mỗi lần deploy: DLQ có message là email đã hỏng sau các lần thử.

## 5. Kiểm tra sau deploy

1. `manager@hr.local` mở "Đơn chờ duyệt", duyệt đơn vừa tạo ở UC3: đơn `APPROVED`, nhân viên nhận email.
2. `hr@hr.local` mở "Đơn cần hoàn tất", hoàn tất: số dư `used` tăng, `pending` giảm.
3. DLQ rỗng; log worker không có lỗi gửi mail.

## 6. Rollback và sự cố

- Worker lỗi: quyết định vẫn được lưu, email chờ trong queue. Rollback worker về image cũ, message được xử lý lại; worker chống
  gửi trùng theo id event.
- Message trong DLQ: sửa nguyên nhân rồi đẩy lại vào queue chính (RabbitMQ shovel hoặc SQS redrive).

## 7. Còn thiếu

- Biến của worker (`SMTP_*`, `QUEUE_DRIVER`, `SQS_QUEUE_URL`) chưa có trong Terraform ([configuration.md mục 5](../../development/configuration.md#5-điểm-còn-thiếu-trên-staging-13112026)).
- Người duyệt thay (FR-4.3) cần bảng phân công mới: thêm migration và ghi vào đây khi làm `feat/leave-delegation`.
