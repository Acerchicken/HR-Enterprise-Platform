# Tuần 8 – TV1 (Duong, nhóm trưởng): code workflow nghỉ phép

Vai trò: code chính (backend, frontend), review và merge PR, báo cáo thứ 2.

## Hạn chót

| Hạn | Việc |
|---|---|
| **Thứ 5 (29/10), 21:00** | Mở PR `feat/leave-workflow-api` vào `dev` |
| **Thứ 6 (30/10), 21:00** | Mở PR `feat/leave-outbox-worker` vào `dev` |
| **Chủ nhật (1/11), 12:00** | Mở PR `feat/leave-ui` vào `dev` (để TV4 kiểm thử chiều chủ nhật) |
| Trong 24 giờ kể từ khi được gán | Review PR của TV2, TV4, TV3 |
| **Thứ 2 (2/11)** | Mở PR `dev` → `main`, tổng hợp báo cáo tuần 8 |

## Việc cần làm

### 1. `feat/leave-workflow-api` – hạn thứ 5 (29/10)

- API: tạo đơn, quản lý duyệt/từ chối, nhân viên hủy, HR hoàn tất.
- Mỗi thao tác chạy trong một transaction: đổi trạng thái đơn (gọi `leave-state-machine.ts`), cập nhật số dư
  (`leave_balance`), ghi `leave_request_history` và audit log.
- Idempotency khi tạo đơn (`Idempotency-Key`), optimistic locking bằng `version`.
- Code theo business rule của TV2 (`docs/business/leave-rules.md`), đối chiếu với ca kiểm thử của TV4.
- Cập nhật `docs/openapi.yaml`.

### 2. `feat/leave-outbox-worker` – hạn thứ 6 (30/10)

- Bắt đầu sau khi nhánh `chore/rabbitmq-mailpit` của TV3 đã vào `dev`.
- Bảng outbox: ghi event (`LeaveRequested`, `LeaveApproved`, `LeaveRejected`, `LeaveCancelled`, `LeaveCompleted`)
  trong cùng transaction với thao tác nghiệp vụ.
- Publisher đọc outbox, đẩy lên RabbitMQ. Worker nhận event, gửi email qua Mailpit, xử lý trùng lặp.

### 3. `feat/leave-ui` – hạn chủ nhật (1/11), 12:00

5 màn hình: tạo đơn, danh sách đơn của tôi (có hủy), đơn chờ duyệt của quản lý, chi tiết đơn + lịch sử, màn hình HR hoàn tất.

### 4. Việc của nhóm trưởng

- Review PR của TV3 (hạ tầng, CI) và PR tài liệu của TV2, TV4.
- Thứ 2 (2/11): mở PR `dev` → `main`, tổng hợp báo cáo tuần 8.

## Việc đã làm

| Việc | Output | Tình trạng |
|---|---|---|
| `feat/leave-workflow-api`: API tạo, duyệt/từ chối, hủy, HR hoàn tất; mỗi thao tác một transaction (state machine, số dư, history, audit); `Idempotency-Key`, `version`; trừ ngày lễ (bảng `leave.holiday`), nghỉ nửa ngày; 7 ca e2e mới | PR #9 | Đã merge 29/10, đúng hạn |
| `feat/leave-outbox-worker`: bảng `leave.outbox` ghi cùng transaction, publisher (publisher confirm, chịu được RabbitMQ chết), worker gửi email qua Mailpit, chống trùng, DLQ | PR #24 | Chờ merge, trễ 3 ngày (hạn 30/10) |
| `feat/leave-ui`: tạo đơn, đơn của tôi (hủy), đơn chờ duyệt, chi tiết + lịch sử, HR hoàn tất; chạy thử với `employee`, `manager`, `hr` | PR #25 | Chờ merge, trễ 1 ngày (hạn 1/11 12:00) |
| Sửa BR-03 để không trừ ngày lễ (đồng ý với TV2 qua comment PR #1) | PR #8 | Đã merge |
| Sửa Mailpit không khởi động (PR #10) | PR #15 | Đã merge |
| Làm lại ca kiểm thử (22 ca) và kiểm thử thật 5 màn hình tuần 7 với 4 tài khoản, thay TV4 sau khi PR #13 không đạt | PR #14 | Đã merge |
| Review và merge PR của nhóm; bật ruleset `dev`/`main` (chỉ TV1 merge); cập nhật quy trình review trước khi mở PR từ tuần 9 | Review trên #1, #5, #10–#13, #17, #20, #23; `CONVENTIONS.md` | Xong |

