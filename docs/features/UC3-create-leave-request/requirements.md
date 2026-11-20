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
| US-3.6 | HR | Đặt mức phép năm 14 hoặc 16 ngày, hạn mức nghỉ ốm theo hồ sơ BHXH | Số dư đúng với từng người | FR-3.8 |

## 2. Tiêu chí chấp nhận

### FR-3.1 Số dư phép (M, đã có)

- **AC-3.1.1** Khi nhân viên xem số dư. Thì mỗi loại phép có được hưởng, đã dùng, đang chờ, còn lại; còn lại = được hưởng −
  đã dùng − đang chờ.
- **AC-3.1.2** Giả sử nhân viên vừa tạo đơn 2 ngày. Khi xem lại số dư. Thì đang chờ tăng 2, còn lại giảm 2.
- **AC-3.1.3** *(chưa đạt; số ngày cộng thâm niên dùng chung hàm `seniority()` của UC1 trong `profile-computed.ts` để hai nơi không lệch)* Theo BR-01 và danh mục loại phép: với nhân viên làm điều kiện bình thường, mức phép năm là 12 ngày; nhân viên làm chưa đủ 12 tháng trong năm được tính `(mức phép năm theo điều kiện lao động + ngày cộng thâm niên) / 12 × số tháng làm việc thực tế trong năm`. Tháng làm chưa đủ tháng được tính nếu ngày làm việc và ngày nghỉ hưởng lương đạt ít nhất 50% ngày làm việc bình thường của tháng. Giả sử vào làm 1/7/2026, không có ngày cộng thâm niên: số dư được hưởng năm 2026 là 6 ngày. Giả sử cùng mức chuẩn và đủ 10 năm làm việc cho cùng người sử dụng lao động: được cộng 2 ngày, tổng mức năm là 14 ngày. Số dư lưu 2 chữ số thập phân, không làm tròn giảm.
- **AC-3.1.4** *(chưa đạt)* Nghỉ cưới, con cưới, tang, thai sản và nghỉ khi vợ sinh được cấp theo từng sự kiện hợp lệ và giới hạn trong danh mục loại phép; không trừ hoặc cộng vào số dư phép năm. Nghỉ cưới bản thân tối đa 3 ngày/sự kiện, con cưới 1 ngày/sự kiện, tang thân nhân thuộc danh mục 3 ngày/sự kiện. Mỗi sự kiện chỉ yêu cầu một lần; HR kiểm giấy tờ khi hoàn tất. Không đặt tổng hạn mức số lần/năm cho các sự kiện hợp lệ. Đơn vượt mức của loại sự kiện trả 400; không tự tách đơn, đổi phần vượt sang nghỉ không lương hoặc trừ phép năm.
- **AC-3.1.5** *(mới)* Giả sử nhân viên đang thử việc rồi tiếp tục làm tại doanh nghiệp. Thì thời gian thử việc được tính vào thời gian làm việc để tính phép năm từ `hireDate`; nhân viên được dùng số dư đã phát sinh trong thử việc theo cùng quy tắc số dư và phê duyệt. Nếu không tiếp tục làm sau thử việc thì không cấp thêm số dư phép năm cho thời gian sau ngày kết thúc thử việc.
- **AC-3.1.6** *(mới)* Với nghỉ ốm, số ngày tối đa không được suy từ `hireDate`. Khi chưa có dữ liệu BHXH và nhóm điều kiện lao động đã xác minh. Thì HR nhập/cập nhật hạn mức từ hồ sơ hợp lệ; HR kiểm giấy tờ khi hoàn tất (BR-18).
- **AC-3.1.7** *(mới, kiểm chéo 18/11)* Giả sử A có một đơn `SUBMITTED`, một đơn `APPROVED` bắt đầu sau ngày nghỉ việc và một
  đơn `APPROVED` đang diễn ra. Khi HR cho A nghỉ việc. Thì hộp xác nhận nêu trước số đơn bị ảnh hưởng; sau khi xác nhận, hai
  đơn đầu thành `CANCELLED` (lịch sử `SYSTEM_CANCEL`), `pending` được trả theo từng năm, đơn đang diễn ra giữ nguyên để HR xử
  lý; phép năm được tính lại tới tháng nghỉ việc. Dùng quá số được hưởng thì có audit `LEAVE_BALANCE_OVERDRAWN` (spec 13.2).

### FR-3.2 Tạo đơn (M, đã có)

- **AC-3.2.1** Khi tạo đơn hợp lệ. Thì trả 201, đơn `SUBMITTED`, số ngày vào `pending`, có lịch sử, audit `LEAVE_SUBMIT`, và
  quản lý trực tiếp nhận email.
- **AC-3.2.2** Khi không đủ số dư (BR-01). Thì trả 400, câu báo nêu số ngày cần và số ngày còn.
- **AC-3.2.3** Khi ngày kết thúc trước ngày bắt đầu, nửa ngày nhưng hai ngày khác nhau, loại phép không tồn tại, lý do quá 500
  ký tự. Thì trả 400 kèm `fields`.
