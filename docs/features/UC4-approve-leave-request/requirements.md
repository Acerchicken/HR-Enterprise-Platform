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
| US-4.8 | HR | Cập nhật lịch lễ, nghỉ bù và tính lại các đơn bị ảnh hưởng | Số ngày nghỉ đúng với lịch được công bố | FR-4.9 |

## 2. Tiêu chí chấp nhận

### FR-4.1 Danh sách chờ duyệt (M, đã có)

- **AC-4.1.1** Khi quản lý mở danh sách chờ duyệt. Thì chỉ thấy đơn `SUBMITTED` của cấp dưới trực tiếp, có phân trang.
- **AC-4.1.2** Khi nhân viên không có cấp dưới gọi danh sách chờ duyệt. Thì trả 403.

### FR-4.2 Duyệt, từ chối (M, đã có)

- **AC-4.2.1** Khi quản lý trực tiếp duyệt kèm `version` đúng. Thì đơn `APPROVED`, số dư không đổi, có lịch sử, audit
  `LEAVE_APPROVE`, nhân viên nhận email.
- **AC-4.2.2** Khi từ chối kèm lý do. Thì đơn `REJECTED`, số ngày trả khỏi `pending` (BR-09), audit `LEAVE_REJECT`. Từ chối không
  có lý do thì trả 400 (cùng quy tắc với AC-4.8.4 và giao diện AC-0.6.3; kiểm chéo 21/11).
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
- **AC-4.5.3** *(chưa đạt)* Khi HR hoàn tất đơn `APPROVED`. Chỉ cho phép nếu ngày hiện tại theo múi giờ Việt Nam đã sau `endDate` (sớm nhất là ngày kế tiếp); hoàn tất trong ngày kết thúc hoặc trước đó trả 409. Thiếu giấy tờ bắt buộc thì giữ `APPROVED` (BR-10).
- **AC-4.5.4** Khi chủ đơn đề nghị hủy đơn `APPROVED` trước ngày bắt đầu nghỉ. Thì quản lý trực tiếp hiện tại, người duyệt thay hoặc HR (đơn đã qua HR duyệt thêm, đơn của CEO: chỉ HR, AC-4.5.6) xác nhận kèm lý do; đơn chuyển `CANCELLED`, số ngày trả khỏi `pending` theo từng năm, `used` không đổi; lịch sử lưu người đề nghị/người xác nhận/lý do, audit không chứa lý do tự do, gửi email chung (BR-08, BR-15). Từ ngày bắt đầu trở đi trả 409 cho luồng hủy này.
- **AC-4.5.5** *(mới, thiết kế 18/11)* Giả sử đơn `APPROVED` có đề nghị hủy, trước `startDate`. Khi quản lý trực tiếp bác kèm
  ghi chú. Thì đơn giữ `APPROVED`, đề nghị bị xóa, lịch sử `CANCEL_REQUEST_REJECT`, chủ đơn nhận email chung. Bác không có ghi
  chú thì trả 400.
- **AC-4.5.6** *(mới, thiết kế 18/11)* Giả sử đơn thai sản đã qua HR duyệt (BR-16) và có đề nghị hủy. Khi quản lý trực tiếp xác
  nhận. Thì trả 403; HR xác nhận được. Giả sử đơn phép năm có đề nghị hủy. Khi HR xác nhận. Thì được.
- **AC-4.5.7** *(mới, thiết kế 18/11)* Giả sử đề nghị hủy chưa được xử lý và hôm nay là `startDate`. Khi người duyệt xác nhận. Thì
  trả 409; danh sách hiện nhãn "Hết hạn"; đơn vẫn hoàn tất được sau `endDate` như thường.

### FR-4.6 Email thông báo (M, đã có; nội dung chưa đạt BR-15)

- **AC-4.6.1** Đơn mới, đơn bị hủy → email tới quản lý trực tiếp; duyệt, từ chối, hoàn tất → email tới nhân viên.
- **AC-4.6.2** Khi worker nhận lại cùng một event. Thì không gửi email lần hai.
- **AC-4.6.3** *(chưa đạt)* Mọi email chỉ có câu báo chung và link tới hộp đơn chung (URL không chứa mã đơn); không có tên,
  loại phép, ngày, số ngày, lý do, ghi chú. Payload outbox và log worker chỉ mang dữ liệu để định tuyến (BR-15, NFR-5.18).
- **AC-4.6.4** Khi queue hoặc dịch vụ email lỗi. Thì quyết định vẫn được lưu; event chờ trong outbox, thử lại rồi vào DLQ.
- **AC-4.6.5** *(chưa đạt)* Khi CEO tạo đơn. Thì HR nhận email "có đơn cần xử lý". Hiện worker không gửi vì CEO không có
  quản lý trực tiếp.
- **AC-4.6.6** *(mới, TV1 triển khai)* Khi đơn vẫn `SUBMITTED` sau một ngày làm việc đầy đủ. Thì gửi đúng một email nhắc chung cho người duyệt hiện có quyền (quản lý trực tiếp/người duyệt thay); nếu đơn vẫn `PENDING_HR` sau một ngày làm việc đầy đủ kể từ lúc vào trạng thái đó, gửi đúng một email nhắc chung tới nhóm HR. Không gửi sau khi đơn đã quyết định/hủy/hoàn tất; không lặp nhắc trong cùng giai đoạn; email tuân BR-15. Nhắc việc không tự quyết định đơn (BR-17).

### FR-4.7 Chi tiết và lịch sử (M, đã có)

