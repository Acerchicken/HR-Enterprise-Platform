# UC3 – Tạo đơn nghỉ: yêu cầu và tiêu chí chấp nhận

> Đọc file này trước khi mở nhánh làm UC3. Luồng chi tiết: [spec.md](spec.md). Nguồn FR: [SRS mục 4.3](../../requirements/SRS.md#43-uc3--tạo-đơn-nghỉ-fr-3x).
> Quy tắc nghiệp vụ: [leave-rules.md](../../business/leave-rules.md). Mỗi tiêu chí `AC-x.y.z` là một ca kiểm thử.

## 1. User story

| Mã | Là | Tôi muốn | Để | FR |
|---|---|---|---|---|
| US-3.1 | Nhân viên | Xem số ngày phép còn lại theo từng loại | Biết mình còn nghỉ được bao nhiêu | FR-3.1 |
| US-3.2 | Nhân viên | Tạo đơn nghỉ cả ngày hoặc nửa ngày | Xin nghỉ không cần giấy tờ | FR-3.2, FR-3.4 |
| US-3.3 | Nhân viên | Được chặn khi đơn trùng lịch hoặc gửi trùng do mạng lỗi | Không bị trừ phép hai lần | FR-3.3, FR-3.5 |
| US-3.4 | Nhân viên | Hủy đơn chưa được duyệt | Đổi kế hoạch mà không phải nhờ ai | FR-3.6 |
| US-3.5 | HR, quản lý trực tiếp | Tạo đơn hộ nhân viên | Nhân viên không tự tạo được (ốm, đi công tác) vẫn có đơn | FR-3.7 |

## 2. Tiêu chí chấp nhận

### FR-3.1 Số dư phép (M, đã có)

- **AC-3.1.1** Khi nhân viên xem số dư. Thì mỗi loại phép có được hưởng, đã dùng, đang chờ, còn lại; còn lại = được hưởng −
  đã dùng − đang chờ.
- **AC-3.1.2** Giả sử nhân viên vừa tạo đơn 2 ngày. Khi xem lại số dư. Thì đang chờ tăng 2, còn lại giảm 2.
- **AC-3.1.3** *(chưa đạt)* Giả sử nhân viên vào làm 1/7/2026. Khi xem số dư phép năm 2026. Thì được hưởng 6 ngày (12 × 6/12,
  Điều 113 BLLĐ). Người có 10 năm thâm niên được hưởng 14 ngày.
- **AC-3.1.4** *(chưa đạt)* Nghỉ cưới, nghỉ tang tính theo từng lần (3 ngày/lần), không trừ vào số dư năm.

### FR-3.2 Tạo đơn (M, đã có)

- **AC-3.2.1** Khi tạo đơn hợp lệ. Thì trả 201, đơn `SUBMITTED`, số ngày vào `pending`, có lịch sử, audit `LEAVE_SUBMIT`, và
  quản lý trực tiếp nhận email.
- **AC-3.2.2** Khi không đủ số dư (BR-01). Thì trả 400, câu báo nêu số ngày cần và số ngày còn.
- **AC-3.2.3** Khi ngày kết thúc trước ngày bắt đầu, nửa ngày nhưng hai ngày khác nhau, loại phép không tồn tại, lý do quá 500
  ký tự. Thì trả 400 kèm `fields`.
- **AC-3.2.4** *(chưa đạt)* Khi tạo đơn 29/12/2026 – 4/1/2027. Thì một đơn được tạo; số ngày năm 2026 trừ vào số dư 2026,
  số ngày năm 2027 trừ vào số dư 2027; năm nào thiếu số dư thì trả 400.
- **AC-3.2.5** *(chưa đạt)* Khi tài khoản đăng nhập chưa gắn hồ sơ. Thì trả 403 (code đang trả 404).

### FR-3.3 Không trùng lịch (M, đã có)

- **AC-3.3.1** Khi khoảng ngày trùng với đơn đang chờ hoặc đã duyệt (BR-02). Thì trả 409, nêu khoảng ngày của đơn bị trùng.
- **AC-3.3.2** Khi tạo hai đơn nửa ngày khác buổi trong cùng một ngày (BR-04). Thì cả hai được tạo.
- **AC-3.3.3** Khi đơn cả ngày trùng với nửa ngày đã gửi. Thì trả 409.

### FR-3.4 Tính ngày làm việc (M, đã có)

- **AC-3.4.1** Khi tạo đơn 29/4–4/5/2026. Thì số ngày là 2 (bỏ cuối tuần, lễ 30/4, 1/5, BR-03).
- **AC-3.4.2** Khi đơn chỉ gồm ngày nghỉ bù 27/4/2026 hoặc chỉ gồm cuối tuần. Thì trả 400.

### FR-3.5 Gửi lại không tạo đơn thứ hai (M, đã có)

- **AC-3.5.1** Khi gửi lại cùng `Idempotency-Key`. Thì trả lại đơn cũ, số dư không đổi, không có email thứ hai (BR-11).
- **AC-3.5.2** Khi thiếu header `Idempotency-Key` hoặc dài quá 100 ký tự. Thì trả 400.
- **AC-3.5.3** Khi dùng lại `Idempotency-Key` cũ cho đơn khác ngày hoặc loại phép. Thì trả 409.

### FR-3.6 Hủy đơn (M, đã có)

- **AC-3.6.1** Khi chủ đơn hủy đơn `SUBMITTED`. Thì đơn `CANCELLED`, số ngày trả khỏi `pending`, audit `LEAVE_CANCEL`, quản
  lý nhận email (BR-07).
- **AC-3.6.2** Khi hủy đơn đã `APPROVED` (BR-08). Thì trả 409.
- **AC-3.6.3** Khi người khác hủy đơn. Thì trả 403. Khi hủy với `version` cũ. Thì trả 409.

### FR-3.7 Tạo đơn hộ (S, chưa có)

- **AC-3.7.1** Khi HR tạo đơn cho nhân viên X. Thì đơn trừ số dư của X, X nhận email, lịch sử ghi HR là người tạo hộ, đơn vẫn
  chờ quản lý trực tiếp của X duyệt (BR-12).
- **AC-3.7.2** Khi quản lý trực tiếp tạo đơn cho cấp dưới trực tiếp. Thì như AC-3.7.1.
- **AC-3.7.3** Khi quản lý tạo đơn cho người không phải cấp dưới trực tiếp, kể cả cấp dưới của người mình đang duyệt thay
  (BR-06). Thì trả 403.
- **AC-3.7.4** Giả sử đơn do người khác tạo hộ. Khi X hủy đơn khi còn `SUBMITTED`. Thì hủy được như AC-3.6.1.

### Quy tắc riêng tư liên quan

Email khi tạo, hủy đơn chỉ báo chung (BR-15) và lý do nghỉ ốm chỉ chủ đơn và HR xem được (BR-14). Tiêu chí viết ở
[UC4 AC-4.6.3 và AC-4.7.3](../UC4-approve-leave-request/requirements.md#fr-46-email-thông-báo-m-đã-có-nội-dung-chưa-đạt-br-15)
vì cùng một nhánh sửa.

## 3. Yêu cầu phi chức năng liên quan

NFR-1.2 (ghi p95 < 500 ms); NFR-3.4 (email lỗi không làm mất đơn); NFR-5.18 (email không nêu loại phép ốm, thai sản);
NFR-6.1 (audit mọi bước của đơn).

## 4. Việc còn lại

Lịch làm theo [kế hoạch hoàn thành từng chức năng](../../progress/ke-hoach-tong.md#7-kế-hoạch-hoàn-thành-từng-chức-năng-tuần-10--13).

| Việc | Tiêu chí | Người | Nhánh | Tuần |
|---|---|---|---|---|
| Tạo đơn hộ (làm chung nhánh với người duyệt thay) | AC-3.7.1 → AC-3.7.4 | TV1 | `feat/leave-delegation` | 12 |
| Email chung, ẩn lý do nghỉ ốm | UC4 AC-4.6.3, AC-4.7.3 | TV1 | `feat/leave-privacy` | 12 |
| Xác nhận cách tính phép năm (tỉ lệ, thâm niên), nghỉ theo sự kiện, đơn qua hai năm | AC-3.1.3, AC-3.1.4, AC-3.2.4 | TV2 | `docs/leave-rules-week11` | 11 |
| Cấp số dư theo luật, đơn qua hai năm, 403 khi chưa gắn hồ sơ | AC-3.1.3, AC-3.1.4, AC-3.2.4, AC-3.2.5 | TV1 | `fix/leave-balance-rules` | 12 |
| Lưu trữ 5 năm, legal hold (BR-13) | – | – | – | Ngoài MVP, ghi ở SRS mục 8 |