- **AC-3.2.4** *(chưa đạt)* Khi tạo đơn 29/12/2026 – 4/1/2027. Thì một đơn được tạo; ngày phép năm được tách theo năm lịch và giữ chỗ riêng trong số dư 2026, 2027. Nếu một trong hai năm không đủ số dư thì từ chối toàn bộ đơn (400), không lưu đơn và không giữ chỗ một phần. Khi hủy/từ chối, giải phóng đúng số ngày đang giữ ở mỗi năm; khi hoàn tất, chuyển số ngày của từng năm từ `pending` sang `used` trong đúng năm đó.
- **AC-3.2.5** *(chưa đạt)* Khi tài khoản đăng nhập chưa gắn hồ sơ. Thì trả 403 (code đang trả 404).
- **AC-3.2.6** *(mới, thiết kế 18/11)* Khi tạo đơn nghỉ cưới không có `eventDate`. Thì trả 400. Giả sử đã có đơn nghỉ cưới
  `eventDate` 05/12/2026 đang `APPROVED`. Khi tạo đơn nghỉ cưới thứ hai cùng `eventDate`. Thì trả 409; đơn trước bị từ chối hoặc
  hủy thì tạo lại được (BR-01, spec 13.3).

### FR-3.3 Không trùng lịch (M, đã có)

- **AC-3.3.1** Khi khoảng ngày trùng với đơn đang chờ hoặc đã duyệt (BR-02). Thì trả 409, nêu khoảng ngày của đơn bị trùng.
- **AC-3.3.2** Khi tạo hai đơn nửa ngày khác buổi trong cùng một ngày (BR-04). Thì cả hai được tạo.
- **AC-3.3.3** Khi đơn cả ngày trùng với nửa ngày đã gửi. Thì trả 409.

### FR-3.4 Tính ngày làm việc (M, đã có)

- **AC-3.4.1** Khi tạo đơn 29/4–4/5/2026. Thì số ngày là 2 (bỏ cuối tuần, lễ 30/4, 1/5, BR-03).
- **AC-3.4.2** Khi đơn chỉ gồm ngày nghỉ bù 27/4/2026 hoặc chỉ gồm cuối tuần. Thì trả 400.
- **AC-3.4.3** *(mới)* Khi lịch lễ/nghỉ bù được cập nhật sau khi gửi đơn. Thì hệ thống không âm thầm đổi số ngày của đơn đang `SUBMITTED`, `PENDING_HR` hoặc `APPROVED`; HR rà soát, ghi điều chỉnh số ngày và `pending` có audit/lịch sử, gửi thông báo chung (BR-19). Đơn gửi sau cập nhật dùng lịch mới.

### FR-3.5 Gửi lại không tạo đơn thứ hai (M, đã có)

- **AC-3.5.1** Khi gửi lại cùng `Idempotency-Key`. Thì trả lại đơn cũ, số dư không đổi, không có email thứ hai (BR-11).
- **AC-3.5.2** Khi thiếu header `Idempotency-Key` hoặc dài quá 100 ký tự. Thì trả 400.
- **AC-3.5.3** Khi dùng lại `Idempotency-Key` cũ cho đơn khác ngày hoặc loại phép. Thì trả 409.

### FR-3.6 Hủy đơn (M, đã có)

- **AC-3.6.1** Khi chủ đơn hủy đơn `SUBMITTED` hoặc `PENDING_HR` trước `startDate`. Thì đơn `CANCELLED`, số ngày trả khỏi
  `pending` theo từng năm, audit `LEAVE_CANCEL`, người duyệt hiện có quyền nhận email chung (BR-07, BR-15). Từ `startDate`
  trở đi, chủ đơn tự hủy nhận 409 theo AC-3.6.5.
- **AC-3.6.2** Khi nhân viên tự hủy đơn đã `APPROVED` (BR-08). Thì trả 409; nhân viên phải đề nghị quản lý trực tiếp hoặc HR xác nhận hủy trước ngày bắt đầu nghỉ.
- **AC-3.6.3** Khi người không có quyền hủy đơn (không phải chủ đơn hủy đơn chờ, quản lý trực tiếp hiện tại hoặc HR xác nhận theo AC-3.6.4). Thì trả 403. Khi hủy với `version` cũ. Thì trả 409.
- **AC-3.6.4** *(mới, TV1 triển khai)* Khi quản lý trực tiếp hiện tại hoặc HR xác nhận đề nghị hủy đơn `APPROVED` trước ngày bắt đầu nghỉ, kèm lý do. Thì đơn chuyển `CANCELLED`, số ngày được giải phóng khỏi `pending` theo từng năm, `used` không đổi; ghi người đề nghị, người xác nhận và thời điểm; ghi lý do ở lịch sử nhưng không ở audit; gửi email chung (BR-08, BR-15). Từ ngày bắt đầu nghỉ trở đi thì luồng hủy này trả 409.
- **AC-3.6.5** *(mới, TV1 triển khai)* Khi đơn `SUBMITTED`/`PENDING_HR` đã tới hoặc qua `startDate`. Thì chủ đơn tự hủy nhận 409; HR phải xác minh thực tế nghỉ rồi ghi hủy/điều chỉnh có lý do, cập nhật đúng số dư từng năm và audit/lịch sử. Không tự trả lại toàn bộ `pending` chỉ theo yêu cầu hủy muộn (BR-07).
- **AC-3.6.6** *(mới, thiết kế 18/11)* Giả sử đơn `APPROVED`, hôm nay trước `startDate`. Khi chủ đơn gửi đề nghị hủy kèm lý
  do. Thì đơn vẫn `APPROVED`, có `cancelRequest`, lịch sử `CANCEL_REQUEST`, audit `LEAVE_CANCEL_REQUEST` không có lý do;
  người có quyền xác nhận nhận email chung. Gửi đề nghị lần hai khi chưa có quyết định, hoặc gửi từ `startDate` trở đi. Thì
  trả 409. Người khác chủ đơn gửi đề nghị. Thì trả 403.
