# UC4 – Duyệt đơn nghỉ: kiểm thử

> Tiêu chí: [requirements.md](requirements.md). Cách chạy chung, tài khoản mẫu: [README](../README.md#kiểm-thử).
> Ca kiểm thử nghiệp vụ: [leave-test-cases.md](../../business/leave-test-cases.md) (TC-11 → TC-16, TC-20 → TC-22).

## 1. Chiến lược

Rủi ro chính: **sai người duyệt** (BR-05), quyết định bị ghi đè khi hai người cùng xử lý, email gửi trùng hoặc lộ thông tin
nghỉ ốm. Unit test kiểm state machine; e2e kiểm người duyệt, version, số dư, audit; unit test messaging kiểm thử lại và DLQ;
email kiểm tay ở Mailpit.

## 2. Test tự động đã có

| Mức | File | Nội dung |
|---|---|---|
| Unit | `backend/src/modules/leave/leave-state-machine.spec.ts` | Chuyển trạng thái, quyết định ngược trả lỗi |
| Unit | `backend/src/worker/notification-worker.spec.ts` | Người nhận email, chống gửi trùng, gửi lỗi thì đưa lại từ DLQ vẫn gửi được |
| Unit | `backend/src/modules/leave/outbox/leave-events.spec.ts` | Người nhận theo loại event; nội dung email (xem lưu ý ở mục 7) |
| Unit | `backend/src/messaging/messaging.spec.ts` | Handler lỗi thì thử lại rồi DLQ |
| e2e | `backend/test/app.e2e-spec.ts`, nhóm "workflow nghỉ phép", "quản lý trực tiếp và CEO" | Liệt kê ở mục 3 |

## 3. Bảng phủ tiêu chí

| Tiêu chí | Test tự động (e2e, tên test) | Ca tay | Trạng thái |
|---|---|---|---|
| AC-4.1.1, AC-4.1.2 | "danh sách đơn: chờ duyệt cho MANAGER và HR (đơn của CEO); toàn hệ thống chỉ HR" | SEC-45 → SEC-54 | Có |
| AC-4.2.1 | "tạo → quản lý duyệt → HR hoàn tất; số dư, lịch sử và audit đúng" | TC-11 | Có |
| AC-4.2.2 | "quản lý từ chối trả lại số ngày đang giữ (BR-09)" | TC-15 | Có |
| AC-4.2.3 | "chỉ quản lý trực tiếp duyệt/từ chối…" | TC-12 | Có |
| AC-4.2.4 | – | TC-13 | Có ca tay |
| AC-4.2.5 | – | TC-14, TC-16 | Có ca tay |
| AC-4.2.6 | – | Cần thêm | Chưa |
| AC-4.3.1 → AC-4.3.4 | – | – | Chưa có tính năng |
| AC-4.4.1, AC-4.4.2 | "HR duyệt đơn của CEO…", "HR không duyệt được đơn của nhân viên khác CEO…" | – | Có |
| AC-4.5.1, AC-4.5.2 | "tạo → … HR hoàn tất", "HR hoàn tất đơn chưa duyệt → 409 (TC-21…)" | TC-20 → TC-22 | Có |
| AC-4.5.3 | – | – | Chưa đạt (hoàn tất được trước ngày kết thúc) |
| AC-4.6.1, AC-4.6.2 | Unit `notification-worker.spec.ts` | Kiểm Mailpit | Có |
| AC-4.6.3 | – | – | Chưa đạt (BR-15) |
| AC-4.6.5 | – | – | Chưa đạt (CEO tạo đơn, HR không nhận email) |
| AC-4.6.4 | Unit `messaging.spec.ts` | Tắt RabbitMQ rồi duyệt đơn | Có unit |
| AC-4.7.1, AC-4.7.2 | "người ngoài không xem được đơn của nhân viên" | SEC-57, SEC-58 | Có |
| AC-4.7.3, AC-4.7.4 | – | – | Chưa đạt (BR-14) |

## 4. Dữ liệu và tài khoản

`employee@hr.local` (chủ đơn), `manager@hr.local` (quản lý trực tiếp), `hr@hr.local`; CEO lấy từ seed (chức danh `CEO`).
Ca đổi quản lý (AC-4.2.6) cần HR đổi `managerId` của nhân viên khi đơn đang `SUBMITTED`.

## 5. Cách chạy

```bash
cd backend
npm test -- leave worker messaging
npm run test:e2e
```

Ca lỗi queue (AC-4.6.4): `docker compose stop rabbitmq`, duyệt một đơn (vẫn thành công), `docker compose start rabbitmq`,
kiểm email đến Mailpit.

## 6. Kiểm thử phi chức năng

- NFR-1.2: duyệt, từ chối, hoàn tất p95 < 500 ms; NFR-1.4: email p95 < 1 phút (load test tuần 11).
- Kịch bản lỗi ở SRS mục 6.14: queue, email, worker chết.

## 7. Ca còn thiếu (TV4)

- AC-4.2.6: đổi quản lý trực tiếp khi đơn đang chờ.
- e2e cho AC-4.2.4 (duyệt hai lần) và AC-4.2.5 (version cũ).
- AC-4.3.x, AC-4.6.3, AC-4.7.3 khi `feat/leave-delegation`, `feat/leave-privacy` xong.

**Lưu ý:** unit test "nội dung email có thời gian, số ngày và ghi chú" trong `leave-events.spec.ts` đang kiểm đúng điều BR-15
cấm. Nhánh `feat/leave-privacy` phải đổi test này thành "email không có loại phép, ngày, lý do".