- **AC-4.7.1** Chủ đơn, quản lý trực tiếp, HR xem được chi tiết và lịch sử (người xử lý, trạng thái trước và sau, ghi chú,
  thời điểm).
- **AC-4.7.2** Người khác xem chi tiết đơn. Thì trả 403.
- **AC-4.7.3** *(chưa đạt)* Giả sử đơn nghỉ ốm. Khi quản lý trực tiếp xem chi tiết, danh sách hoặc lịch sử. Thì không thấy
  lý do; chủ đơn và HR vẫn thấy (BR-14).
- **AC-4.7.4** *(chưa đạt)* Khi HR xem lý do đơn nghỉ ốm. Thì có audit ghi ai đọc trường `reason` của đơn nào, không ghi nội
  dung. Audit duyệt, từ chối không chứa `comment` (hiện có).
- **AC-4.7.5** *(mới, kiểm chéo 18/11)* Giả sử M là quản lý gián tiếp của A (UC1 AC-1.1.4), P là phó phòng của A nhưng không
  phải quản lý trực tiếp. Khi M hoặc P mở chi tiết đơn của A. Thì trả 403; đơn của A không có trong danh sách chờ duyệt của M, P.

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

### FR-4.9 HR cập nhật lịch lễ, tính lại đơn (S, chưa có, thiết kế 18/11, BR-19)

- **AC-4.9.1** Khi HR thêm ngày nghỉ bù 04/5/2026. Thì ngày đó có trong `GET /leave-holidays`, có audit `HOLIDAY_CREATE`, API trả
  số đơn bị ảnh hưởng; các đơn đã gửi chưa đổi số ngày. Vai trò khác thêm ngày lễ thì trả 403.
- **AC-4.9.2** Giả sử đơn `APPROVED` 29/4 – 4/5/2026 đã lưu 2 ngày và 4/5 vừa thành ngày nghỉ bù. Khi HR tính lại kèm lý do. Thì
  đơn còn 1 ngày, `pending` năm 2026 giảm 1, đơn vẫn `APPROVED`, lịch sử `RECALCULATE`, chủ đơn nhận email chung.
- **AC-4.9.3** Giả sử HR xóa một ngày lễ làm đơn tăng 1 ngày mà số dư năm đó không còn. Khi HR tính lại. Thì trả 409, đơn giữ
  nguyên. Tính lại đơn `COMPLETED` thì trả 409.
- **AC-4.9.4** Khi tạo đơn mới sau khi HR sửa lịch. Thì số ngày tính theo lịch mới (UC3 AC-3.4.3).

## 3. Yêu cầu phi chức năng liên quan

NFR-1.2 (duyệt, từ chối, hoàn tất p95 < 500 ms); NFR-1.4 (email p95 < 1 phút); NFR-3.4, NFR-3.5 (lỗi email không ảnh hưởng
quyết định, thử lại rồi vào DLQ); NFR-6.1 (100% thao tác duyệt có audit).

## 4. Việc còn lại

Lịch làm theo [kế hoạch hoàn thành từng chức năng](../../progress/ke-hoach-tong.md#7-kế-hoạch-hoàn-thành-từng-chức-năng-tuần-10--13).

| Việc | Tiêu chí | Người | Nhánh | Tuần |
|---|---|---|---|---|
| Người duyệt thay | AC-4.3.1 → AC-4.3.4 | TV1 | `feat/leave-delegation` (nhánh 6) | 12 |
| Email chung, email đơn CEO cho HR, ẩn lý do nghỉ ốm, audit không chứa ghi chú | AC-4.6.3, AC-4.6.5, AC-4.7.3, AC-4.7.4 | TV1 | `feat/leave-privacy` (nhánh 4) | 12 |
| Chốt hủy đơn đã duyệt, mốc hoàn tất, nhắc đơn chờ; đồng bộ các điểm rà soát PR #96 | AC-4.5.3 → AC-4.5.4, AC-4.6.6 | TV2 | `docs/leave-rules-week11` | 11 |
| Sơ đồ luồng, bản vẽ, hợp đồng API, thiết kế 13.4 → 13.7 | – | TV1 | `docs/uc3-uc4-design` | 11 |
| Chỉ hoàn tất sau ngày kết thúc; xác nhận, bác đề nghị hủy; gom quyền về `leave-access.ts` | AC-4.5.3 → AC-4.5.7, AC-4.7.5; UC3 AC-3.6.x | TV1 | `feat/leave-cancel-rules` (nhánh 3) | 12 |
| Nhắc đơn chờ | AC-4.6.6 | TV1 | `feat/leave-reminders` (nhánh 5) | 12 |
| Lịch lễ, tính lại đơn, lịch dùng chung | AC-4.9.x | TV1 | `feat/leave-holidays` (nhánh 7) | 12 |
| Ca kiểm thử đổi quản lý khi đơn đang chờ, người duyệt thay, riêng tư | AC-4.2.6, AC-4.3.x, AC-4.6.3, AC-4.7.3 | TV4 | `docs/test-cases-uc3-uc4` | 11 |
| HR duyệt thêm theo loại phép | AC-4.8.1 → AC-4.8.8 | TV1 | `feat/leave-hr-approval` (UC3 spec 13.6, nhánh 2) | 12 |
| Ca kiểm thử HR duyệt thêm | AC-4.8.x | TV4 | `docs/test-cases-uc3-uc4` | 11 |
| Báo cáo MT-2 (thời gian gửi → quyết định) | – | TV2 | `docs/mt2-report` | 13, khi có dữ liệu staging |
