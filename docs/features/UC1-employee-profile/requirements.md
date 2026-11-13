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

## 2. Tiêu chí chấp nhận

### FR-1.1 Xem hồ sơ theo 3 mức (M, đã có)

- **AC-1.1.1** Giả sử B không phải quản lý trực tiếp của A, không phải HR. Khi B mở hồ sơ A. Thì B chỉ thấy trường danh bạ,
  không thấy ngày sinh, địa chỉ.
- **AC-1.1.2** Giả sử M là quản lý trực tiếp của A. Khi M mở hồ sơ A. Thì M thấy thêm ngày sinh, địa chỉ, ngày vào làm,
  trạng thái; không thấy CCCD, số tài khoản, lương.
- **AC-1.1.3** Giả sử người dùng có vai trò ADMIN. Khi mở hồ sơ người khác. Thì chỉ thấy mức danh bạ.

### FR-1.2 Nhân viên tự sửa liên hệ (M, đã có)

- **AC-1.2.1** Giả sử nhân viên đã đăng nhập. Khi sửa `phone`, `address` của chính mình với giá trị hợp lệ. Thì trả 200,
  hồ sơ đổi, audit `UPDATE` ghi tên trường đã đổi.
- **AC-1.2.2** Khi nhân viên sửa trường khác (ví dụ `jobTitle`) hoặc sửa hồ sơ người khác. Thì trả 403, hồ sơ không đổi.
- **AC-1.2.3** Khi số điện thoại sai mẫu. Thì trả 400 kèm `fields.phone`.

### FR-1.3 HR xem trường nhạy cảm (M, đã có)

- **AC-1.3.1** Giả sử người dùng là HR. Khi gọi `GET /employees/{id}?include=sensitive`. Thì thấy CCCD, số tài khoản, lương
  đã giải mã, và có audit `VIEW_SENSITIVE` ghi người xem, nhân viên bị xem, `traceId`.
- **AC-1.3.2** Khi vai trò khác HR gọi `include=sensitive`. Thì trả 403 và không có audit đọc.
- **AC-1.3.3** Khi HR mở hồ sơ không kèm `include=sensitive`. Thì không có trường nhạy cảm, không ghi `VIEW_SENSITIVE`.

### FR-1.4 HR sửa mọi trường (M, đã có API và giao diện, PR #63)

- **AC-1.4.1** Khi HR sửa lương. Thì trả 200; audit `UPDATE` có tên trường `salary`, không có giá trị cũ hay mới.
- **AC-1.4.2** Khi HR nhập sai định dạng trên giao diện. Thì lỗi hiện đúng ô theo `fields` của response 400.

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
  không gửi `version`.

### Quy tắc chờ chốt (TV2)

- **AC-1.7.1** *(chưa chốt)* Khi HR chuyển nhân viên còn cấp dưới sang `TERMINATED`. Thì bị chặn, hoặc buộc chuyển cấp dưới
  sang quản lý khác trước. TV2 chốt cách làm ở nhánh `docs/org-integrity-rules`, rồi sửa tiêu chí này.

## 3. Yêu cầu phi chức năng liên quan

NFR-1.1, NFR-1.2 (thời gian phản hồi); NFR-5.12, NFR-5.13 (phân quyền theo vai trò và dữ liệu); NFR-5.17 (mã hóa trường nhạy
cảm); NFR-5.18 (không lộ giá trị nhạy cảm vào log, audit); NFR-6.1 (audit đủ). Chi tiết ở
[SRS mục 6](../../requirements/SRS.md#6-yêu-cầu-phi-chức-năng-nfr).

## 4. Việc còn lại

Lịch làm theo [kế hoạch theo chức năng tuần 11–13](../../progress/tuan-04-ke-hoach-tong.md#7-kế-hoạch-theo-chức-năng-tuần-11--13).

| Việc | Tiêu chí | Người | Nhánh | Tuần |
|---|---|---|---|---|
| Cập nhật trạng thái FR-1.4, FR-1.5 trong SRS | – | TV2 | `docs/matrix-week10` | 10 |
| Chốt quy tắc chấm dứt nhân viên còn cấp dưới | AC-1.7.1 | TV2 | `docs/org-integrity-rules` | 11 |
| Bắt buộc `version` khi sửa; chặn theo quy tắc TV2 vừa chốt | AC-1.6.2, AC-1.7.1 | TV1 | `fix/employee-org-integrity` | 11 |
| Ca kiểm thử cho các tiêu chí trên | AC-1.6.2, AC-1.7.1 | TV4 | `docs/test-cases-week11` | 11 |