- **AC-3.6.7** *(mới, thiết kế 18/11)* Giả sử đề nghị hủy bị bác (UC4 AC-4.5.5). Thì đơn giữ `APPROVED`, số dư không đổi, chủ
  đơn nhận email chung và thấy ghi chú bác trong lịch sử; chủ đơn gửi lại đề nghị được nếu vẫn trước `startDate`.

### FR-3.7 Tạo đơn hộ (S, chưa có)

- **AC-3.7.1** Khi HR tạo đơn cho nhân viên X. Thì đơn trừ số dư của X, X nhận email, lịch sử ghi HR là người tạo hộ, đơn vẫn
  chờ quản lý trực tiếp của X duyệt (BR-12).
- **AC-3.7.2** Khi quản lý trực tiếp tạo đơn cho cấp dưới trực tiếp. Thì như AC-3.7.1.
- **AC-3.7.3** Khi quản lý tạo đơn cho người không phải cấp dưới trực tiếp, kể cả cấp dưới của người mình đang duyệt thay
  (BR-06). Thì trả 403.
- **AC-3.7.4** Giả sử đơn do người khác tạo hộ. Khi X hủy đơn khi còn `SUBMITTED`. Thì hủy được như AC-3.6.1.

### FR-3.8 HR chỉnh hạn mức (S, chưa có, thiết kế 18/11)

- **AC-3.8.1** Khi HR đặt mức nền phép năm của A là 14 kèm ghi chú. Thì `entitled` phép năm được tính lại theo spec 13.2, có
  audit `LEAVE_BALANCE_ADJUST` (giá trị cũ, mới, không có ghi chú). Đặt mức khác 12, 14, 16 thì trả 400.
- **AC-3.8.2** Khi HR đặt hạn mức nghỉ ốm của A là 40 theo hồ sơ BHXH. Thì dòng số dư `source = MANUAL`; nhân viên thấy hạn
  mức mới. Đặt hạn mức nhỏ hơn đã dùng cộng đang chờ thì trả 409.
- **AC-3.8.3** Khi HR sửa trực tiếp `entitled` của phép năm, hoặc quản lý, nhân viên gọi API chỉnh hạn mức. Thì trả 400; 403.
- **AC-3.8.4** Khi quản lý trực tiếp xem số dư của cấp dưới trực tiếp (để tạo đơn hộ). Thì thấy được hưởng, đã dùng, đang chờ,
  còn lại, không thấy mức nền và ghi chú của HR. Xem số dư người không phải cấp dưới trực tiếp. Thì trả 403.

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
| Email chung, ẩn lý do nghỉ ốm | UC4 AC-4.6.3, AC-4.7.3 | TV1 | `feat/leave-privacy` | 11 |
| Chốt quy tắc phép năm/thử việc, nghỉ sự kiện/ốm, đơn qua năm/lịch lễ, hủy muộn/đã duyệt, hoàn tất và nhắc đơn chờ | AC-3.1.3 → AC-3.1.6, AC-3.2.4, AC-3.4.3, AC-3.6.2 → AC-3.6.5 | TV2 | `docs/leave-rules-week11` | 11 |
| Sơ đồ luồng, bản vẽ, hợp đồng API, thiết kế dữ liệu, kiểm chéo UC1, UC2, UC8 | – | TV1 | `docs/uc3-uc4-design` | 11 |
| Phép năm, loại phép theo sự kiện, đơn qua năm, HR chỉnh hạn mức, nghỉ việc, 403 khi chưa gắn hồ sơ | AC-3.1.3 → AC-3.1.7, AC-3.2.4 → AC-3.2.6, AC-3.8.x | TV1 | `feat/leave-balance-rules` (spec 13.6, nhánh 1) | 12 |
| Tự hủy trước ngày bắt đầu, đề nghị hủy đơn đã duyệt | AC-3.6.1 → AC-3.6.7 | TV1 | `feat/leave-cancel-rules` (nhánh 3) | 12 |
| Lịch lễ thay đổi sau khi gửi đơn | AC-3.4.3 | TV1 | `feat/leave-holidays` (nhánh 7) | 12 |
| Lưu trữ 5 năm, legal hold (BR-13) | – | – | – | Ngoài MVP, ghi ở SRS mục 8 |
