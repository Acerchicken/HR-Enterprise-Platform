# UC4 – Duyệt đơn nghỉ: triển khai

> Cách chạy chung, staging, rollback chung: [README](../README.md#môi-trường). File này chỉ ghi phần riêng của UC4.
> Module, bảng và migration dùng chung với [UC3](../UC3-create-leave-request/deploy.md).

## 1. Thành phần

| Thành phần | Phần của UC4 |
|---|---|
| API | `backend/src/modules/leave` (pending-approval, approve, reject, complete, chi tiết và lịch sử) |
| Outbox, queue, notification service | API ghi event vào `leave.outbox` trong cùng giao dịch; publisher gắn email người nhận (`NotificationRecipients`) rồi đẩy lên RabbitMQ hoặc SQS; `services/notification` gửi email, chống gửi trùng bằng `notification.processed_event` (từ 26/11, trước đó là worker của backend) |
| Web | `/approvals?type=leave` (quản lý, HR với đơn CEO), `/approvals?type=leave-complete` (HR hoàn tất), `/leave/:id`; hiện code còn `/leave/approvals`, `/leave/hr` (sẽ chuyển tiếp) |
| Database | `leave.leave_request_history`, `leave.outbox`, `notification.processed_event` |

## 2. Biến môi trường

| Biến | Local | Staging | Thiếu thì sao |
|---|---|---|---|
| `QUEUE_DRIVER` | Suy ra `rabbitmq` | `sqs` | API `none`: event nằm trong outbox |
| `RABBITMQ_URL` / `SQS_QUEUE_URL`, `AWS_REGION` | `amqp://hr:hr@rabbitmq:5672` | URL queue SQS | Event nằm trong outbox |
| Notification service: `NOTIFICATION_DB_URL`, `MAIL_DRIVER`, `SMTP_*`, `MAIL_TIMEOUT_MS`, `MAIL_ATTEMPTS` ([configuration.md mục 2b](../../development/configuration.md)) | Mailpit `1025` | `MAIL_DRIVER=ses`, `SMTP_FROM`, user `notification_svc` | Email lỗi: thử lại 3 lần có giãn cách, rồi vào DLQ |

## 3. Hạ tầng

| Môi trường | Tài nguyên | File |
|---|---|---|
| Local | RabbitMQ (queue `notification.leave`, DLQ `notification.leave.dlq`), service `notification`, Mailpit | `docker-compose.yml` |
| Staging | SQS + DLQ, ECS Fargate cho notification service, SES (identity người gửi, quyền `ses:SendEmail` cho task notification). Terraform cho task notification: PR riêng | `infra/staging/sqs_worker.tf`, `ses_alarms.tf` |

## 4. Các bước

- Notification service có image riêng (`services/notification/Dockerfile`). Deploy API và notification **cùng lúc**: event từ API bản cũ không có người nhận và vào DLQ ([README của service](../../../services/notification/README.md#khi-triển-khai-bản-này-lần-đầu)).
- Kiểm DLQ sau mỗi lần deploy: DLQ có message là email đã hỏng sau các lần thử.

## 5. Kiểm tra sau deploy

1. `manager@hr.local` mở "Đơn chờ duyệt", duyệt đơn vừa tạo ở UC3: đơn `APPROVED`, nhân viên nhận email.
2. `hr@hr.local` mở "Đơn cần hoàn tất", hoàn tất: số dư `used` tăng, `pending` giảm.
3. DLQ rỗng; log notification service không có `Gửi email lỗi`.

## 6. Rollback và sự cố

- Notification service lỗi: quyết định vẫn được lưu, email chờ trong queue. Rollback service về image cũ, message được xử lý lại;
  service chống gửi trùng theo id event và nhóm người nhận.
- Message trong DLQ: sửa nguyên nhân rồi đẩy lại vào queue chính (RabbitMQ shovel hoặc SQS redrive).

## 7. Còn thiếu

- Email trên staging: notification service đọc `MAIL_DRIVER=ses` và gửi bằng SES API v2 với task role (F1 trong [staging-readiness](../../cloud/staging-readiness.md), sửa 25/11). SES sandbox: người nhận thử cũng phải xác minh. `QUEUE_DRIVER`, `SQS_QUEUE_URL` đã có ([configuration.md mục 5](../../development/configuration.md#5-điểm-còn-thiếu-trên-staging)).
- Người duyệt thay (FR-4.3) cần bảng phân công mới: thêm migration và ghi vào đây khi làm `feat/leave-delegation`.
