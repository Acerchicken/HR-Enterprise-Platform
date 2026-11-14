# UC1 – Hồ sơ nhân viên

| Mục | Nội dung |
|---|---|
| Mục tiêu kinh doanh | MT-1 (hồ sơ tập trung), MT-3 (kiểm soát dữ liệu nhạy cảm) |
| Tác nhân chính | Nhân viên (xem, gửi yêu cầu cập nhật, tải file kèm yêu cầu); HR (duyệt yêu cầu, tạo, sửa mọi mục, xem trường nhạy cảm) |
| Tác nhân phụ, hệ thống ngoài | Quản lý trực tiếp (xem thông tin cá nhân, công việc của cấp dưới); identity provider (đăng nhập); object storage (file hồ sơ); dịch vụ email |
| Yêu cầu (SRS) | FR-1.1 → FR-1.14 |
| Quy tắc | ADR-08 (mã hóa trường nhạy cảm), ADR-09 (audit), ADR-10 (MANAGER suy ra từ tổ chức), ADR-13 (lưu file qua presigned URL), [ma trận phân quyền – Hồ sơ nhân viên](../../security/access-control-matrix.md#hồ-sơ-nhân-viên) |
| Mức ưu tiên | M: FR-1.1 → FR-1.5, FR-1.7, FR-1.14. S: FR-1.6, FR-1.8 → FR-1.11. C: FR-1.12, FR-1.13 |
| Trạng thái | Đã có: xem theo mức, tự sửa liên hệ, HR tạo, sửa, xem trường nhạy cảm (PR #63). Còn lại chưa có, xem mục 12 |
| Phiên bản | 2.1 – 14/11/2026 (thay đổi của nhân viên phải qua HR xác nhận, luồng 4.2, 4.7) |

## 1. Mô tả ngắn

Mỗi nhân viên có một hồ sơ duy nhất trên hệ thống, thay cho các file Excel và hồ sơ giấy. Trang hồ sơ chia thành các nhóm
giống ứng dụng HR di động: đầu trang, Thông tin cá nhân, Công việc, Tài chính, Phúc lợi, Khác (mục 9.1).

Ai được xem gì phụ thuộc quan hệ với chủ hồ sơ:

- Người khác (không phải HR, không phải quản lý trực tiếp) chỉ thấy thông tin danh bạ: mã, họ tên, ảnh, chức danh, phòng ban,
  quản lý trực tiếp, số điện thoại, email công ty. Không thấy địa chỉ, ngày sinh.
- Quản lý trực tiếp thấy thêm thông tin cá nhân và công việc.
- Chủ hồ sơ thấy toàn bộ hồ sơ của mình; lương, số tài khoản chỉ hiện khi bấm biểu tượng mắt.
- HR thấy toàn bộ mọi hồ sơ. Mỗi lần xem trường nhạy cảm đều ghi audit.

Thông tin chia làm hai loại theo người nhập:

- **Nhân viên đề xuất, HR xác nhận:** điện thoại, địa chỉ, người liên hệ khẩn cấp, thân nhân và người phụ thuộc, chuyên môn
  và bằng cấp, tài khoản ngân hàng, nơi khám chữa bệnh ban đầu, ảnh đại diện, CV. Nhân viên tự sửa trên form và tải file kèm,
  nhưng bấm "Gửi yêu cầu" chỉ tạo một **yêu cầu cập nhật**. HR so giá trị cũ và mới, đối chiếu giấy tờ; đúng thì duyệt và dữ
  liệu mới được ghi vào hồ sơ, sai thì từ chối kèm lý do. Mọi bước đều ghi nhật ký.
- **HR quản lý:** thông tin tổ chức, hợp đồng, lương, bảo hiểm, phụ cấp, khen thưởng kỷ luật. Nhân viên chỉ xem.

Mọi thao tác ghi và tải file có giới hạn tần suất và hạn mức để chống spam, chống cào dữ liệu.

Mục nào chưa làm vẫn hiện trên trang với tiêu đề màu đỏ, để người dùng và nhóm phát triển cùng thấy phần còn thiếu.

## 2. Tác nhân và quyền

| Tác nhân | Được làm gì | Giới hạn theo dữ liệu |
|---|---|---|
| Nhân viên (mọi vai trò có hồ sơ) | Xem toàn bộ hồ sơ của mình; gửi, hủy yêu cầu cập nhật các trường và mục có cột "Nhập" là NV (kể cả thêm, xóa dòng, tải lên, xóa file); tải xuống file của mình; xem lương, số tài khoản của mình khi bấm mắt; xem nhật ký thay đổi hồ sơ của mình | Không tự ghi thẳng vào hồ sơ; không gửi yêu cầu cho mục HR quản lý; không xóa file HR tải lên; không xem CCCD của mình qua ứng dụng; không xem hồ sơ người khác quá mức danh bạ |
| Quản lý trực tiếp | Xem mục ghi "QL" ở mục 9.1 của cấp dưới trực tiếp: thông tin cá nhân, công việc, chuyên môn | Không sửa; không xem tài chính, phúc lợi, thân nhân, liên hệ khẩn cấp, file, nhật ký |
| HR | Tạo hồ sơ; sửa mọi mục; xem trường nhạy cảm khi bấm mắt; tải file của mọi người; xem nhật ký mọi hồ sơ; duyệt, từ chối yêu cầu cập nhật | Mỗi lượt xem trường nhạy cảm, mỗi lượt tải file của người khác ghi audit; chịu cùng giới hạn tần suất |
| ADMIN | Như nhân viên đối với hồ sơ của chính mình | Hồ sơ người khác chỉ ở mức danh bạ; không tạo hồ sơ; không xem trường nhạy cảm |

**Mức xem dùng trong mục 8 và 9.1:**

| Ký hiệu | Ai thấy |
|---|---|
| DB | Mọi người đã đăng nhập (danh bạ) |
| QL | Chủ hồ sơ, quản lý trực tiếp, HR |
| CN | Chủ hồ sơ, HR |
| NC | Chủ hồ sơ và HR, chỉ khi bấm mắt; mã hóa khi lưu; mỗi lượt xem ghi `VIEW_SENSITIVE` |
| HR | Chỉ HR (ví dụ CCCD) |

## 3. Điều kiện

- **Điều kiện trước:** người dùng đã đăng nhập, hồ sơ của người dùng không ở trạng thái `TERMINATED`. Tài khoản đã liên kết
  với hồ sơ qua email công ty; nếu chưa liên kết, `GET /me` trả `employee: null` và người dùng không có quyền nào của chủ hồ sơ.
- **Kích hoạt:**
  - Mở trang "Hồ sơ của tôi".
  - Mở hồ sơ một người từ danh bạ hoặc sơ đồ tổ chức.
  - Bấm một mục trên trang hồ sơ để xem, đề xuất thêm, sửa, xóa hoặc tải file.
  - HR mở "Yêu cầu cập nhật hồ sơ".
  - HR bấm "Thêm nhân viên" hoặc "Sửa hồ sơ".
- **Điều kiện sau khi thành công:**
  - Nhân viên gửi: yêu cầu `PENDING` được lưu, hồ sơ chưa đổi.
  - HR duyệt hoặc HR sửa trực tiếp: dữ liệu được ghi; `version` của hồ sơ (trường chính) hoặc của dòng (các mục) tăng 1 sau mọi
    lần ghi, kể cả khi chỉ đổi trường nhạy cảm.
  - Trường nhạy cảm được mã hóa trước khi lưu.
  - Có đúng một bản ghi audit cho thao tác, ghi cùng giao dịch, theo quy tắc ở mục 7.
  - Thao tác file: object trên storage và bản ghi file khớp trạng thái (`READY`, `REJECTED`, `DELETED`).
- **Điều kiện sau khi thất bại:** dữ liệu và `version` giữ nguyên, không có audit nghiệp vụ. File bị từ chối thì object bị xóa.
- **Nghỉ việc:** khi hồ sơ chuyển `TERMINATED`, người đó không dùng được hệ thống nữa: HR khóa tài khoản ở identity provider
  trong ngày, và API từ chối mọi request của tài khoản gắn với hồ sơ `TERMINATED` (kể cả khi token cũ còn hạn). Hồ sơ, file và
  nhật ký vẫn giữ để HR tra cứu.

## 4. Luồng chính

### 4.1 Nhân viên xem hồ sơ và đề xuất sửa liên hệ (FR-1.1, FR-1.2, FR-1.8)

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Nhân viên mở "Hồ sơ của tôi" | Chỉ gọi `GET /employees/{id}/summary`: trả **đúng những gì trang mặc định hiện** (đầu trang, thẻ quản lý và sơ đồ tổ chức, điện thoại, email, nhãn loại hợp đồng) cộng danh sách mục người xem được thấy, mỗi mục có cờ `available` và `pendingRequests`. Không trả ngày sinh, địa chỉ, dòng của các mục hay giá trị nhạy cảm |
| 2 | | Hiện trang theo bố cục mục 9.1; mục chưa có có tiêu đề đỏ; mục có yêu cầu đang chờ có nhãn "Chờ HR xác nhận" |
| 2a | Bấm vào một mục, ví dụ "Thông tin cá nhân" | Lúc này mới gọi API của mục đó (`GET /employees/{id}/profile/personal`), trả dữ liệu của riêng mục. Quay lại trang chính không gọi lại `summary` nếu chưa quá 60 giây |
| 3 | Bấm "Thông tin cá nhân", sửa số điện thoại hoặc địa chỉ, bấm "Gửi yêu cầu" | Tạo yêu cầu cập nhật như luồng 4.2 (mục `personal`, thao tác sửa) |
| 4 | Thấy giá trị cũ và khung "Đang chờ HR xác nhận" với giá trị mới | Hồ sơ chưa đổi cho tới khi HR duyệt (luồng 4.7) |

### 4.2 Nhân viên gửi yêu cầu cập nhật (FR-1.9)

Ví dụ: thêm người liên hệ khẩn cấp. Sửa, xóa dòng và sửa điện thoại, địa chỉ đi cùng luồng.

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Mở mục "Thông tin liên hệ khẩn cấp" | `GET /employees/{id}/profile/emergency-contacts`; trả các dòng hiện tại (mỗi dòng có `version`) và yêu cầu đang chờ của mục |
| 2 | Bấm "Thêm", nhập họ tên, quan hệ, số điện thoại, bấm "Gửi yêu cầu" | `POST /employees/{id}/change-requests` kèm header `Idempotency-Key`; body gồm mục, thao tác (`CREATE`, `UPDATE`, `DELETE`), `itemId` và `baseVersion` nếu sửa, xóa, giá trị đề xuất, mã các file đã tải lên (luồng 4.3) |
| 3 | | Kiểm giới hạn tần suất; kiểm người gọi là chủ hồ sơ; kiểm mục cho phép nhân viên đề xuất (cột "Nhập" là NV, mục 8) |
| 4 | | Kiểm dữ liệu đề xuất theo mục 8 và số dòng tối đa (tính cả dòng sẽ thêm); kiểm người đó chưa có quá 20 yêu cầu `PENDING` |
| 5 | | Nếu cùng trường hoặc dòng đã có yêu cầu `PENDING`: chuyển yêu cầu cũ sang `CANCELLED` |
| 6 | | Mã hóa phần nhạy cảm của giá trị đề xuất; lưu yêu cầu `PENDING`; ghi audit `PROFILE_CHANGE_SUBMIT`; ghi event outbox để báo HR (gộp tối đa một email mỗi giờ) |
| 7 | Thấy khung "Đang chờ HR xác nhận" | Trả 202 kèm yêu cầu. Nhân viên bấm "Hủy yêu cầu" thì yêu cầu `CANCELLED`, audit `PROFILE_CHANGE_CANCEL` |

### 4.3 Nhân viên tải file lên hồ sơ (FR-1.10)

Ví dụ: tải CV. File bằng cấp, giấy tờ người phụ thuộc gắn vào một dòng (`itemId`); CV, ảnh đại diện gắn vào mục.

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Mở "Sơ yếu lý lịch", bấm "Tải lên", chọn file | Trình duyệt tính SHA-256, đọc dung lượng và loại file |
| 2 | | `POST /employees/{id}/files` với mục, `itemId` (nếu có), tên file, loại, dung lượng, SHA-256 |
| 3 | | Kiểm giới hạn tần suất và hạn mức (50 file, 200 MiB mỗi người); kiểm quyền với mục; kiểm loại và dung lượng khai báo |
| 4 | | Nếu đã có file `READY` cùng SHA-256 trong cùng mục: trả file đó, dừng (AC-1.10.4) |
| 5 | | Tạo bản ghi file `PENDING` với khóa object ngẫu nhiên `profiles/{employeeId}/{fileId}`; trả URL PUT hết hạn sau 10 phút |
| 6 | Trình duyệt PUT file lên storage, hiện tiến độ | File không đi qua API |
| 7 | | `POST /employees/{id}/files/{fileId}/confirm` |
| 8 | | Đọc object: so dung lượng, đọc vài byte đầu để kiểm loại theo nội dung, tính lại SHA-256. Sai thì xóa object, file `REJECTED`, trả 400 |
| 9 | | Ảnh đại diện: cắt về 512 × 512, xóa EXIF, lưu bản đã xử lý |
| 10 | | File `PENDING_REVIEW` (chỉ chủ hồ sơ và HR thấy); ghi audit `PROFILE_FILE_UPLOAD` (mã file, mục, loại, dung lượng, SHA-256; không có tên file gốc). File chỉ `READY` khi HR duyệt yêu cầu có kèm file (luồng 4.7); file không gắn vào yêu cầu nào trong 24 giờ thì bị xóa |
| 11 | Thấy file trong khung yêu cầu, bấm "Gửi yêu cầu" | Trả file; nhân viên gửi yêu cầu như luồng 4.2 kèm mã file |

Tải xuống: `GET /employees/{id}/files/{fileId}/download`, API kiểm quyền rồi stream. Nhân viên muốn xóa file thì gửi yêu cầu
xóa (luồng 4.2, thao tác `DELETE`); HR xóa trực tiếp bằng `DELETE /employees/{id}/files/{fileId}`.

### 4.4 HR tạo hồ sơ nhân viên (FR-1.5)

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | HR bấm "Thêm nhân viên" | Hiện form; nạp danh sách phòng ban, chức danh, nhân viên để chọn quản lý |
| 2 | HR nhập thông tin (mục 8.1) và bấm Lưu | Gửi `POST /employees` |
| 3 | | Kiểm dữ liệu: mã `E` + 5 số, email hợp lệ, phòng ban và chức danh tồn tại |
| 4 | | Kiểm quy tắc quản lý (FR-2.5): có đúng một quản lý trực tiếp đang làm việc, trừ CEO; không tạo vòng quản lý |
| 5 | | Mã hóa CCCD, số tài khoản, lương nếu có |
| 6 | | Lưu hồ sơ, ghi audit `CREATE` trong cùng giao dịch |
| 7 | HR được chuyển tới trang hồ sơ vừa tạo | Trả hồ sơ, mã 201 |

### 4.5 HR xem và sửa trường nhạy cảm, mục HR quản lý (FR-1.3, FR-1.4, FR-1.12)

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | HR mở hồ sơ, bấm biểu tượng mắt ở một giá trị nhạy cảm | Gọi `GET /employees/{id}?include=sensitive`. Chỉ gọi khi bấm; mở hồ sơ hay mở form sửa không tự tải giá trị nhạy cảm |
| 2 | | Kiểm giới hạn tần suất xem nhạy cảm; kiểm vai trò; giải mã; ghi audit `VIEW_SENSITIVE` |
| 3 | HR bấm "Sửa hồ sơ", đổi trường bất kỳ, bấm Lưu. Trường nhạy cảm để trống nghĩa là giữ nguyên | Gửi `PATCH /employees/{id}` kèm `version`, chỉ gửi trường đã đổi |
| 4 | | Kiểm `version`, kiểm quy tắc quản lý nếu đổi `managerId`, mã hóa trường nhạy cảm |
| 5 | | Lưu, tăng `version`, ghi audit `UPDATE` theo nhóm trường (mục 7) |
| 6 | Với mục HR quản lý (hợp đồng, lương theo thời gian, BHXH…): HR thêm, sửa dòng như luồng 4.2, tải file như luồng 4.3 | Như 4.2, 4.3; `source = HR`; nhân viên không sửa, không xóa được |

### 4.6 Xem nhật ký thay đổi hồ sơ (FR-1.11)

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Chủ hồ sơ hoặc HR mở "Lịch sử thay đổi" | `GET /employees/{id}/history?page=&section=&actorId=&from=&to=` |
| 2 | | Kiểm người gọi là chủ hồ sơ hoặc HR; đọc audit có `entity_id` là hồ sơ này, gồm cả các dòng, file và yêu cầu cập nhật thuộc hồ sơ |
| 3 | Thấy danh sách mới nhất trước | Mỗi dòng: thời điểm, người làm (tên), thao tác (gửi, hủy, duyệt, từ chối yêu cầu; HR sửa trực tiếp; tải file; xem nhạy cảm), mục, tên trường. Không có giá trị, không có tên file gốc, không có lý do từ chối |

### 4.7 HR xác nhận yêu cầu cập nhật (FR-1.9)

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | HR mở "Việc cần duyệt", tab Sửa hồ sơ (hoặc File hồ sơ, Ảnh đại diện) | `GET /change-requests?status=PENDING&section=&departmentId=&page=`; cũ nhất trước; yêu cầu chờ quá 2 ngày làm việc có nhãn "Quá hạn" |
| 2 | Mở một yêu cầu | `GET /change-requests/{requestId}`; hiện giá trị hiện tại và đề xuất cạnh nhau, trường đổi được tô màu; giá trị nhạy cảm là `********` tới khi bấm mắt (audit `VIEW_SENSITIVE`); file kèm tải được |
| 3 | HR đối chiếu với giấy tờ, bấm "Duyệt" | `POST /change-requests/{requestId}/approve` |
| 4 | | Kiểm vai trò HR; kiểm yêu cầu còn `PENDING`; kiểm `baseVersion` bằng `version` hiện tại của hồ sơ hoặc dòng (khác thì 409, E19) |
| 5 | | Trong một giao dịch: ghi thay đổi vào hồ sơ hoặc dòng, tăng `version`; file kèm chuyển `READY`; yêu cầu `APPROVED` kèm người duyệt, thời điểm; audit `PROFILE_CHANGE_APPROVE` (mục, mã yêu cầu, tên trường); event outbox báo nhân viên |
| 6 | HR bấm "Từ chối", nhập lý do | `POST /change-requests/{requestId}/reject` với `reason` (bắt buộc, tối đa 500 ký tự); yêu cầu `REJECTED`, hồ sơ không đổi; audit `PROFILE_CHANGE_REJECT` không chứa lý do; file kèm `REJECTED`, xóa sau 30 ngày; event outbox báo nhân viên |
| 7 | Nhân viên nhận email báo chung, mở ứng dụng | Thấy kết quả; nếu bị từ chối thì thấy lý do |

## 5. Luồng thay thế

- **A1 (từ 4.1 bước 1):** người dùng mở hồ sơ của người khác qua danh bạ. Hệ thống trả mức danh bạ, hoặc mức QL nếu người gọi
  là quản lý trực tiếp, hoặc toàn bộ nếu là HR. `sections` chỉ liệt kê mục người gọi được xem.
- **A2 (từ 4.5 bước 3):** client không gửi `version`. Hệ thống từ chối (E9), không ghi đè.
- **A3 (từ 4.4 bước 4):** chức danh là CEO. Cho phép không có quản lý; chỉ được có một CEO đang làm việc.
- **A4 (từ 4.5 bước 3), HR chuyển nhân viên sang `TERMINATED`:** nếu người đó còn cấp dưới đang làm việc, hệ thống từ chối
  (E10) và yêu cầu HR chuyển các cấp dưới sang quản lý khác trước. Đơn nghỉ `SUBMITTED` người đó đang chờ duyệt chuyển sang
  quản lý mới theo BR-05.
- **A5 (từ 4.7 bước 5), HR duyệt yêu cầu đổi tài khoản ngân hàng:** ngoài email báo xử lý, ghi một event outbox để gửi email
  tới email công ty của chủ hồ sơ: "Thông tin tài khoản ngân hàng trên HRHelper vừa thay đổi. Nếu không phải bạn yêu cầu, hãy
  báo HR." Email không chứa số tài khoản (BR-15 áp dụng tương tự).
- **A6 (từ 4.2 bước 4), thân nhân là người phụ thuộc:** bắt buộc mã số thuế hoặc CCCD của người đó và ngày bắt đầu giảm trừ;
  sau khi duyệt, mục "Thông tin thuế TNCN" đếm số người phụ thuộc đang hiệu lực.
- **A7 (từ 4.2 bước 2), gửi lại cùng `Idempotency-Key`:** trả lại yêu cầu đã tạo, không tạo yêu cầu mới, không ghi audit lần hai.
- **A8 (từ 4.3 bước 2), HR tải file lên hồ sơ nhân viên** (hợp đồng, quyết định): file `READY` ngay, có `uploadedBy` là HR;
  nhân viên xem, tải được nhưng không đề xuất xóa được.
- **A9 (từ 4.5), HR sửa trực tiếp:** HR sửa hồ sơ hoặc mục thì ghi thẳng, không qua yêu cầu; nếu trường đó đang có yêu cầu
  `PENDING` của nhân viên thì yêu cầu đó sẽ bị 409 khi duyệt (E19) và HR từ chối hoặc nhân viên gửi lại.
- **A10 (từ 4.7 bước 1), yêu cầu quá hạn:** yêu cầu chờ quá 2 ngày làm việc có nhãn "Quá hạn" và đứng đầu danh sách; không tự
  duyệt, không tự hủy.

## 6. Ngoại lệ

| Mã | Tình huống | Hệ thống phản hồi |
|---|---|---|
| E1 | Nhân viên gửi yêu cầu cho trường hoặc mục không phải NV, cho hồ sơ người khác, hoặc gọi API ghi thẳng (`PATCH /employees/{id}`, API mục, duyệt, từ chối) | 403 `FORBIDDEN`; không tạo yêu cầu |
| E2 | Người không phải HR, không phải chủ hồ sơ gọi `include=sensitive`, hoặc chủ hồ sơ xem CCCD của mình | 403 `FORBIDDEN`; không ghi audit đọc |
| E3 | `version` gửi lên khác bản ghi hiện tại | 409 `CONFLICT`; client tải lại rồi cho người dùng làm lại |
| E4 | Dữ liệu sai định dạng hoặc quá độ dài (mục 8) | 400 `BAD_REQUEST` kèm `fields` để hiện lỗi đúng ô |
| E5 | Thiếu quản lý trực tiếp (không phải CEO), quản lý không tồn tại hoặc tạo vòng quản lý | 400 `BAD_REQUEST` |
| E6 | Mã nhân viên hoặc email đã tồn tại | 409 `CONFLICT` |
| E7 | Hồ sơ, dòng, file không tồn tại, hoặc người gọi không được xem mục đó | 404 `NOT_FOUND`, giống nhau ở hai trường hợp để không lộ sự tồn tại |
| E8 | ADMIN hoặc vai trò khác gọi `POST /employees` | 403 `FORBIDDEN` |
| E9 | Sửa hồ sơ không kèm `version` | 400 `BAD_REQUEST` |
| E10 | Chuyển `TERMINATED` khi còn cấp dưới đang làm việc | 400 `BAD_REQUEST`, nêu số cấp dưới cần chuyển |
| E11 | Thêm dòng vượt số dòng tối đa của mục, hoặc vượt hạn mức file (50 file, 200 MiB) | 409 `CONFLICT`, nêu giới hạn |
| E12 | File sai loại, sai dung lượng, nội dung không khớp đuôi, quá 10 MiB (ảnh đại diện quá 2 MiB) | 400 `BAD_REQUEST`; file `REJECTED`, object bị xóa |
| E13 | Xác nhận file khi chưa PUT lên storage | 400 `BAD_REQUEST`; file vẫn `PENDING` |
| E14 | Nhân viên gửi yêu cầu xóa file do HR tải lên | 403 `FORBIDDEN` |
| E15 | Vượt giới hạn tần suất (mục 7) | 429 `TOO_MANY_REQUESTS` kèm `Retry-After`; không đổi dữ liệu |
| E16 | Body request quá 64 KiB | 413 |
| E17 | Chưa cấu hình `PROFILE_STORAGE_BUCKET` hoặc storage lỗi | 503 cho thao tác file; xem, sửa thông tin vẫn chạy |
| E18 | Hợp đồng mới trùng khoảng ngày với hợp đồng khác | 409 `CONFLICT` |
| E19 | HR duyệt yêu cầu mà hồ sơ hoặc dòng đã đổi sau khi nhân viên gửi (`baseVersion` cũ) | 409 `CONFLICT`; yêu cầu vẫn `PENDING` để HR từ chối hoặc nhân viên gửi lại |
| E20 | Duyệt, từ chối, hủy yêu cầu không còn `PENDING` | 409 `CONFLICT`; duyệt lặp lại cùng yêu cầu đã `APPROVED` thì trả lại yêu cầu, không ghi lần hai |
| E21 | Nhân viên đã có 20 yêu cầu `PENDING` | 409 `CONFLICT`, nêu giới hạn |
| E22 | Từ chối không có lý do hoặc lý do quá 500 ký tự | 400 `BAD_REQUEST` kèm `fields.reason` |

## 7. Quy tắc áp dụng

**Tài liệu:**

- [ADR-08](../../architecture/adr/ADR-08-field-encryption.md): trường nhạy cảm mã hóa AES-256-GCM ở tầng ứng dụng.
- [ADR-09](../../architecture/adr/ADR-09-append-only-audit.md): audit chỉ thêm, ghi cùng giao dịch.
- [ADR-10](../../architecture/adr/ADR-10-manager-role-derived.md): quan hệ quản lý quyết định mức QL.
- [ADR-13](../../architecture/adr/ADR-13-document-storage.md): file đi thẳng lên storage qua presigned URL, tải xuống qua API.
- FR-2.5 (UC2) và issue #22: quy tắc một quản lý trực tiếp, trừ CEO.
- [Ma trận phân quyền – Hồ sơ nhân viên](../../security/access-control-matrix.md#hồ-sơ-nhân-viên).

**Audit (FR-1.11).** Mỗi thao tác ghi đúng một bản ghi, cùng giao dịch với thay đổi:

| Thao tác | Action | Ghi gì |
|---|---|---|
| Nhân viên gửi, hủy yêu cầu | `PROFILE_CHANGE_SUBMIT`, `PROFILE_CHANGE_CANCEL` | Mục, mã yêu cầu, thao tác, tên các trường đề xuất đổi |
| HR duyệt, từ chối yêu cầu | `PROFILE_CHANGE_APPROVE`, `PROFILE_CHANGE_REJECT` | Mục, mã yêu cầu, tên trường đã ghi. Không có lý do từ chối |
| HR tạo, sửa trường chính của hồ sơ | `CREATE`, `UPDATE` | Trường tổ chức (phòng ban, chức danh, quản lý, trạng thái, ngày vào làm): tên, giá trị cũ và mới. Trường cá nhân, nhạy cảm: chỉ tên |
| HR thêm, sửa, xóa dòng trực tiếp | `PROFILE_ITEM_CREATE`, `PROFILE_ITEM_UPDATE`, `PROFILE_ITEM_DELETE` | Mục, mã dòng, tên các trường đã đổi |
| Tải lên, xóa file | `PROFILE_FILE_UPLOAD`, `PROFILE_FILE_DELETE` | Mã file, mục, loại, dung lượng, SHA-256 |
| Tải file của người khác | `PROFILE_FILE_DOWNLOAD` | Mã file, mục. Chủ hồ sơ tự tải file của mình thì không ghi |
| Xem giá trị nhạy cảm | `VIEW_SENSITIVE` | Người xem, hồ sơ bị xem, `traceId` |

Audit, log API, log worker không bao giờ chứa giá trị trường cá nhân, trường nhạy cảm, tên file gốc (tên file có thể chứa
tên người, số CCCD) hay nội dung file.

**Giới hạn tần suất và hạn mức (FR-1.14).** Tính theo từng người dùng (`sub` của token), áp dụng cả với HR:

| Nhóm thao tác | Giới hạn | Vượt thì |
|---|---|---|
| Ghi hồ sơ: gửi, hủy yêu cầu; HR sửa, duyệt, từ chối | 30 lệnh/phút, 300 lệnh/ngày | 429 |
| Yêu cầu `PENDING` mỗi nhân viên | 20 | 409 (E21) |
| Xin URL tải lên | 10 lệnh/giờ, 30 lệnh/ngày; ảnh đại diện 5 lần/ngày | 429 |
| Tải file xuống | 60 file/giờ | 429 |
| Xem trường nhạy cảm (`include=sensitive`) | 100 lần/giờ | 429 và cảnh báo kênh vận hành |
| Mọi API | 100 request/phút (NFR-5.21) | 429 |
| Số file mỗi hồ sơ | 50 file `READY`, tổng 200 MiB | 409 (E11) |
| Kích thước body | 64 KiB | 413 |

Một người nhận 429 quá 20 lần trong 10 phút thì có cảnh báo trên dashboard vận hành. Hạn mức file đếm từ database nên chính
xác; giới hạn tần suất dùng chung cơ chế với NFR-5.21 (nhánh `feat/security-headers-ratelimit`).

**Tệp đính kèm:**

- Chỉ nhận PDF, DOCX, JPG, PNG; kiểm loại theo nội dung, không chỉ theo đuôi (NFR-5.23). Mỗi file tối đa 10 MiB, ảnh đại diện
  tối đa 2 MiB.
- Bucket riêng cho hồ sơ, chặn public, mã hóa khi lưu (SSE-KMS). Khóa object ngẫu nhiên, không chứa tên người hay tên file.
- URL tải lên hết hạn sau 10 phút. Tải xuống luôn qua API, có `Content-Disposition: attachment` và `nosniff`; không xem trước
  DOCX trong trình duyệt.
- File xóa giữ 30 ngày (HR vẫn tải được) rồi lifecycle của bucket xóa object; bản ghi file và audit còn lại.
- Quét mã độc ngoài MVP; ghi vào rủi ro đã chấp nhận vì file chỉ được tải xuống, không chạy trên server.

**Dữ liệu cá nhân (NFR-11):** thông tin thân nhân là dữ liệu của người thứ ba; giao diện nhắc nhân viên chỉ khai khi cần cho
giảm trừ thuế hoặc liên hệ khẩn cấp. Không thu tôn giáo, tiền sử bệnh, nhóm máu.

## 8. Dữ liệu vào

Cột "Nhập" cho biết ai thêm, sửa: **NV** nhân viên đề xuất qua yêu cầu cập nhật, HR duyệt mới ghi (HR cũng sửa thẳng được),
**HR** chỉ HR, **Tự tính** do hệ thống tính.
Cột "Mức" theo ký hiệu ở mục 2. "Tối đa" là số dòng tối đa của mục.

### 8.1 Trường chính của hồ sơ (đã có, trừ ảnh đại diện)

| Trường | Bắt buộc khi tạo | Nhập | Mức | Kiểm tra |
|---|---|---|---|---|
| `employeeCode` | Có | Không sửa | DB | Dạng `E` + 5 chữ số, duy nhất |
| `fullName` | Có | HR | DB | 2–150 ký tự |
| `workEmail` | Có | HR (khi đổi email công ty) | DB | Email hợp lệ, duy nhất, lưu chữ thường; đổi cùng lúc với tài khoản ở identity provider |
| `phone` | Không | NV | DB | 8–20 ký tự số, có thể có `+`, khoảng trắng, `.`, `-` |
| `address` | Không | NV | QL | Tối đa 255 ký tự |
| `dateOfBirth` | Không | HR | QL | Ngày hợp lệ, không ở tương lai |
| `departmentId`, `positionId` | Có | HR | DB | Phải tồn tại |
| `managerId` | Có, trừ CEO | HR | DB | Nhân viên đang làm việc; không tạo vòng |
| `hireDate` | Có | HR (sửa sai sót) | QL | Ngày hợp lệ; dùng tính phép năm theo thâm niên (UC3) |
| `status` | Mặc định `ACTIVE` | HR | QL | `ACTIVE`, `ON_LEAVE`, `TERMINATED` |
| `nationalId` | Không | HR | HR | Đúng 12 chữ số; mã hóa |
| `bankAccount` | Không | NV (luồng 8.4) | NC | 6–20 chữ số; mã hóa |
| `salary` | Không | HR | NC | Số dương; mã hóa. Khi có FR-1.12 thì chuyển thành lịch sử lương (8.5) |
| `avatarFileId` *(chưa có)* | Không | NV | DB | File JPG, PNG ≤ 2 MiB (luồng 4.3) |
| `version` | Có khi sửa | – | – | Bằng `version` hiện tại |

### 8.2 Thông tin cá nhân

| Mục | Trường | Nhập | Mức | Tối đa | Kiểm tra |
|---|---|---|---|---|---|
| Thông tin liên hệ khẩn cấp | Họ tên (bắt buộc), quan hệ (bắt buộc: cha, mẹ, vợ, chồng, con, anh chị em, khác), số điện thoại (bắt buộc), số điện thoại phụ | NV | CN | 3 dòng | Họ tên 2–150 ký tự; điện thoại như `phone` |
| Thân nhân và người phụ thuộc | Họ tên, quan hệ, ngày sinh (bắt buộc); nghề nghiệp; là người phụ thuộc (có/không); nếu có: mã số thuế hoặc CCCD (bắt buộc, mã hóa), từ tháng, đến tháng; file giấy tờ chứng minh | NV | CN | 20 dòng | Ngày sinh không ở tương lai; mã số thuế 10 hoặc 12 số |

### 8.3 Công việc

| Mục | Trường | Nhập | Mức | Kiểm tra |
|---|---|---|---|---|
| Quá trình công tác | Từ ngày, đến ngày, phòng ban, chức danh, quản lý trực tiếp, lý do | Lấy từ quá trình công tác của [UC2 FR-2.8](../UC2-organization/requirements.md) (mỗi lần tuyển mới, điều chuyển là một dòng); HR thêm dòng điều chỉnh có lý do | QL | Dòng HR nhập: ngày không ở tương lai |
| Diện đối tượng (hợp đồng) | Loại (thử việc, học việc, xác định thời hạn, không xác định thời hạn), số hợp đồng, ngày bắt đầu, ngày kết thúc (bỏ trống nếu không xác định thời hạn), file đã ký | HR | CN (đầu trang hiện loại ở mức QL) | Không trùng khoảng ngày (E18); ngày kết thúc sau ngày bắt đầu |
| Ngày nghỉ dài | Loại phép, từ ngày, đến ngày, số ngày | Tự tính từ đơn nghỉ ≥ 14 ngày làm việc đã duyệt hoặc hoàn tất (UC3) và khoảng `ON_LEAVE` | QL | – |
| Các mốc trong công ty | Ngày vào làm, thâm niên, các mốc 5 năm, số ngày phép cộng thêm | Tự tính từ `hireDate` | QL | – |

### 8.4 Tài chính

| Mục | Trường | Nhập | Mức | Kiểm tra |
|---|---|---|---|---|
| Lương mục tiêu | Mức lương, ngày hiệu lực | HR | NC | Số dương; một mức cho mỗi ngày hiệu lực |
| Hệ số lương bảo hiểm | Mức lương đóng BHXH, ngày hiệu lực | HR | NC | Số dương |
| Thông tin tài khoản ngân hàng | Ngân hàng (chọn trong danh sách), chi nhánh, số tài khoản (mã hóa), chủ tài khoản | NV | NC | Chỉ một tài khoản nhận lương; chủ tài khoản viết hoa không dấu, trùng tên nhân viên thì không cảnh báo, khác thì hiện cảnh báo nhưng vẫn cho lưu |
| Thông tin thuế TNCN | Mã số thuế (mặc định là số CCCD, từ 1/7/2025), số người phụ thuộc | Mã số thuế: HR; số người phụ thuộc: tự tính từ 8.2 | NC | – |

### 8.5 Phúc lợi

| Mục | Trường | Nhập | Mức | Kiểm tra |
|---|---|---|---|---|
| Bảo hiểm xã hội | Mã số BHXH, ngày bắt đầu đóng | HR | CN | Mã số BHXH đúng 10 chữ số |
| Bảo hiểm y tế | Số thẻ (HR), nơi khám chữa bệnh ban đầu (NV) | HR, NV | CN | Nơi khám chọn trong danh sách; đổi tối đa một lần mỗi quý |
| Phụ cấp | Loại (ăn trưa, đi lại, điện thoại, trách nhiệm, khác), số tiền mỗi tháng, từ ngày, đến ngày | HR | NC | Số dương |

### 8.6 Khác

| Mục | Trường | Nhập | Mức | Tối đa | Kiểm tra |
|---|---|---|---|---|---|
| Khen thưởng kỷ luật | Loại (khen thưởng, kỷ luật), hình thức, số quyết định, ngày, lý do ngắn, file quyết định | HR | CN | – | Lý do tối đa 500 ký tự |
| Chuyên môn | Trình độ (trung cấp, cao đẳng, đại học, thạc sĩ, tiến sĩ, khác), chuyên ngành, trường hoặc nơi cấp, năm tốt nghiệp; chứng chỉ: tên, nơi cấp, ngày cấp, ngày hết hạn; file bằng | NV | QL (file: CN) | 30 dòng | Năm từ 1950 đến năm hiện tại; ngày hết hạn sau ngày cấp |
| Sơ yếu lý lịch | File CV hoặc sơ yếu lý lịch; bản mới nhất hiện đầu | NV | CN | 5 file | Như mục 7, tệp đính kèm |
| Lịch sử thay đổi | Nhật ký thao tác (luồng 4.6) | Tự tính từ audit | CN | – | – |

Mọi trường văn bản tự do tối đa 255 ký tự nếu không ghi khác. Mọi dòng có `createdBy`, `updatedBy`, `version`, và nếu ghi từ
yêu cầu thì `changeRequestId` (biết ai đề xuất, HR nào duyệt).

## 9. Giao diện và API

| Luồng | Màn hình | API |
|---|---|---|
| 4.1, 9.1 | Popup hồ sơ: `/me/profile` (của mình), `/employees/:id` (người khác), mở từ trang chủ, ô tìm kiếm, danh bạ | `GET /me` (chỉ tài khoản, vai trò, `employeeId`), `GET /employees/{id}/summary` |
| 4.1 bước 2a | Trang con trong popup `/employees/:id/:section` | `GET /employees/{id}/profile/{section}` (mục `personal` trả ngày sinh, địa chỉ, ngày vào làm, trạng thái; HR thêm CCCD đã che) |
| 4.2 | Trang con của mục, khung "Đang chờ HR xác nhận" | `GET /employees/{id}/profile/{section}`; `POST /employees/{id}/change-requests`; `DELETE /employees/{id}/change-requests/{requestId}` (hủy) |
| 4.7 | Trang "Việc cần duyệt" ([giao diện chung mục 2.4](../frontend.md#24-trang-việc-cần-duyệt-approvals)), tab Sửa hồ sơ, File hồ sơ, Ảnh đại diện: `/approvals?type=profile\|profile-file\|avatar`, `/approvals/{type}/:id` (so sánh cũ, mới) | `GET /change-requests`, `GET /change-requests/{requestId}`, `POST …/approve`, `POST …/reject` |
| 4.5, A9 | Trang con mục, chế độ HR | `POST /employees/{id}/profile/{section}`, `PATCH`, `DELETE …/{itemId}` (chỉ HR, ghi thẳng) |
| 4.3 | Nút "Tải lên" trong trang con | `POST /employees/{id}/files`, `POST /employees/{id}/files/{fileId}/confirm`, `GET /employees/{id}/files/{fileId}/download`, `DELETE /employees/{id}/files/{fileId}` |
| 4.4 | `/employees/new` | `POST /employees`, `GET /departments`, `GET /positions`, `GET /employees` |
| 4.5 | `/employees/:id/edit`; trang con mục HR quản lý | `GET /employees/{id}?include=sensitive`, `PATCH /employees/{id}`; API mục như 4.2 |
| 4.6 | `/employees/:id/history` | `GET /employees/{id}/history` |

Mã `{section}`: `emergency-contacts`, `relatives`, `career-history`, `contracts`, `long-leaves`, `milestones`, `salary`,
`insurance-salary`, `bank-account`, `tax`, `social-insurance`, `health-insurance`, `allowances`, `rewards-discipline`,
`qualifications`, `cv`.

### 9.1 Bố cục trang hồ sơ

Hồ sơ (của mình và của người khác) mở trong **popup hồ sơ** theo [giao diện chung mục 4](../frontend.md#4-popup-hồ-sơ):
ngăn bên phải rộng 720 px trên màn hình rộng, toàn màn hình trên điện thoại, có URL riêng (`/me/profile`, `/employees/{id}`,
mục con `/employees/{id}/{section}`); mục con mở bên trong popup. Bố cục bên trong theo mẫu ứng dụng HR di động, một cột.
Người xem chỉ thấy nhóm và mục mức xem của mình cho phép (cột "Mức", ký hiệu ở mục 2); mục không được xem thì không hiện.
Bản vẽ: [giao diện chung mục 10](../frontend.md#10-bản-vẽ-giao-diện) (hồ sơ desktop, điện thoại, trang con, người khác xem,
HR duyệt yêu cầu).

**Quy ước màu:**

- **Màu chủ đạo cyan** cho toàn ứng dụng, thay màu xanh dương `#2457C5`: `--primary: #0E7490` (cyan-700) cho nút, link, tiêu
  đề nhóm, biểu tượng, đủ tương phản với chữ trắng (WCAG AA). Nền đầu trang dải chuyển `#ECFEFF` → `#CFFAFE`, điểm nhấn
  `#06B6D4`.
- **Mục chưa làm có tiêu đề đỏ** `#DC2626` kèm nhãn "Chưa có"; bấm vào mở trang "Chức năng đang phát triển", không gọi API.
  Trạng thái từng mục lấy từ `GET /employees/{id}/sections` (`available: true|false`); làm xong mục nào thì đổi cờ của mục đó ở
  backend, giao diện tự đổi màu.
- **Tải theo nhu cầu:** trang mặc định chỉ gọi `GET /employees/{id}/summary`. Dữ liệu của mỗi mục chỉ được lấy khi người dùng
  bấm vào mục đó; giá trị nhạy cảm chỉ được lấy khi bấm mắt. Không gọi trước, không tải sẵn các mục chưa mở, để không kéo
  dữ liệu thừa và để mỗi lượt đọc dữ liệu cá nhân gắn với một thao tác thật của người dùng.
- Giá trị nhạy cảm hiện `********` kèm biểu tượng mắt; bấm mắt mới gọi API và ghi audit.
- Mục có yêu cầu đang chờ có nhãn "Chờ HR xác nhận"; trong trang con, giá trị đề xuất hiện trong khung riêng dưới giá trị hiện
  tại. Yêu cầu bị từ chối hiện lý do cho tới khi nhân viên đóng.
- HR duyệt yêu cầu ở trang "Việc cần duyệt" chung (ô ở trang chủ và chuông có số yêu cầu đang chờ), không có trang duyệt
  riêng của UC1.

**Đầu trang:**

| Thành phần | Nội dung | Mức | Trạng thái |
|---|---|---|---|
| Ảnh đại diện | Ảnh nhân viên tải lên; chưa có thì hiện chữ cái đầu của tên | DB | **Chưa có** |
| Mã nhân viên | Nhãn nền cyan dưới ảnh | DB | Đã có |
| Họ tên, chức danh | | DB | Đã có |
| Thẻ "Quản lý trực tiếp" | Ảnh, tên quản lý trực tiếp, bấm mở hồ sơ người đó | DB | Đã có (ảnh: chưa có) |
| Thẻ "Xem sơ đồ tổ chức" | Tên phòng ban, bấm mở `/org` tại phòng ban đó | DB | Đã có |
| Hàng "Lương mục tiêu" | `********` + mắt | NC | HR: đã có. Chủ hồ sơ: **chưa có** |
| Hàng "Hệ số lương bảo hiểm" | `********` + mắt | NC | **Chưa có** |
| Hàng "Diện đối tượng" | Loại hợp đồng đang hiệu lực | QL | **Chưa có** |

**Các nhóm** (mỗi mục là một hàng có biểu tượng và mũi tên, bấm mở trang con; dữ liệu từng mục ở mục 8):

| Nhóm | Mục | Nhập | Mức | Trạng thái |
|---|---|---|---|---|
| Thông tin cá nhân | Thông tin cá nhân (8.1) | NV sửa điện thoại, địa chỉ; HR phần còn lại | QL (điện thoại, email: DB; CCCD: HR) | Đã có |
| | Thông tin liên hệ khẩn cấp | NV | CN | **Chưa có** |
| | Thân nhân và người phụ thuộc | NV | CN | **Chưa có** |
| Công việc | Quá trình công tác | Tự tính (UC2 FR-2.8), HR | QL | **Chưa có** |
| | Diện đối tượng | HR | CN | **Chưa có** |
| | Ngày nghỉ dài | Tự tính | QL | **Chưa có** |
| | Các mốc trong công ty | Tự tính | QL | Ngày vào làm: đã có. Thâm niên, mốc: **chưa có** |
| Tài chính | Lương mục tiêu | HR | NC | HR: đã có một mức. Chủ hồ sơ xem, lịch sử: **chưa có** |
| | Hệ số lương bảo hiểm | HR | NC | **Chưa có** |
| | Thông tin tài khoản ngân hàng | NV | NC | Số tài khoản (HR nhập): đã có. NV tự khai, ngân hàng, chủ tài khoản: **chưa có** |
| | Thông tin thuế TNCN | HR, tự tính | NC | **Chưa có** |
| Phúc lợi | Bảo hiểm xã hội | HR | CN | **Chưa có** |
| | Bảo hiểm y tế | HR, NV | CN | **Chưa có** |
| | Phụ cấp | HR | NC | **Chưa có** |
| Khác | Khen thưởng kỷ luật | HR | CN | **Chưa có** |
| | Chuyên môn | NV | QL | **Chưa có** |
| | Sơ yếu lý lịch | NV | CN | **Chưa có** |
| | Lịch sử thay đổi (thêm so với ảnh mẫu) | Tự tính | CN | **Chưa có** |

**Theo người xem:**

- Mức danh bạ (người không phải HR, không phải quản lý trực tiếp): chỉ đầu trang (ảnh, mã, họ tên, chức danh, quản lý trực
  tiếp, sơ đồ tổ chức) cộng số điện thoại và email công ty, hiện ngay dưới đầu trang. Không có địa chỉ, ngày sinh; không có các
  hàng lương, hệ số, diện đối tượng và các nhóm bên dưới.
- Quản lý trực tiếp: thêm các mục mức QL.
- Chủ hồ sơ: mọi mục của mình; nút "Sửa", "Thêm", "Tải lên" ở mục NV đều kết thúc bằng "Gửi yêu cầu".
- HR: mọi mục, nút "Sửa hồ sơ", "Thêm" ở mọi mục (ghi thẳng), "Hiện dòng đã xóa"; danh sách yêu cầu chờ của hồ sơ đó.
- Số dư phép không nằm trên trang hồ sơ; xem ở trang "Đơn nghỉ" (UC3).

## 10. Yêu cầu phi chức năng liên quan

- NFR-1.1: xem hồ sơ (`summary`, từng mục) p95 < 300 ms. Response `summary` dưới 4 KB, không chứa trường của mục chưa mở.
- NFR-1.2: sửa hồ sơ, thêm dòng p95 < 500 ms. Tải file không tính vì đi thẳng lên storage.
- NFR-5.13: phân quyền theo dữ liệu, từng mục. NFR-5.17: mã hóa trường nhạy cảm. NFR-5.18: không lộ giá trị nhạy cảm, tên file
  gốc qua log, audit.
- NFR-5.21: giới hạn tần suất (mục 7). NFR-5.23: kiểm loại file theo nội dung.
- NFR-6.1: 100% thao tác ghi, lượt đọc trường nhạy cảm, lượt tải file của người khác có audit.
- NFR-11.1, NFR-11.2: chỉ thu dữ liệu cần thiết; thông tin thân nhân có mục đích rõ.

## 11. Kiểm thử

Chiến lược, test đã có, bảng phủ tiêu chí và ca còn thiếu: [test.md](test.md). Cách triển khai: [deploy.md](deploy.md).

## 12. Hiện trạng và việc còn lại

| Nội dung | Trạng thái | Việc còn lại |
|---|---|---|
| Xem theo mức, tự sửa liên hệ, HR xem trường nhạy cảm, audit | Đã có | – |
| HR tạo, sửa hồ sơ trên giao diện | Đã có (PR #63) | TV2 cập nhật trạng thái FR-1.4, FR-1.5 trong SRS |
| `version` bắt buộc khi sửa (E9) | Code chưa đúng: chỉ so khi client gửi | TV1, `fix/employee-org-integrity` |
| Chặn chuyển `TERMINATED` khi còn cấp dưới (A4, E10) | Code chưa có | TV2 xác nhận, TV1 làm |
| Người `TERMINATED` không dùng được hệ thống | Code chưa có | TV1; TV3 thêm bước khóa tài khoản Cognito vào quy trình nghỉ việc |
| HR sửa `hireDate`, `workEmail` | Code chưa có | TV1 |
| Audit theo nhóm trường (mục 7) | Code chưa đúng: ghi giá trị mới của mọi trường thường, không ghi giá trị cũ | TV1 |
| Sửa chỉ trường nhạy cảm tăng `version` | Code chưa đúng | TV1 |
| Chỉ tải trường nhạy cảm khi bấm mắt | Code chưa đúng: form sửa tự tải | TV1 |
| Trang hồ sơ theo nhóm, màu cyan, mục chưa có tiêu đề đỏ (9.1) | Chưa có: trang hiện là các thẻ rời, màu xanh dương | TV1, `feat/profile-layout` |
| Tải theo nhu cầu: `summary` cho trang mặc định, API riêng cho từng mục | Code chưa đúng: `GET /me` và `GET /employees/{id}` trả mọi trường cá nhân ngay khi mở trang; trang "Hồ sơ của tôi" còn tải số dư phép | TV1, `feat/profile-layout` |
| Chủ hồ sơ tự xem lương, số tài khoản | Chưa có | TV1, `feat/profile-layout` |
| Giới hạn tần suất, hạn mức (mục 7) | Chưa có: chưa có rate limit nào | TV1, `feat/security-headers-ratelimit` |
| Nhân viên sửa điện thoại, địa chỉ qua yêu cầu (AC-1.2.1) | Code chưa đúng: đang lưu thẳng | TV1, `feat/profile-self-service` |
| Yêu cầu cập nhật, màn hình duyệt của HR, nhật ký thay đổi (FR-1.9, FR-1.11) | Chưa có | TV1, `feat/profile-self-service` |
| Tệp đính kèm, ảnh đại diện (FR-1.10) | Chưa có | TV1 `feat/profile-files`; TV3 `infra/profile-files` |
| Mục HR quản lý, thông tin tự tính (FR-1.12, FR-1.13) | Chưa có | Sau MVP; mục vẫn hiện với tiêu đề đỏ |
| Quét mã độc file tải lên | Không làm trong MVP | Rủi ro chấp nhận, mục 7 |

## 13. Thiết kế đề xuất

### 13.1 Dữ liệu

Các mục có cấu trúc khác nhau nhưng cùng cách xử lý (thêm, sửa, xóa mềm, `version`, audit, quyền theo mục). Dùng **một bảng
chung cho các dòng** thay vì một bảng cho mỗi mục, để thêm mục mới không cần migration:

| Bảng | Cột chính |
|---|---|
| `employee.profile_item` | `id`, `employee_id`, `section` (mã ở mục 9), `data` jsonb (trường thường), `sensitive_data` bytea (trường nhạy cảm của dòng, mã hóa AES-256-GCM như ADR-08), `created_by`, `updated_by`, `change_request_id` (nullable), `version`, `created_at`, `updated_at`, `deleted_at` |
| `employee.profile_file` | `id`, `employee_id`, `section`, `item_id` (nullable), `storage_key`, `original_name` (chỉ để hiện cho người có quyền, không vào log), `content_type`, `size_bytes`, `sha256`, `status` (`PENDING`, `PENDING_REVIEW`, `READY`, `REJECTED`, `DELETED`), `uploaded_by`, `change_request_id` (nullable), `created_at`, `deleted_at` |
| `employee.profile_change_request` | `id`, `employee_id`, `section`, `action` (`CREATE`, `UPDATE`, `DELETE`), `item_id` (nullable; `NULL` với trường chính), `base_version`, `proposed` jsonb, `proposed_sensitive` bytea (mã hóa), `file_ids` uuid[], `status` (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`), `submitted_by`, `submitted_at`, `reviewed_by`, `reviewed_at`, `reject_reason` (chỉ hiện cho chủ hồ sơ và HR, không vào audit), `idempotency_key` |
| `employee.employee` | Thêm `avatar_file_id` |

- Unique `(employee_id, section, coalesce(item_id, …)) WHERE status = 'PENDING'` trên `profile_change_request` để mỗi chỗ chỉ có
  một yêu cầu đang chờ (AC-1.9.7); index `(status, submitted_at)` cho danh sách của HR.
- Duyệt yêu cầu dùng cùng hàm ghi với HR sửa trực tiếp, để quy tắc kiểm dữ liệu, mã hóa, `version` chỉ viết một lần.
- Index `(employee_id, section) WHERE deleted_at IS NULL` cho đọc từng mục; unique `(employee_id, section, sha256) WHERE status
  = 'READY'` cho AC-1.10.4.
- Kiểm dữ liệu của `data` bằng schema theo từng mục trong code (một file mô tả mục: trường, kiểu, bắt buộc, độ dài, ai nhập,
  mức xem, số dòng tối đa). Cùng file đó sinh danh sách `sections` và cờ `available` cho giao diện.
- Đánh đổi: database không ràng buộc được từng trường của `data`; bù bằng kiểm ở API và test cho từng mục. Hợp đồng cần kiểm
  trùng khoảng ngày (E18) thì kiểm trong giao dịch với khóa theo `employee_id`.

### 13.2 Quyền

Một hàm `canAccess(viewer, employee, section, action)` đọc mức xem và cột "Nhập" từ file mô tả mục, dùng chung cho API mục,
API file và danh sách `sections`. Không được xem thì trả 404 (E7).

### 13.3 File

Dùng lại cách làm của UC5 (ADR-13): presigned PUT 10 phút, xác nhận, kiểm theo nội dung, stream khi tải. Bucket riêng
`hr-profile-files-{env}` vì quyền đọc và thời hạn giữ khác bucket tài liệu chính sách. Lifecycle rule xóa object có tag
`deleted=true` sau 30 ngày.

### 13.4 Giới hạn tần suất

Dùng chung cơ chế với NFR-5.21: guard NestJS đọc nhóm giới hạn từ decorator trên từng endpoint (`@RateLimit('profile-write')`).
Đếm trong bộ nhớ từng instance là đủ cho giới hạn phút; giới hạn ngày và hạn mức file đếm trong PostgreSQL để đúng khi App
Runner chạy nhiều instance (ADR-07: không dùng Redis).
