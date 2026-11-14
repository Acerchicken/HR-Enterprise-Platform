# UC1 – Hồ sơ nhân viên: yêu cầu và tiêu chí chấp nhận

> Đọc file này trước khi mở nhánh làm UC1. Luồng chi tiết: [spec.md](spec.md) (bố cục trang ở mục 9.1, dữ liệu từng mục ở
> mục 8). Nguồn FR: [SRS mục 4.1](../../requirements/SRS.md#41-uc1--hồ-sơ-nhân-viên-fr-1x).
> Mỗi tiêu chí `AC-x.y.z` là một ca kiểm thử. PR làm chức năng ghi mã AC đã làm trong mô tả PR.
> *(chưa đạt)*: đã có code nhưng làm sai. *(chưa có)*: chưa làm.

## 1. User story

| Mã | Là | Tôi muốn | Để | FR |
|---|---|---|---|---|
| US-1.1 | Nhân viên | Xem hồ sơ đồng nghiệp ở mức danh bạ | Biết cách liên lạc | FR-1.1 |
| US-1.2 | Quản lý trực tiếp | Xem thông tin cá nhân và công việc của cấp dưới | Nắm thông tin người mình quản lý | FR-1.1 |
| US-1.3 | Nhân viên | Tự sửa số điện thoại, địa chỉ rồi gửi HR xác nhận | Không phải gửi giấy cho HR, mà dữ liệu vẫn được kiểm | FR-1.2 |
| US-1.4 | HR | Xem CCCD, số tài khoản, lương khi cần, mỗi lần xem đều có dấu vết | Làm nghiệp vụ mà vẫn kiểm soát được dữ liệu nhạy cảm | FR-1.3 |
| US-1.5 | HR | Tạo nhân viên mới và sửa mọi trường | Hồ sơ nằm tập trung một chỗ | FR-1.4, FR-1.5 |
| US-1.6 | HR | Được báo khi người khác vừa sửa cùng hồ sơ | Không ghi đè thay đổi của nhau | FR-1.6 |
| US-1.7 | HR | Cho người nghỉ việc ra khỏi hệ thống mà không làm hỏng cây tổ chức | Người đã nghỉ không còn truy cập | FR-1.7 |
| US-1.8 | Nhân viên | Xem hồ sơ của mình trên một trang chia nhóm, dùng được trên điện thoại | Tìm nhanh thông tin cá nhân, công việc, tài chính, phúc lợi | FR-1.8 |
| US-1.9 | Nhân viên | Tự thêm, sửa, xóa người liên hệ khẩn cấp, thân nhân, bằng cấp, tài khoản ngân hàng, nơi khám chữa bệnh, rồi gửi HR xác nhận | Hồ sơ luôn đúng mà không phải gửi giấy cho HR | FR-1.9 |
| US-1.15 | HR | Xem danh sách yêu cầu cập nhật hồ sơ, so giá trị cũ và mới, duyệt hoặc từ chối | Chỉ thông tin đã kiểm mới vào hồ sơ | FR-1.9 |
| US-1.10 | Nhân viên | Tải lên CV, bằng cấp, giấy tờ người phụ thuộc, ảnh đại diện | HR có bản số, không phải nộp giấy | FR-1.10 |
| US-1.11 | Nhân viên, HR | Xem lại ai đã thêm, sửa, xóa, tải lên gì trong hồ sơ và lúc nào | Phát hiện thay đổi lạ, đối chiếu khi có tranh chấp | FR-1.11 |
| US-1.12 | HR | Quản lý hợp đồng, lương, bảo hiểm, phụ cấp, khen thưởng kỷ luật trong hồ sơ | Bỏ file Excel riêng cho từng loại | FR-1.12 |
| US-1.13 | Nhân viên, quản lý | Xem quá trình công tác, các mốc thâm niên, các đợt nghỉ dài | Không phải hỏi HR | FR-1.13 |
| US-1.14 | Quản trị hệ thống | Chặn việc gửi dồn dập, tải file rác, cào dữ liệu hồ sơ | Hệ thống không bị spam, không lộ dữ liệu hàng loạt | FR-1.14 |

## 2. Tiêu chí chấp nhận

### FR-1.1 Xem hồ sơ theo mức (M, đã có)

- **AC-1.1.1** Giả sử B không phải quản lý trực tiếp của A, không phải HR. Khi B mở hồ sơ A. Thì B thấy mã nhân viên, họ tên,
  ảnh, chức danh, phòng ban, quản lý trực tiếp, **số điện thoại và email công ty**; không thấy địa chỉ, ngày sinh, ngày vào làm,
  trạng thái hay bất kỳ mục nào bên dưới (spec 9.1).
- **AC-1.1.2** Giả sử M là quản lý trực tiếp của A. Khi M mở hồ sơ A. Thì M thấy thêm ngày sinh, địa chỉ, ngày vào làm,
  trạng thái; không thấy CCCD, số tài khoản, lương.
- **AC-1.1.3** Giả sử người dùng có vai trò ADMIN. Khi mở hồ sơ người khác. Thì chỉ thấy mức danh bạ.

### FR-1.2 Nhân viên sửa liên hệ qua yêu cầu (M; code chưa đạt: đang lưu thẳng)

- **AC-1.2.1** *(chưa đạt)* Giả sử nhân viên đã đăng nhập. Khi sửa `phone`, `address` của chính mình với giá trị hợp lệ và bấm
  "Gửi yêu cầu". Thì trả 202, tạo yêu cầu `PENDING` (FR-1.9); hồ sơ **chưa đổi**, `version` giữ nguyên. Code hiện lưu thẳng,
  trả 200.
- **AC-1.2.2** Khi nhân viên sửa trường khác (ví dụ `jobTitle`) hoặc sửa hồ sơ người khác. Thì trả 403, không tạo yêu cầu.
- **AC-1.2.3** Khi số điện thoại sai mẫu. Thì trả 400 kèm `fields.phone`, không tạo yêu cầu.

### FR-1.3 Xem trường nhạy cảm (M, HR đã có; chủ hồ sơ chưa có)

- **AC-1.3.1** Giả sử người dùng là HR. Khi gọi `GET /employees/{id}?include=sensitive`. Thì thấy CCCD, số tài khoản, lương
  đã giải mã, và có audit `VIEW_SENSITIVE` ghi người xem, nhân viên bị xem, `traceId`.
- **AC-1.3.2** Khi người không phải HR, không phải chủ hồ sơ gọi `include=sensitive`. Thì trả 403 và không có audit đọc.
- **AC-1.3.3** Khi HR mở hồ sơ không kèm `include=sensitive`. Thì không có trường nhạy cảm, không ghi `VIEW_SENSITIVE`.
- **AC-1.3.4** *(chưa đạt)* Khi HR mở form sửa hồ sơ. Thì giá trị nhạy cảm không tự tải, không sinh `VIEW_SENSITIVE`; chỉ khi
  HR bấm biểu tượng mắt mới tải và ghi audit.
- **AC-1.3.5** *(chưa có)* Khi nhân viên A bấm mắt ở "Lương mục tiêu" hoặc "Tài khoản ngân hàng" của chính mình. Thì thấy giá
  trị, có audit `VIEW_SENSITIVE` ghi A xem hồ sơ A. A không xem được CCCD của mình qua đường này (đã có trên giấy tờ của A).

### FR-1.4 HR sửa mọi trường (M, đã có API và giao diện, PR #63)

- **AC-1.4.1** Khi HR sửa lương. Thì trả 200; audit `UPDATE` có tên trường `salary`, không có giá trị cũ hay mới.
- **AC-1.4.2** Khi HR nhập sai định dạng trên giao diện. Thì lỗi hiện đúng ô theo `fields` của response 400.
- **AC-1.4.3** *(chưa đạt)* Khi HR đổi phòng ban, chức danh, quản lý, trạng thái hoặc ngày vào làm. Thì audit ghi tên trường,
  giá trị cũ và mới. Khi đổi họ tên, điện thoại, địa chỉ, ngày sinh. Thì audit chỉ ghi tên trường.
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
- **AC-1.6.2** *(chưa đạt)* Khi gửi yêu cầu sửa không kèm `version`. Thì trả 400.
- **AC-1.6.3** *(chưa đạt)* Giả sử HR1, HR2 cùng mở hồ sơ. Khi HR1 chỉ sửa lương rồi HR2 lưu. Thì HR2 nhận 409.
- **AC-1.6.4** *(chưa có)* Mỗi dòng trong các mục (FR-1.9, FR-1.12) có `version` riêng; yêu cầu cập nhật lưu `version` gốc lúc
  gửi; duyệt khi `version` đã đổi trả 409 (AC-1.9.6).

### FR-1.7 Nghỉ việc (M, chưa đạt)

- **AC-1.7.1** *(chưa đạt)* Khi HR chuyển nhân viên còn cấp dưới đang làm việc sang `TERMINATED`. Thì trả 400, nêu số cấp dưới
  cần chuyển sang quản lý khác trước.
- **AC-1.7.2** *(chưa đạt)* Giả sử hồ sơ đã `TERMINATED`. Khi tài khoản gắn với hồ sơ đó gọi API bằng token còn hạn. Thì bị từ
  chối (403).

### FR-1.8 Trang hồ sơ theo nhóm (S, chưa có)

Bố cục ở [spec mục 9.1](spec.md#91-bố-cục-trang-hồ-sơ).

- **AC-1.8.1** *(chưa có)* Khi nhân viên mở "Hồ sơ của tôi". Thì thấy đầu trang (ảnh hoặc chữ cái đầu, mã nhân viên, họ tên,
  chức danh), thẻ quản lý trực tiếp, thẻ sơ đồ tổ chức, ba hàng nhanh, rồi các nhóm Thông tin cá nhân, Công việc, Tài chính,
  Phúc lợi, Khác theo đúng thứ tự ở spec mục 9.1.
- **AC-1.8.2** *(chưa có)* Giả sử mục "Bảo hiểm xã hội" chưa làm. Khi xem trang. Thì tiêu đề mục màu đỏ `#DC2626` kèm nhãn
  "Chưa có"; bấm vào mở trang "Chức năng đang phát triển", không gọi API. Mục đã làm có tiêu đề màu thường.
- **AC-1.8.3** *(chưa có)* Trên mọi trang, nút chính, link, tiêu đề nhóm dùng `--primary: #0E7490` (cyan); không còn `#2457C5`.
- **AC-1.8.4** *(chưa có)* Giả sử B chỉ ở mức danh bạ với A. Khi B mở hồ sơ A. Thì chỉ thấy đầu trang, điện thoại, email.
  Quản lý trực tiếp thấy thêm đúng các mục spec 9.1 cho phép; HR thấy mọi nhóm và nút "Sửa hồ sơ".
- **AC-1.8.5** *(chưa có)* Trên màn hình rộng 375 px, trang một cột, không cuộn ngang.
- **AC-1.8.6** *(chưa có)* Mục người xem không có quyền thì không hiện, và API của mục đó trả 404 giống mục không tồn tại.
- **AC-1.8.7** *(chưa đạt)* Khi mở trang hồ sơ. Thì trình duyệt chỉ gọi `GET /employees/{id}/summary` (và `GET /me` nếu chưa có);
  response chỉ gồm trường hiện ở trang mặc định (spec 9.1) và danh sách mục, không có ngày sinh, địa chỉ, dòng của mục nào hay
  giá trị nhạy cảm. Hiện `GET /me`, `GET /employees/{id}` trả mọi trường cá nhân ngay khi mở trang.
- **AC-1.8.8** *(chưa có)* Khi bấm vào một mục. Thì mới có đúng một request lấy dữ liệu của mục đó; các mục chưa bấm không có
  request nào. Bấm mắt mới có request lấy giá trị nhạy cảm.

### FR-1.9 Nhân viên gửi yêu cầu cập nhật, HR xác nhận (S, chưa có)

Nhân viên được sửa các trường và mục có cột "Nhập" là NV (spec mục 8): điện thoại, địa chỉ, liên hệ khẩn cấp, thân nhân và
người phụ thuộc, chuyên môn và bằng cấp, tài khoản ngân hàng, nơi khám chữa bệnh ban đầu, ảnh đại diện, CV. Bấm "Gửi yêu cầu"
chỉ tạo một **yêu cầu cập nhật**; HR kiểm, đúng thì duyệt và dữ liệu mới được ghi vào hồ sơ. HR tự sửa hồ sơ thì lưu thẳng.

- **AC-1.9.1** *(chưa có)* Khi nhân viên gửi yêu cầu thêm một người liên hệ khẩn cấp hợp lệ. Thì trả 202, yêu cầu `PENDING` gồm
  mục, thao tác (thêm, sửa, xóa), giá trị đề xuất; hồ sơ chưa đổi; audit `PROFILE_CHANGE_SUBMIT` ghi mục, mã yêu cầu, tên các
  trường, không ghi giá trị.
- **AC-1.9.2** *(chưa có)* Giả sử có yêu cầu `PENDING`. Khi nhân viên mở mục đó. Thì thấy dữ liệu hiện tại kèm khung "Đang chờ HR
  xác nhận" với giá trị đề xuất; nhân viên hủy được yêu cầu (`CANCELLED`, audit `PROFILE_CHANGE_CANCEL`). Người khác (kể cả quản
  lý trực tiếp) chỉ thấy dữ liệu hiện tại.
- **AC-1.9.3** *(chưa có)* Khi HR mở "Yêu cầu cập nhật hồ sơ". Thì thấy các yêu cầu `PENDING`, cũ nhất trước, lọc theo mục,
  phòng ban; mở một yêu cầu thấy giá trị hiện tại và giá trị đề xuất cạnh nhau, file đính kèm tải được. Giá trị nhạy cảm hiện
  `********` cho tới khi HR bấm mắt (audit `VIEW_SENSITIVE`).
- **AC-1.9.4** *(chưa có)* Khi HR duyệt. Thì trong một giao dịch: thay đổi được ghi vào hồ sơ, `version` của hồ sơ hoặc dòng tăng
  1, yêu cầu `APPROVED` kèm người duyệt và thời điểm, audit `PROFILE_CHANGE_APPROVE` ghi mục, mã yêu cầu, tên trường; file đính
  kèm chuyển `READY`. Nhân viên nhận email báo chung "Yêu cầu cập nhật hồ sơ của bạn đã được xử lý".
- **AC-1.9.5** *(chưa có)* Khi HR từ chối kèm lý do (bắt buộc, tối đa 500 ký tự). Thì yêu cầu `REJECTED`, hồ sơ không đổi, nhân
  viên thấy lý do trong ứng dụng và nhận email báo chung; audit `PROFILE_CHANGE_REJECT` không chứa lý do. File đính kèm bị xóa
  sau 30 ngày.
- **AC-1.9.6** *(chưa có)* Giả sử sau khi nhân viên gửi yêu cầu, HR đã sửa trực tiếp cùng trường. Khi HR duyệt yêu cầu cũ. Thì
  trả 409 (giá trị gốc đã đổi); HR từ chối hoặc nhân viên gửi lại.
- **AC-1.9.7** *(chưa có)* Mỗi trường hoặc dòng chỉ có tối đa một yêu cầu `PENDING`. Khi nhân viên gửi yêu cầu mới cho cùng chỗ.
  Thì yêu cầu cũ chuyển `CANCELLED`, yêu cầu mới thay thế. Một người có tối đa 20 yêu cầu `PENDING`; vượt trả 409.
- **AC-1.9.8** *(chưa có)* Khi nhân viên gửi yêu cầu ở mục do HR quản lý (hợp đồng, lương, BHXH, phụ cấp, khen thưởng kỷ luật),
  ở hồ sơ người khác, hoặc khi người không phải HR gọi duyệt, từ chối. Thì trả 403.
- **AC-1.9.9** *(chưa có)* Khi dữ liệu đề xuất sai (thiếu trường bắt buộc, sai mẫu, ngày sinh ở tương lai, quá độ dài) hoặc làm
  vượt số dòng tối đa của mục. Thì trả 400 kèm `fields` hoặc 409, không tạo yêu cầu.
- **AC-1.9.10** *(chưa có)* Khi HR duyệt yêu cầu đổi tài khoản ngân hàng. Thì ngoài email báo xử lý, nhân viên nhận email "thông
  tin tài khoản ngân hàng trên HRHelper vừa thay đổi" (không kèm số tài khoản), để phát hiện yêu cầu không phải do mình gửi.
- **AC-1.9.11** *(chưa có)* Khi duyệt thân nhân là người phụ thuộc. Thì mã số thuế hoặc CCCD của người đó được mã hóa khi lưu;
  "Thông tin thuế TNCN" tự đếm số người phụ thuộc đang hiệu lực.
- **AC-1.9.12** *(chưa có)* Khi gửi lại cùng `Idempotency-Key`. Thì trả lại yêu cầu đã tạo, không tạo yêu cầu thứ hai.
- **AC-1.9.13** *(chưa có)* Khi có yêu cầu mới. Thì HR nhận email báo chung "Có yêu cầu cập nhật hồ sơ cần xử lý" (gộp tối đa một
  email mỗi giờ); yêu cầu chờ quá 2 ngày làm việc hiện nhãn "Quá hạn" trong danh sách của HR.

### FR-1.10 Tệp đính kèm hồ sơ (S, chưa có)

- **AC-1.10.1** *(chưa có)* Khi nhân viên tải lên CV hoặc file bằng cấp: PDF, DOCX, JPG hoặc PNG, từ 1 byte đến 10 MiB. Thì
  API trả URL tải lên hết hạn sau 10 phút; trình duyệt PUT file thẳng lên storage rồi gọi xác nhận; file `PENDING_REVIEW` và gắn
  vào một yêu cầu cập nhật (FR-1.9), chỉ chủ hồ sơ và HR thấy; HR duyệt yêu cầu thì file `READY`. Có audit
  `PROFILE_FILE_UPLOAD` ghi mã file, mục, loại, dung lượng, SHA-256, không ghi tên file gốc.
- **AC-1.10.2** *(chưa có)* Khi nội dung file không khớp loại khai báo (ZIP đổi đuôi `.pdf`, `.exe` đổi đuôi `.jpg`) hoặc sai
  dung lượng khai báo. Thì file `REJECTED`, object bị xóa, trả 400.
- **AC-1.10.3** *(chưa có)* Khi tải lên ảnh đại diện. Thì chỉ nhận JPG, PNG ≤ 2 MiB; ảnh được cắt về 512 × 512 và xóa EXIF
  (bỏ vị trí GPS); ảnh cũng qua HR duyệt như FR-1.9, duyệt xong mọi người mới thấy.
- **AC-1.10.4** *(chưa có)* Khi tải lên file trùng nội dung (cùng SHA-256) với file `READY` đã có trong cùng mục của cùng người.
  Thì trả lại file cũ, không lưu thêm.
- **AC-1.10.5** *(chưa có)* Khi tải xuống. Thì API kiểm quyền rồi stream file với `Content-Disposition: attachment` và
  `X-Content-Type-Options: nosniff`; response không chứa link storage. HR tải file của người khác thì có audit
  `PROFILE_FILE_DOWNLOAD`.
- **AC-1.10.6** *(chưa có)* Khi người không có quyền xem mục gọi tải file theo ID. Thì trả 404 giống ID không tồn tại.
- **AC-1.10.7** *(chưa có)* Khi HR duyệt yêu cầu xóa file của nhân viên. Thì file `DELETED`, nhân viên không thấy, HR vẫn thấy trong 30
  ngày; sau 30 ngày object bị xóa khỏi storage, audit vẫn còn. Nhân viên không xóa được file HR tải lên (hợp đồng, quyết định).
- **AC-1.10.8** *(chưa có)* Khi một người đã có 50 file `READY` hoặc tổng 200 MiB. Thì tải thêm trả 409, câu báo nêu giới hạn.
- **AC-1.10.9** *(chưa có)* Khi chưa cấu hình `PROFILE_STORAGE_BUCKET`. Thì các thao tác file trả 503; xem, sửa thông tin hồ
  sơ vẫn chạy.

### FR-1.11 Nhật ký thay đổi hồ sơ (S, chưa có)

- **AC-1.11.1** *(chưa có)* Khi chủ hồ sơ mở "Lịch sử thay đổi" trong hồ sơ của mình. Thì thấy danh sách: thời điểm, người
  làm, thao tác (gửi yêu cầu, hủy, HR duyệt, HR từ chối, HR sửa trực tiếp, tải lên, HR xem trường nhạy cảm), mục, tên trường; không có giá trị; mới nhất trước,
  phân trang.
- **AC-1.11.2** *(chưa có)* HR xem được lịch sử của mọi hồ sơ, lọc theo mục, người làm, khoảng ngày. Quản lý trực tiếp và người
  khác không xem được (403).
- **AC-1.11.3** *(chưa có)* Mọi thao tác gửi, hủy, duyệt, từ chối yêu cầu (FR-1.9), tải file (FR-1.10) và mọi lần HR sửa trực tiếp
  (FR-1.4, FR-1.12) có đúng một bản ghi audit, ghi cùng giao dịch với thay
  đổi; thao tác thất bại không có audit.
- **AC-1.11.4** *(chưa có)* Trong audit, log API và log worker không có giá trị của trường cá nhân, trường nhạy cảm, tên file gốc
  hay nội dung file (NFR-5.18).

### FR-1.12 Mục do HR quản lý (C, chưa có)

Hợp đồng (diện đối tượng), lương mục tiêu theo thời gian, hệ số lương bảo hiểm, BHXH, số thẻ BHYT, phụ cấp, khen thưởng kỷ
luật, quá trình công tác trước khi có hệ thống.

- **AC-1.12.1** *(chưa có)* Khi HR thêm hợp đồng với loại, số, ngày bắt đầu, ngày kết thúc (trừ không xác định thời hạn) và file
  đã ký. Thì hàng "Diện đối tượng" ở đầu trang hiện loại của hợp đồng đang hiệu lực.
- **AC-1.12.2** *(chưa có)* Khi HR thêm hợp đồng trùng khoảng ngày với hợp đồng khác của cùng người. Thì trả 409.
- **AC-1.12.3** *(chưa có)* Khi HR thêm mức lương mới có ngày hiệu lực. Thì mức cũ giữ lại thành lịch sử; "Lương mục tiêu" hiện
  mức đang hiệu lực. Giá trị mã hóa khi lưu.
- **AC-1.12.4** *(chưa có)* Nhân viên xem được mục HR quản lý của chính mình theo quyền ở spec 9.1, không sửa được (AC-1.9.3).
- **AC-1.12.5** *(chưa có)* Khi hợp đồng còn 30 ngày nữa hết hạn. Thì HR thấy hồ sơ đó trong danh sách "Hợp đồng sắp hết hạn".

### FR-1.13 Thông tin tự tính (C, chưa có)

- **AC-1.13.1** *(chưa có)* "Quá trình công tác" liệt kê các lần đổi phòng ban, chức danh, quản lý trực tiếp, lấy từ audit nhóm
  trường tổ chức (AC-1.4.3) cộng các dòng HR nhập cho giai đoạn trước khi có hệ thống.
- **AC-1.13.2** *(chưa có)* Giả sử ngày vào làm 1/3/2016. Khi xem "Các mốc trong công ty" ngày 14/11/2026. Thì thấy thâm niên 10
  năm 8 tháng, các mốc 5 năm (1/3/2021, 1/3/2026) và số ngày phép năm được cộng theo thâm niên (UC3 AC-3.1.3).
- **AC-1.13.3** *(chưa có)* "Ngày nghỉ dài" liệt kê các đơn nghỉ từ 14 ngày làm việc trở lên đã duyệt hoặc hoàn tất (UC3) và các
  khoảng trạng thái `ON_LEAVE`.

### FR-1.14 Chống spam và lạm dụng (M, chưa có)

Giới hạn tính theo từng người dùng. Vượt giới hạn trả 429 kèm `Retry-After`; không có thay đổi dữ liệu, không có audit nghiệp
vụ, có log và metric để cảnh báo.

- **AC-1.14.1** *(chưa có)* Khi một người gửi quá 30 lệnh ghi hồ sơ (gửi yêu cầu cập nhật, HR sửa hồ sơ, duyệt, từ chối) trong 1 phút. Thì lệnh thứ
  31 trả 429. Quá 300 lệnh ghi trong 1 ngày cũng trả 429.
- **AC-1.14.2** *(chưa có)* Khi một người xin quá 10 URL tải lên trong 1 giờ, hoặc quá 30 trong 1 ngày. Thì trả 429. Đổi ảnh
  đại diện tối đa 5 lần mỗi ngày.
- **AC-1.14.3** *(chưa có)* Khi một người tải xuống quá 60 file trong 1 giờ. Thì trả 429.
- **AC-1.14.4** *(chưa có)* Khi một người gọi xem trường nhạy cảm (`include=sensitive`, kể cả HR) quá 100 lần trong 1 giờ. Thì
  trả 429 và gửi cảnh báo tới kênh vận hành (nghi cào dữ liệu).
- **AC-1.14.5** *(chưa có)* Khi một người nhận 429 quá 20 lần trong 10 phút. Thì có cảnh báo trên dashboard vận hành.
- **AC-1.14.6** *(chưa có)* Giới hạn độ dài từng trường (spec mục 8) và kích thước body request ≤ 64 KiB; vượt trả 400 hoặc 413.
- **AC-1.14.7** *(chưa có)* Giới hạn của UC1 cộng với giới hạn chung 100 request/phút (NFR-5.21); request bị chặn bởi giới hạn
  nào thì câu báo nêu giới hạn đó.

## 3. Yêu cầu phi chức năng liên quan

NFR-1.1, NFR-1.2 (thời gian phản hồi); NFR-5.12, NFR-5.13 (phân quyền theo vai trò và dữ liệu); NFR-5.17 (mã hóa trường nhạy
cảm); NFR-5.18 (không lộ giá trị nhạy cảm vào log, audit); NFR-5.21 (giới hạn tần suất); NFR-5.23 (kiểm loại file theo nội
dung); NFR-6.1 (audit đủ); NFR-11.1, NFR-11.2 (dữ liệu cá nhân, chỉ thu dữ liệu cần thiết). Chi tiết ở
[SRS mục 6](../../requirements/SRS.md#6-yêu-cầu-phi-chức-năng-nfr).

## 4. Việc còn lại

Lịch làm theo [kế hoạch hoàn thành từng chức năng](../../progress/ke-hoach-tong.md#7-kế-hoạch-hoàn-thành-từng-chức-năng-tuần-10--13).
Dự án đóng băng ngày 2/12, nên FR-1.12 và FR-1.13 để sau MVP; mục chưa làm vẫn hiện trên trang với tiêu đề đỏ (AC-1.8.2).

| Việc | Tiêu chí | Người | Nhánh | Tuần |
|---|---|---|---|---|
| Xác nhận quy tắc nghỉ việc, audit theo nhóm trường, danh sách mục nhân viên được gửi yêu cầu, thời hạn HR xử lý, giới hạn | AC-1.7.1, AC-1.4.3, FR-1.9, FR-1.14 | TV2 | `docs/org-integrity-rules` | 11 |
| Bắt buộc `version`; audit theo nhóm trường; sửa `hireDate`, `workEmail`; nghỉ việc; chỉ tải trường nhạy cảm khi bấm mắt | AC-1.3.4, AC-1.4.3, AC-1.4.4, AC-1.6.2, AC-1.6.3, AC-1.7.1, AC-1.7.2 | TV1 | `fix/employee-org-integrity` | 11 |
| Trang hồ sơ theo nhóm, màu cyan, mục chưa có tiêu đề đỏ, tải theo nhu cầu (`summary` + API từng mục); chủ hồ sơ tự xem lương, tài khoản | AC-1.8.x, AC-1.3.5 | TV1 | `feat/profile-layout` | 11 |
| Giới hạn tần suất cho hồ sơ (dùng chung cơ chế NFR-5.21) | AC-1.14.x | TV1 | `feat/security-headers-ratelimit` | 11 |
| Yêu cầu cập nhật hồ sơ và màn hình duyệt của HR (cả điện thoại, địa chỉ), nhật ký thay đổi | AC-1.2.1, AC-1.9.x, AC-1.6.4, AC-1.11.x | TV1 | `feat/profile-self-service` | 12 |
| Tệp đính kèm hồ sơ | AC-1.10.x | TV1 | `feat/profile-files` | 12 |
| Bucket hồ sơ, `PROFILE_STORAGE_BUCKET`, lifecycle xóa file sau 30 ngày, cảnh báo 429 | AC-1.10.7, AC-1.10.9, AC-1.14.4, AC-1.14.5 | TV3 | `infra/profile-files` | 12 |
| Ca kiểm thử UC1, gồm ca bảo mật file và rate limit | Mọi AC-1.x | TV4 | `docs/test-cases-week11`, `docs/security-test-cases-week11` | 11–12 |
| Mục do HR quản lý, thông tin tự tính | FR-1.12, FR-1.13 | – | – | Sau MVP |
