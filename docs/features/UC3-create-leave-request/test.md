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
| e2e | `backend/test/app.e2e-spec.ts`, nhóm "UC3, UC4 nghỉ phép" | Liệt kê ở mục 3 |

## 3. Bảng phủ tiêu chí

| Tiêu chí | Test tự động (e2e, tên test) | Ca tay | Trạng thái |
|---|---|---|---|
| AC-3.1.1, AC-3.1.2 | "số dư phép của tôi", "UC3, UC4 nghỉ phép" › "tạo → quản lý duyệt → HR hoàn tất…" | TC-01 | Có |
| AC-3.1.3 | Unit `leave-rules.spec.ts` "BR-01, 13.2: phép năm" | TC-23 | Có (unit); TV4 chạy ca tay |
| AC-3.1.4 | "UC3, UC4 nghỉ phép" › "nghỉ theo sự kiện…" | TC-24 | Có |
| AC-3.1.5 | Unit (tính từ `hireDate`, gồm thời gian thử việc) | TC-23 | Có (unit) |
| AC-3.1.6 | "UC3, UC4 nghỉ phép" › "HR chỉnh hạn mức…" (SICK `DEFAULT` → `MANUAL`) | TC-31 | Có |
| AC-3.2.1 | "tạo → quản lý duyệt → HR hoàn tất…" | TC-01 | Có (email kiểm tay ở Mailpit) |
| AC-3.2.2, AC-3.2.3 | "không đủ số dư, dữ liệu sai hoặc thiếu Idempotency-Key → 400 (BR-01)" | TC-03, TC-10 | Có |
| AC-3.2.4 | "UC3, UC4 nghỉ phép" › "đơn qua hai năm…" | TC-25 | Có |
| AC-3.2.5 | "UC3, UC4 nghỉ phép" › "tài khoản chưa gắn hồ sơ → 403" | – | Có |
| AC-3.2.6 | "UC3, UC4 nghỉ phép" › "nghỉ theo sự kiện…" | Cần thêm (TV4) | Có e2e |
| AC-3.3.1 | "trùng lịch với đơn đang chờ → 409 (TC-04, BR-02)" | TC-04 | Có |
| AC-3.3.2, AC-3.3.3 | "trùng lịch bị chặn; hai nửa ngày khác buổi thì được…" | TC-08, TC-09 | Có |
| AC-3.4.1, AC-3.4.2 | "ngày lễ không trừ phép: 29/4–4/5/2026 tính 2 ngày…" | TC-05 → TC-07 | Có |
| AC-3.4.3 | "UC3, UC4 nghỉ phép" › "HR sửa lịch lễ…" | TC-30 | Có |
| AC-3.5.1 | – | TC-02 | Có ca tay |
| AC-3.5.2 | "không đủ số dư, dữ liệu sai hoặc thiếu Idempotency-Key → 400" | – | Có |
| AC-3.5.3 | – | Cần thêm | Chưa |
| AC-3.6.1 | "UC3, UC4 nghỉ phép" › "trùng lịch, nửa ngày, tự hủy trước ngày bắt đầu…" | TC-17, TC-26, TC-27 | Có |
| AC-3.6.2 → AC-3.6.5 | "UC3, UC4 nghỉ phép" › "tạo → … HR hoàn tất" (tự hủy đơn đã duyệt 409), "từ ngày bắt đầu không tự hủy được…", "đề nghị hủy đơn đã duyệt…" | TC-18, TC-27, TC-28 | Có |
| AC-3.6.6, AC-3.6.7 | "UC3, UC4 nghỉ phép" › "đề nghị hủy đơn đã duyệt…" | Cần thêm (TV4) | Có e2e |
| AC-3.7.1 → AC-3.7.4 | "UC3, UC4 nghỉ phép" › "tạo đơn hộ…" | Cần thêm (TV4) | Có e2e |
| AC-3.1.7 | "UC3, UC4 nghỉ phép" › "nghỉ việc: hộp xác nhận nêu số đơn…" | Cần thêm (TV4) | Có e2e |
| AC-3.1.8 | "UC3, UC4 nghỉ phép" › "đơn qua hai năm…; chuyển phép sang năm sau", unit "AC-3.1.8" | Cần thêm (TV4) | Có |
| AC-3.8.1 → AC-3.8.4 | "UC3, UC4 nghỉ phép" › "HR chỉnh hạn mức…" | Cần thêm (TV4) | Có e2e |

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
- Ngoại lệ bổ sung [spec mục 6.1](spec.md#61-ngoại-lệ-bổ-sung-rà-24112026) (E15 → E21): E16 cần ca riêng cho `startDate < hireDate` (400), ngày bắt đầu đúng 31/12 năm kế tiếp (được nhận) và ngày sau đó (400). Thêm ca khoảng nghỉ >1 năm với loại phép không cấu hình trần thời lượng để xác nhận không bị chặn bởi giới hạn toàn cục. **E16 đã có e2e** cho hai điều kiện ngày và đúng mốc 31/12 (chạy xanh 25/11); ca khoảng nghỉ >1 năm còn chờ TV4.
