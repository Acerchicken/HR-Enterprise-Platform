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
| Unit | `services/notification/src/handler.spec.ts`, `mail/*.spec.ts` | Gửi theo nhóm người nhận trong event, chống gửi trùng (cả khi lỗi giữa chừng), thử lại có giãn cách, gửi lỗi thì vào DLQ (NFR-3.5) |
| e2e | `app.e2e-spec.ts` › "event email mang sẵn người nhận…" | Publisher gắn người nhận: người duyệt, chủ đơn, nhóm HR (ADR-15 bước 1) |
| Unit | `backend/src/modules/leave/outbox/leave-events.spec.ts` | Nhóm người nhận theo loại event (nội dung email nay ở `services/notification/src/templates.spec.ts`) |
| Unit | `backend/src/messaging/messaging.spec.ts` | Handler lỗi thì thử lại rồi DLQ |
| e2e | `backend/test/app.e2e-spec.ts`, nhóm "UC3, UC4 nghỉ phép", "quản lý trực tiếp và CEO" | Liệt kê ở mục 3 |

## 3. Bảng phủ tiêu chí

| Tiêu chí | Test tự động (e2e, tên test) | Ca tay | Trạng thái |
|---|---|---|---|
| AC-4.1.1, AC-4.1.2 | "danh sách đơn: chờ duyệt cho MANAGER và HR (đơn của CEO); toàn hệ thống chỉ HR" | SEC-45 → SEC-54 | Có |
| AC-4.2.1 | "tạo → quản lý duyệt → HR hoàn tất; số dư, lịch sử và audit đúng" | TC-11 | Có |
| AC-4.2.2 | "UC3, UC4 nghỉ phép" › "từ chối bắt buộc lý do, trả số ngày…" | TC-15 | Có |
| AC-4.2.3 | "chỉ quản lý trực tiếp duyệt/từ chối…" | TC-12 | Có |
| AC-4.2.4 | – | TC-13 | Có ca tay |
| AC-4.2.5 | – | TC-14, TC-16 | Có ca tay |
| AC-4.2.6 | – | Cần thêm | Chưa |
| AC-4.3.1 → AC-4.3.4 | "UC3, UC4 nghỉ phép" › "người duyệt thay…" | Cần thêm (TV4) | Có e2e |
| AC-4.4.1, AC-4.4.2 | "HR duyệt đơn của CEO…", "HR không duyệt được đơn của nhân viên khác CEO…" | – | Có |
| AC-4.5.1, AC-4.5.2 | "tạo → … HR hoàn tất", "HR hoàn tất đơn chưa duyệt → 409 (TC-21…)" | TC-20 → TC-22 | Có |
| AC-4.5.3 | "UC3, UC4 nghỉ phép" › "từ ngày bắt đầu không tự hủy được…; hoàn tất trước khi qua ngày kết thúc → 409" | TC-29 | Có |
| AC-4.5.4 | "UC3, UC4 nghỉ phép" › "đề nghị hủy đơn đã duyệt…" | TC-28 | Có |
| AC-4.5.5 → AC-4.5.7 | "UC3, UC4 nghỉ phép" › "đề nghị hủy đơn đã duyệt…", "nghỉ không lương trên 3 ngày…" (AC-4.5.6); AC-4.5.7 unit `leave-state-machine.spec.ts` | Cần thêm (TV4) | Có |
| AC-4.6.1, AC-4.6.2 | Unit `handler.spec.ts` (notification service); e2e "event email mang sẵn người nhận…" | Kiểm Mailpit | Có |
| AC-4.6.3 | Unit `templates.spec.ts` "BR-15" (notification service), `handler.spec.ts`; e2e kiểm payload outbox | – | Có |
| AC-4.6.5 | Unit `leave-events.spec.ts` (người nhận `APPROVERS` của CEO là nhóm HR, `NotificationRecipients`) | Kiểm Mailpit | Có |
| AC-4.6.4 | Unit `messaging.spec.ts` | Tắt RabbitMQ rồi duyệt đơn | Có unit |
| AC-4.6.6 | "UC3, UC4 nghỉ phép" › "nhắc đơn chờ quá một ngày làm việc…" | TC-32 | Có |
| AC-4.7.1, AC-4.7.2 | "người ngoài không xem được đơn của nhân viên" | SEC-57, SEC-58 | Có |
| AC-4.7.3, AC-4.7.4 | "UC3, UC4 nghỉ phép" › "lý do nghỉ ốm…" | – | Có |
| AC-4.7.5 | Unit `leave-access.spec.ts` "xem chi tiết…" | Cần thêm: quản lý gián tiếp, phó phòng mở đơn → 403 | Có unit |
| AC-4.8.1 → AC-4.8.8 | "UC3, UC4 nghỉ phép" › "nghỉ không lương trên 3 ngày qua HR duyệt thêm…"; AC-4.8.5 unit `leave-access.spec.ts` | Cần thêm (TV4) | Có |
| AC-4.9.1 → AC-4.9.4 | "UC3, UC4 nghỉ phép" › "HR sửa lịch lễ…" | Cần thêm (TV4) | Có e2e |

## 4. Dữ liệu và tài khoản

`employee@hr.local` (chủ đơn), `manager@hr.local` (quản lý trực tiếp), `hr@hr.local`; CEO lấy từ seed (chức danh `CEO`).
Ca đổi quản lý (AC-4.2.6) cần HR đổi `managerId` của nhân viên khi đơn đang `SUBMITTED`.

## 5. Cách chạy

```bash
cd backend
npm test -- leave worker messaging
npm run test:e2e
cd ../services/notification && npm test   # thêm TEST_DB_URL để chạy cả test với PostgreSQL
```

Ca lỗi queue (AC-4.6.4): `docker compose stop rabbitmq`, duyệt một đơn (vẫn thành công), `docker compose start rabbitmq`,
kiểm email đến Mailpit.

## 6. Kiểm thử phi chức năng

- NFR-1.2: duyệt, từ chối, hoàn tất p95 < 500 ms; NFR-1.4: email p95 < 1 phút (load test tuần 11).
- Kịch bản lỗi ở SRS mục 6.14: queue, email, worker chết.

## 7. Ca còn thiếu (TV4)

- AC-4.2.6: đổi quản lý trực tiếp khi đơn đang chờ.
- e2e cho AC-4.2.4 (duyệt hai lần) và AC-4.2.5 (version cũ).
- AC-4.8.x (HR duyệt thêm): mỗi tiêu chí một ca; thêm ca MT-2 tính thời gian tới quyết định cuối cùng (sau HR).
- AC-4.3.x, AC-4.6.3, AC-4.7.3 khi `feat/leave-delegation`, `feat/leave-privacy` xong.
- Thực hiện TC-28, TC-29 và TC-32 sau khi TV1 hoàn thành; đây là tiêu chí nghiệp vụ, chưa phải kết quả test tự động.

**Lưu ý (cập nhật 26/11):** test "nội dung email có thời gian, số ngày và ghi chú" đã được thay bằng "BR-15: email không có
loại phép, ngày, lý do" và chuyển sang `services/notification/src/templates.spec.ts`.
- Ngoại lệ bổ sung [spec mục 6.1](spec.md#61-ngoại-lệ-bổ-sung-rà-24112026) (E19 → E26): mỗi mã ít nhất một ca e2e hoặc unit. ca của E19, E20, E21, E23, E24, E25, E26 xác nhận code đã đúng, sai thì chuyển sang "Chưa đạt" trong spec.
