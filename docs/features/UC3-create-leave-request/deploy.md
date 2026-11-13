# UC3 – Tạo đơn nghỉ: triển khai

> Cách chạy chung, staging, rollback chung: [README](../README.md#môi-trường). File này chỉ ghi phần riêng của UC3.
> UC3 và UC4 dùng chung module, queue, worker. Phần queue và email ghi ở [UC4 deploy](../UC4-approve-leave-request/deploy.md).

## 1. Thành phần

| Thành phần | Phần của UC3 |
|---|---|
| API | `backend/src/modules/leave` (số dư, tạo, hủy, `leave-rules.ts`, `leave-state-machine.ts`); outbox `modules/leave/outbox` |
| Worker | Gửi email "có đơn mới", "đơn bị hủy" cho quản lý |
| Web | `/leave` (đơn của tôi, số dư), `/leave/new`, `/leave/:id` (`frontend/src/pages/leave`) |
| Database | Schema `leave` (`leave_type`, `leave_balance`, `leave_request`, `leave_request_history`, `holiday`, `outbox`); migration `InitSchemas`, `1730200000000-LeaveWorkflow`, `1730400000000-LeaveOutbox` |

## 2. Biến môi trường

| Biến | Local | Staging | Thiếu thì sao |
|---|---|---|---|
| `RABBITMQ_URL` hoặc `SQS_QUEUE_URL` + `AWS_REGION` | RabbitMQ trong compose | SQS `hr-platform-staging-leave-notifications` | `QUEUE_DRIVER=none`: đơn vẫn tạo được, event nằm trong outbox, không có email |

## 3. Hạ tầng

| Môi trường | Tài nguyên | File |
|---|---|---|
| Local | RabbitMQ, Mailpit (xem mail ở http://localhost:8025) | `docker-compose.yml` |
| Staging | SQS + DLQ, ECS worker | `infra/staging/sqs_worker.tf` |

## 4. Các bước

- **Dữ liệu danh mục:** loại phép và ngày lễ 2026 do seed tạo (theo [leave-types-holidays.md](../../business/leave-types-holidays.md)).
  Sang năm mới phải thêm ngày lễ trước 1/1, nếu không đơn qua ngày lễ bị tính sai.
- **Số dư:** seed cấp số dư năm 2026 cho mọi nhân viên. Nhân viên tạo mới qua UC1 chưa có dòng số dư: API tự tạo khi họ tạo
  đơn đầu tiên, với số ngày = `max_days_per_year` của loại phép. Sang năm mới cũng vậy (chưa có job cấp phép đầu năm).

## 5. Kiểm tra sau deploy

1. Nhân viên mẫu xem số dư: còn lại = được hưởng − đã dùng − đang chờ.
2. Tạo đơn 1 ngày làm việc: trả 201; số dư đang chờ tăng 1; quản lý nhận email (Mailpit ở local).
3. Gửi lại cùng `Idempotency-Key`: trả lại đúng đơn cũ. Hủy đơn: số dư trở lại.

## 6. Rollback và sự cố

- Migration `LeaveWorkflow`, `LeaveOutbox` có `down`, nhưng revert sẽ xóa bảng `holiday`, `outbox`: chỉ revert khi chưa có dữ
  liệu thật.
- Queue lỗi không chặn tạo đơn (NFR-3.4): event chờ trong outbox, gửi lại khi queue hoạt động.

## 7. Còn thiếu

- Tạo đơn hộ (FR-3.7) có thể cần migration thêm cột người tạo hộ vào lịch sử; ghi vào đây khi làm `feat/leave-delegation`.
