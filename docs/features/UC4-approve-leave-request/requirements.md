# UC4 – Duyệt đơn nghỉ: yêu cầu và tiêu chí chấp nhận

> Đọc file này trước khi mở nhánh làm UC4. Luồng chi tiết: [spec.md](spec.md). Nguồn FR: [SRS mục 4.4](../../requirements/SRS.md#44-uc4--duyệt-đơn-fr-4x).
> Quy tắc nghiệp vụ: [leave-rules.md](../../business/leave-rules.md). Mỗi tiêu chí `AC-x.y.z` là một ca kiểm thử.

## 1. User story

| Mã | Là | Tôi muốn | Để | FR |
|---|---|---|---|---|
| US-4.1 | Quản lý trực tiếp | Thấy các đơn đang chờ của cấp dưới và duyệt, từ chối nhanh | Nhân viên có kết quả trong ngày | FR-4.1, FR-4.2 |
| US-4.2 | HR | Chỉ định người duyệt thay khi quản lý vắng | Đơn không bị kẹt | FR-4.3 |
| US-4.3 | HR | Duyệt đơn của CEO | CEO cũng có người duyệt | FR-4.4 |
| US-4.4 | HR | Hoàn tất đơn đã duyệt | Số ngày giữ chỗ thành đã dùng | FR-4.5 |
| US-4.5 | Nhân viên, quản lý | Nhận email khi đơn đổi trạng thái | Không phải vào hệ thống kiểm tra | FR-4.6 |
| US-4.6 | Chủ đơn, quản lý, HR | Xem chi tiết và lịch sử đơn | Biết ai đã làm gì | FR-4.7 |
| US-4.7 | HR | Duyệt thêm đơn của loại phép dài hoặc ảnh hưởng lương, BHXH (thai sản, nghỉ không lương dài) sau khi quản lý duyệt | Kịp làm hồ sơ BHXH, lương, người thay | FR-4.8 |

## 2. Tiêu chí chấp nhận

### FR-4.1 Danh sách chờ duyệt (M, đã có)

- **AC-4.1.1** Khi quản lý mở danh sách chờ duyệt. Thì chỉ thấy đơn `SUBMITTED` của cấp dưới trực tiếp, có phân trang.
- **AC-4.1.2** Khi nhân viên không có cấp dưới gọi danh sách chờ duyệt. Thì trả 403.

### FR-4.2 Duyệt, từ chối (M, đã có)

- **AC-4.2.1** Khi quản lý trực tiếp duyệt kèm `version` đúng. Thì đơn `APPROVED`, số dư không đổi, có lịch sử, audit
  `LEAVE_APPROVE`, nhân viên nhận email.
- **AC-4.2.2** Khi từ chối. Thì đơn `REJECTED`, số ngày trả khỏi `pending` (BR-09), audit `LEAVE_REJECT`.
- **AC-4.2.3** Khi người không phải quản lý trực tiếp hiện tại duyệt (BR-05). Thì trả 403.
- **AC-4.2.4** Khi duyệt lần hai. Thì trả lại đơn, không đổi số dư, không gửi email lần nữa (BR-11).
- **AC-4.2.5** Khi từ chối đơn đã duyệt, hoặc gửi `version` cũ. Thì trả 409.
- **AC-4.2.6** Giả sử đơn đang chờ thì nhân viên đổi quản lý trực tiếp. Khi quản lý cũ duyệt. Thì trả 403; quản lý mới duyệt
  được.

### FR-4.3 Người duyệt thay (S, chưa có)

- **AC-4.3.1** Khi HR tạo phân công gồm quản lý vắng, người thay và khoảng ngày. Thì phân công được lưu, có audit. Vai trò khác
  tạo phân công thì trả 403.
- **AC-4.3.2** Giả sử hôm nay nằm trong khoảng ngày. Khi người thay mở danh sách chờ duyệt. Thì thấy đơn của cấp dưới quản lý
  vắng, duyệt được; lịch sử ghi người thay là người quyết định.
- **AC-4.3.3** Giả sử hôm nay ngoài khoảng ngày. Khi người thay duyệt. Thì trả 403.
- **AC-4.3.4** Khi người thay giao tiếp cho người khác (ủy quyền nối tiếp). Thì bị từ chối (BR-06).

### FR-4.4 HR duyệt đơn của CEO (S, đã có, PR #60)

- **AC-4.4.1** Khi CEO tạo đơn. Thì đơn hiện trong danh sách chờ duyệt của HR, HR duyệt hoặc từ chối được.
- **AC-4.4.2** Khi HR duyệt đơn của nhân viên khác CEO. Thì trả 403.

### FR-4.5 HR hoàn tất (M, đã có)

- **AC-4.5.1** Khi HR hoàn tất đơn `APPROVED`. Thì đơn `COMPLETED`, số ngày chuyển từ `pending` sang `used` (BR-10), audit
  `LEAVE_COMPLETE`.
- **AC-4.5.2** Khi hoàn tất đơn chưa duyệt. Thì trả 409, đơn giữ nguyên. Khi quản lý hoặc nhân viên hoàn tất. Thì trả 403.
- **AC-4.5.3** *(chưa đạt)* Khi HR hoàn tất đơn mà hôm nay chưa qua ngày kết thúc của đơn. Thì trả 409.

### FR-4.6 Email thông báo (M, đã có; nội dung chưa đạt BR-15)

- **AC-4.6.1** Đơn mới, đơn bị hủy → email tới quản lý trực tiếp; duyệt, từ chối, hoàn tất → email tới nhân viên.
- **AC-4.6.2** Khi worker nhận lại cùng một event. Thì không gửi email lần hai.
- **AC-4.6.3** *(chưa đạt)* Mọi email chỉ có câu báo chung và link tới hộp đơn chung (URL không chứa mã đơn); không có tên,
  loại phép, ngày, số ngày, lý do, ghi chú. Payload outbox và log worker chỉ mang dữ liệu để định tuyến (BR-15, NFR-5.18).
- **AC-4.6.4** Khi queue hoặc dịch vụ email lỗi. Thì quyết định vẫn được lưu; event chờ trong outbox, thử lại rồi vào DLQ.
- **AC-4.6.5** *(chưa đạt)* Khi CEO tạo đơn. Thì HR nhận email "có đơn cần xử lý". Hiện worker không gửi vì CEO không có
  quản lý trực tiếp.

### FR-4.7 Chi tiết và lịch sử (M, đã có)

- **AC-4.7.1** Chủ đơn, quản lý trực tiếp, HR xem được chi tiết và lịch sử (người xử lý, trạng thái trước và sau, ghi chú,
  thời điểm).
- **AC-4.7.2** Người khác xem chi tiết đơn. Thì trả 403.
- **AC-4.7.3** *(chưa đạt)* Giả sử đơn nghỉ ốm. Khi quản lý trực tiếp xem chi tiết, danh sách hoặc lịch sử. Thì không thấy
  lý do; chủ đơn và HR vẫn thấy (BR-14).
- **AC-4.7.4** *(chưa đạt)* Khi HR xem lý do đơn nghỉ ốm. Thì có audit ghi ai đọc trường `reason` của đơn nào, không ghi nội
  dung. Audit duyệt, từ chối không chứa `comment` (hiện có).

### FR-4.8 HR duyệt thêm theo loại phép (S, chưa có, BR-16)

- **AC-4.8.1** *(chưa có)* Giả sử đơn nghỉ không lương 5 ngày làm việc. Khi quản lý trực tiếp duyệt. Thì đơn `PENDING_HR`, số
  dư không đổi, nhân viên và HR nhận email chung; đơn hiện ở tab Đơn nghỉ của HR.
- **AC-4.8.2** *(chưa có)* Giả sử đơn nghỉ không lương 2 ngày, hoặc đơn phép năm. Khi quản lý duyệt. Thì đơn `APPROVED` ngay,
  không qua HR.
- **AC-4.8.3** *(chưa có)* Giả sử đơn `PENDING_HR`. Khi HR duyệt kèm `version` đúng. Thì đơn `APPROVED`, audit
  `LEAVE_HR_APPROVE`; sau ngày kết thúc HR hoàn tất được.
- **AC-4.8.4** *(chưa có)* Khi HR từ chối đơn `PENDING_HR` có lý do. Thì đơn `REJECTED`, `pending` giảm (BR-09), audit không
  chứa lý do. Từ chối không có lý do thì trả 400.
- **AC-4.8.5** *(chưa có)* Giả sử chủ đơn là HR, đơn thai sản đã qua quản lý. Khi chính người đó gọi `hr-approve`. Thì trả 403;
  HR khác duyệt được.
- **AC-4.8.6** *(chưa có)* Giả sử đơn `PENDING_HR`. Khi nhân viên hủy. Thì đơn `CANCELLED`, trả `pending`. Khi nhân viên gửi đơn
  mới trùng ngày. Thì bị từ chối (BR-02).
- **AC-4.8.7** *(chưa có)* Giả sử đơn đã gửi khi `UNPAID` là `OVER_DAYS` 3. Khi HR đổi cấu hình `UNPAID` thành `NEVER` rồi quản
  lý duyệt. Thì đơn vẫn sang `PENDING_HR` (cấu hình chụp lúc gửi).
- **AC-4.8.8** *(chưa có)* Khi CEO gửi đơn thai sản và HR duyệt. Thì đơn `APPROVED`, không có bước HR thứ hai.

## 3. Yêu cầu phi chức năng liên quan

NFR-1.2 (duyệt, từ chối, hoàn tất p95 < 500 ms); NFR-1.4 (email p95 < 1 phút); NFR-3.4, NFR-3.5 (lỗi email không ảnh hưởng
quyết định, thử lại rồi vào DLQ); NFR-6.1 (100% thao tác duyệt có audit).

## 4. Việc còn lại

Lịch làm theo [kế hoạch hoàn thành từng chức năng](../../progress/ke-hoach-tong.md#7-kế-hoạch-hoàn-thành-từng-chức-năng-tuần-10--13).

| Việc | Tiêu chí | Người | Nhánh | Tuần |
|---|---|---|---|---|
| Người duyệt thay | AC-4.3.1 → AC-4.3.4 | TV1 | `feat/leave-delegation` | 10, chưa xong thì đầu tuần 11 |
| Email chung, email đơn CEO cho HR, ẩn lý do nghỉ ốm, audit không chứa ghi chú | AC-4.6.3, AC-4.6.5, AC-4.7.3, AC-4.7.4 | TV1 | `feat/leave-privacy` | 11 |
| Quy tắc hủy đơn đã duyệt; chỉ hoàn tất sau ngày kết thúc; nhắc đơn chờ lâu | AC-4.5.3 | TV2 | `docs/leave-rules-week11` | 11 |
| Chỉ hoàn tất sau ngày kết thúc; hủy đơn đã duyệt theo quy tắc TV2 | AC-4.5.3 | TV1 | `fix/leave-balance-rules` | 11 |
| Ca kiểm thử đổi quản lý khi đơn đang chờ, người duyệt thay, riêng tư | AC-4.2.6, AC-4.3.x, AC-4.6.3, AC-4.7.3 | TV4 | `docs/test-cases-week11` | 11 |
| HR duyệt thêm theo loại phép | AC-4.8.1 → AC-4.8.8 | TV1 | `feat/leave-hr-approval` | 12 |
| Ca kiểm thử HR duyệt thêm | AC-4.8.x | TV4 | `docs/test-cases-week12` | 12 |
| Báo cáo MT-2 (thời gian gửi → quyết định) | – | TV2 | `docs/mt2-report` | 13, khi có dữ liệu staging |
