# UC1 – Hồ sơ nhân viên: yêu cầu và tiêu chí chấp nhận

> Đọc file này trước khi mở nhánh làm UC1. Luồng chi tiết: [spec.md](spec.md). Nguồn FR: [SRS mục 4.1](../../requirements/SRS.md#41-uc1--hồ-sơ-nhân-viên-fr-1x).
> Mỗi tiêu chí `AC-x.y.z` là một ca kiểm thử. PR làm chức năng ghi mã AC đã làm trong mô tả PR.

## 1. User story

| Mã | Là | Tôi muốn | Để | FR |
|---|---|---|---|---|
| US-1.1 | Nhân viên | Xem hồ sơ đồng nghiệp ở mức danh bạ | Biết cách liên lạc | FR-1.1 |
| US-1.2 | Quản lý trực tiếp | Xem thông tin cá nhân của cấp dưới | Nắm thông tin người mình quản lý | FR-1.1 |
| US-1.3 | Nhân viên | Tự sửa số điện thoại, địa chỉ | Không phải nhờ HR | FR-1.2 |
| US-1.4 | HR | Xem CCCD, số tài khoản, lương khi cần, mỗi lần xem đều có dấu vết | Làm nghiệp vụ mà vẫn kiểm soát được dữ liệu nhạy cảm | FR-1.3 |
| US-1.5 | HR | Tạo nhân viên mới và sửa mọi trường | Hồ sơ nằm tập trung một chỗ | FR-1.4, FR-1.5 |
| US-1.6 | HR | Được báo khi người khác vừa sửa cùng hồ sơ | Không ghi đè thay đổi của nhau | FR-1.6 |
| US-1.7 | Nhân viên | Xem hồ sơ của mình trên một trang chia nhóm rõ ràng, dùng được trên điện thoại | Tìm nhanh thông tin cá nhân, công việc, tài chính, phúc lợi | FR-1.1 |
| US-1.8 | Nhân viên | Xem lương, số tài khoản của chính mình khi bấm hiện | Kiểm tra thông tin trả lương mà không phải hỏi HR | FR-1.3 |

## 2. Tiêu chí chấp nhận

### FR-1.1 Xem hồ sơ theo 3 mức (M, đã có)

- **AC-1.1.1** Giả sử B không phải quản lý trực tiếp của A, không phải HR. Khi B mở hồ sơ A. Thì B chỉ thấy trường danh bạ,
  không thấy ngày sinh, địa chỉ.
- **AC-1.1.2** Giả sử M là quản lý trực tiếp của A. Khi M mở hồ sơ A. Thì M thấy thêm ngày sinh, địa chỉ, ngày vào làm,
  trạng thái; không thấy CCCD, số tài khoản, lương.
- **AC-1.1.3** Giả sử người dùng có vai trò ADMIN. Khi mở hồ sơ người khác. Thì chỉ thấy mức danh bạ.

### FR-1.2 Nhân viên tự sửa liên hệ (M, đã có)

- **AC-1.2.1** Giả sử nhân viên đã đăng nhập. Khi sửa `phone`, `address` của chính mình với giá trị hợp lệ. Thì trả 200,
  hồ sơ đổi, `version` tăng 1, audit `UPDATE` ghi trường đã đổi.
- **AC-1.2.2** Khi nhân viên sửa trường khác (ví dụ `jobTitle`) hoặc sửa hồ sơ người khác. Thì trả 403, hồ sơ không đổi.
- **AC-1.2.3** Khi số điện thoại sai mẫu. Thì trả 400 kèm `fields.phone`.

### FR-1.3 HR xem trường nhạy cảm (M, đã có)

- **AC-1.3.1** Giả sử người dùng là HR. Khi gọi `GET /employees/{id}?include=sensitive`. Thì thấy CCCD, số tài khoản, lương
  đã giải mã, và có audit `VIEW_SENSITIVE` ghi người xem, nhân viên bị xem, `traceId`.
- **AC-1.3.2** Khi vai trò khác HR gọi `include=sensitive`. Thì trả 403 và không có audit đọc.
- **AC-1.3.3** Khi HR mở hồ sơ không kèm `include=sensitive`. Thì không có trường nhạy cảm, không ghi `VIEW_SENSITIVE`.
- **AC-1.3.4** *(chưa đạt)* Khi HR mở form sửa hồ sơ. Thì giá trị nhạy cảm không tự tải, không sinh `VIEW_SENSITIVE`; chỉ khi
  HR bấm "Hiện thông tin nhạy cảm" mới tải và ghi audit.

### FR-1.4 HR sửa mọi trường (M, đã có API và giao diện, PR #63)

- **AC-1.4.1** Khi HR sửa lương. Thì trả 200; audit `UPDATE` có tên trường `salary`, không có giá trị cũ hay mới.
- **AC-1.4.2** Khi HR nhập sai định dạng trên giao diện. Thì lỗi hiện đúng ô theo `fields` của response 400.
- **AC-1.4.3** *(chưa đạt)* Khi HR đổi phòng ban, chức danh, quản lý, trạng thái hoặc ngày vào làm. Thì audit ghi tên trường,
  giá trị cũ và mới. Khi đổi họ tên, điện thoại, địa chỉ, ngày sinh. Thì audit chỉ ghi tên trường (ADMIN đọc được audit nhưng
  không được xem thông tin cá nhân người khác).
- **AC-1.4.4** *(chưa đạt)* HR sửa được `hireDate` và `workEmail`; `employeeCode` không sửa được.

### FR-1.5 HR tạo nhân viên (M, đã có API và giao diện, PR #63)

- **AC-1.5.1** Khi HR tạo nhân viên đủ dữ liệu bắt buộc. Thì trả 201, có audit `CREATE`; người đó đăng nhập bằng email công
  ty thì khớp đúng hồ sơ.
- **AC-1.5.2** Khi thiếu quản lý trực tiếp (không phải CEO), quản lý không tồn tại, hoặc quản lý tạo vòng. Thì trả 400.
- **AC-1.5.3** Khi mã nhân viên hoặc email đã tồn tại. Thì trả 409.
- **AC-1.5.4** Khi ADMIN gọi `POST /employees`. Thì trả 403.

### FR-1.6 Không ghi đè khi sửa đồng thời (S, một phần)

- **AC-1.6.1** Giả sử HR1 và HR2 cùng mở hồ sơ ở `version` 3, HR1 lưu trước. Khi HR2 lưu với `version` 3. Thì trả 409, dữ
  liệu của HR1 giữ nguyên.
- **AC-1.6.2** *(chưa đạt)* Khi gửi yêu cầu sửa không kèm `version`. Thì trả 400. Hiện tại API bỏ qua kiểm tra nếu client
  không gửi `version` (giao diện web luôn gửi).
- **AC-1.6.3** *(chưa đạt)* Giả sử HR1, HR2 cùng mở hồ sơ. Khi HR1 chỉ sửa lương rồi HR2 lưu. Thì HR2 nhận 409. Hiện sửa chỉ
  trường nhạy cảm không tăng `version`.

### Nghỉ việc (M, chưa đạt)

- **AC-1.7.1** *(chưa đạt)* Khi HR chuyển nhân viên còn cấp dưới đang làm việc sang `TERMINATED`. Thì trả 400, nêu số cấp dưới
  cần chuyển sang quản lý khác trước.
- **AC-1.7.2** *(chưa đạt)* Giả sử hồ sơ đã `TERMINATED`. Khi tài khoản gắn với hồ sơ đó gọi API bằng token còn hạn. Thì bị từ
  chối (403).

### Trang hồ sơ theo nhóm (S, chưa có)

Bố cục chi tiết ở [spec mục 9.1](spec.md#91-bố-cục-trang-hồ-sơ).

- **AC-1.8.1** *(chưa có)* Khi nhân viên mở trang "Hồ sơ của tôi". Thì thấy đầu trang (ảnh hoặc chữ cái đầu, mã nhân viên,
  họ tên, chức danh), thẻ quản lý trực tiếp, thẻ sơ đồ tổ chức, và các nhóm Thông tin cá nhân, Công việc, Tài chính, Phúc lợi,
  Khác theo đúng thứ tự ở spec mục 9.1.
- **AC-1.8.2** *(chưa có)* Giả sử mục "Bảo hiểm xã hội" chưa làm. Khi xem trang hồ sơ. Thì tiêu đề mục màu đỏ `#DC2626`, kèm
  nhãn "Chưa có"; bấm vào thì mở trang báo "Chức năng đang phát triển" và không gọi API nào. Mục đã làm có tiêu đề màu thường.
- **AC-1.8.3** *(chưa có)* Khi mở bất kỳ trang nào. Thì nút chính, link, tiêu đề nhóm dùng màu `--primary: #0E7490` (cyan);
  không còn màu xanh dương cũ `#2457C5`.
- **AC-1.8.4** *(chưa có)* Giả sử B chỉ ở mức danh bạ với A. Khi B mở hồ sơ A. Thì B chỉ thấy đầu trang, điện thoại, email;
  không thấy hàng lương, hệ số, diện đối tượng và các nhóm bên dưới. Quản lý trực tiếp thấy thêm đúng các mục spec 9.1 cho
  phép; HR thấy mọi nhóm và nút "Sửa hồ sơ".
- **AC-1.8.5** *(chưa có)* Khi mở trang hồ sơ trên màn hình rộng 375 px. Thì trang một cột, không cuộn ngang.
- **AC-1.8.6** *(chưa có)* Giả sử nhân viên A. Khi A bấm biểu tượng mắt ở "Lương mục tiêu" của chính mình. Thì thấy lương, có
  audit `VIEW_SENSITIVE` ghi A xem hồ sơ của A. Khi A gọi lấy trường nhạy cảm của người khác. Thì trả 403.

## 3. Yêu cầu phi chức năng liên quan

NFR-1.1, NFR-1.2 (thời gian phản hồi); NFR-5.12, NFR-5.13 (phân quyền theo vai trò và dữ liệu); NFR-5.17 (mã hóa trường nhạy
cảm); NFR-5.18 (không lộ giá trị nhạy cảm vào log, audit); NFR-6.1 (audit đủ). Chi tiết ở
[SRS mục 6](../../requirements/SRS.md#6-yêu-cầu-phi-chức-năng-nfr).

## 4. Việc còn lại

Lịch làm theo [kế hoạch theo chức năng tuần 11–13](../../progress/tuan-04-ke-hoach-tong.md#7-kế-hoạch-theo-chức-năng-tuần-11--13).

| Việc | Tiêu chí | Người | Nhánh | Tuần |
|---|---|---|---|---|
| Cập nhật trạng thái FR-1.4, FR-1.5 trong SRS | – | TV2 | `docs/matrix-week10` | 10 |
| Xác nhận quy tắc nghỉ việc khi còn cấp dưới, cách ghi audit theo nhóm trường | AC-1.7.1, AC-1.4.3 | TV2 | `docs/org-integrity-rules` | 11 |
| Bắt buộc `version`; tăng `version` khi sửa trường nhạy cảm; audit theo nhóm trường; sửa `hireDate`, `workEmail`; nghỉ việc; chỉ tải trường nhạy cảm khi bấm hiện | AC-1.3.4, AC-1.4.3, AC-1.4.4, AC-1.6.2, AC-1.6.3, AC-1.7.1, AC-1.7.2 | TV1 | `fix/employee-org-integrity` | 11 |
| Ca kiểm thử cho các tiêu chí trên | Như dòng trên | TV4 | `docs/test-cases-week11` | 11 |
| Trang hồ sơ theo nhóm, màu cyan, mục chưa có tiêu đề đỏ; chủ hồ sơ tự xem lương, số tài khoản | AC-1.8.1 → AC-1.8.6 | TV1 | `feat/profile-layout` | 11 |
| Các mục **Chưa có** ở spec 9.1 (liên hệ khẩn cấp, hợp đồng, BHXH…) | Viết AC khi chọn làm | – | – | Sau MVP |
