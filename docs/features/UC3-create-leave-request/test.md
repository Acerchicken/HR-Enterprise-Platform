# UC3 – Tạo đơn nghỉ: kiểm thử

> Tiêu chí: [requirements.md](requirements.md). Cách chạy chung, tài khoản mẫu: [README](../README.md#kiểm-thử).
> Ca kiểm thử nghiệp vụ: [leave-test-cases.md](../../business/leave-test-cases.md) (TC-01 → TC-10, TC-17 → TC-19).

## 1. Chiến lược

Rủi ro chính là **sai số dư**: tính sai ngày làm việc, trừ hai lần khi gửi lại, cho tạo đơn trùng. Logic tính ngày và trùng lịch
là hàm thuần nên kiểm kỹ bằng unit test; luồng có số dư, lịch sử, audit, email kiểm bằng e2e; ca TC kiểm tay theo bảng nghiệp vụ.

## 2. Test tự động đã có

| Mức | File | Nội dung |
|---|---|---|
| Unit | `backend/src/modules/leave/leave-rules.spec.ts` | Ngày làm việc, ngày lễ, nửa ngày, trùng lịch, số dư |
| Unit | `backend/src/modules/leave/leave-state-machine.spec.ts` | Chuyển trạng thái hợp lệ, thao tác lặp |
| Unit | `backend/src/modules/leave/outbox/leave-events.spec.ts` | Người nhận theo loại event, routing key, nội dung email |
| e2e | `backend/test/app.e2e-spec.ts`, nhóm "workflow nghỉ phép" | Liệt kê ở mục 3 |

## 3. Bảng phủ tiêu chí

| Tiêu chí | Test tự động (e2e, tên test) | Ca tay | Trạng thái |
|---|---|---|---|
| AC-3.1.1, AC-3.1.2 | "số dư phép của tôi", "tạo → quản lý duyệt → HR hoàn tất; số dư, lịch sử và audit đúng" | TC-01 | Có |
| AC-3.1.3 | – | TC-23 | Chờ TV1 triển khai phép năm theo tỉ lệ và thâm niên |
| AC-3.1.4 | – | TC-24 | Chờ TV1 triển khai giới hạn theo sự kiện, không theo tổng số lần/năm |
| AC-3.1.5 | – | TC-23 | Chờ xác nhận thời gian thử việc được tính nếu tiếp tục làm việc |
| AC-3.1.6 | – | TC-31 | Chờ chức năng HR đặt hạn mức theo hồ sơ BHXH xác minh |
| AC-3.2.1 | "tạo → quản lý duyệt → HR hoàn tất…" | TC-01 | Có (email kiểm tay ở Mailpit) |
| AC-3.2.2, AC-3.2.3 | "không đủ số dư, dữ liệu sai hoặc thiếu Idempotency-Key → 400 (BR-01)" | TC-03, TC-10 | Có |
| AC-3.2.4 | – | TC-25 | Chờ TV1 triển khai đơn qua năm, giữ/trừ số dư nguyên tử theo từng năm |
| AC-3.2.5 | – | – | Chưa đạt (chưa gắn hồ sơ trả 404, yêu cầu là 403; TV1 xử lý) |
| AC-3.3.1 | "trùng lịch với đơn đang chờ → 409 (TC-04, BR-02)" | TC-04 | Có |
| AC-3.3.2, AC-3.3.3 | "trùng lịch bị chặn; hai nửa ngày khác buổi thì được…" | TC-08, TC-09 | Có |
| AC-3.4.1, AC-3.4.2 | "ngày lễ không trừ phép: 29/4–4/5/2026 tính 2 ngày…" | TC-05 → TC-07 | Có |
| AC-3.4.3 | – | TC-30 | Chờ TV1 triển khai điều chỉnh lịch lễ có audit/lịch sử |
| AC-3.5.1 | – | TC-02 | Có ca tay |
| AC-3.5.2 | "không đủ số dư, dữ liệu sai hoặc thiếu Idempotency-Key → 400" | – | Có |
| AC-3.5.3 | – | Cần thêm | Chưa |
| AC-3.6.1 | "trùng lịch bị chặn; … hủy trả lại số dư" | TC-17, TC-26, TC-27 | Có cho SUBMITTED; PENDING_HR/hủy muộn chờ TV1 |
| AC-3.6.2 → AC-3.6.5 | – | TC-18, TC-27, TC-28 | Chờ TV1 triển khai quyền hủy đã duyệt và chặn tự hủy từ ngày bắt đầu |
| AC-3.7.1 → AC-3.7.4 | – | – | Chưa có tính năng |

## 4. Dữ liệu và tài khoản

- `employee@hr.local` (chủ đơn), `manager@hr.local` (quản lý trực tiếp), `hr@hr.local`.
- Ngày lễ 2026 có sẵn trong seed. Ca ngày lễ dùng khoảng 27/4 – 4/5/2026. Mỗi lần chạy e2e dùng khoảng ngày khác nhau hoặc
  `seed --reset` để không trùng lịch với lần trước.

## 5. Cách chạy

```bash
cd backend
npm test -- leave
npm run test:e2e
```

Email: mở Mailpit http://localhost:8025 sau khi tạo đơn.

## 6. Kiểm thử phi chức năng

- NFR-1.2: tạo, hủy đơn p95 < 500 ms trong load test tuần 11.
- NFR-3.4: tắt queue/email worker nhưng API `POST /leave-requests` vẫn tạo đơn 201 và không mất dữ liệu.
- Đồng thời: hai request tạo đơn song song dùng hết số dư, chỉ một đơn được tạo.

## 7. Ca còn thiếu (TV4)

- Hai request tạo đơn song song với cùng số dư.
- e2e cho AC-3.5.1 (gửi lại cùng key trả đúng đơn cũ, số dư không đổi) và AC-3.5.3 (cùng key, đơn khác → 409).
- Bổ sung e2e cho AC-3.6.1 với đơn `PENDING_HR` (TC-26) và chặn tự hủy từ `startDate` (TC-27).
- Thực hiện TC-23 → TC-31 khi TV1 hoàn thành tính số dư, nghỉ theo sự kiện, đơn qua năm, lịch lễ, hủy đơn và hạn mức BHXH; các ca này hiện là tiêu chí nghiệp vụ, chưa phải kết quả test.
- AC-3.7.x khi `feat/leave-delegation` xong, kèm ca bảo mật chặn quản lý gọi `GET /leave-balances?employeeId=` của nhân viên không phải cấp dưới trực tiếp (`403`).
