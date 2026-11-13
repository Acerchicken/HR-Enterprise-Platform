# UC1 – Hồ sơ nhân viên

| Mục | Nội dung |
|---|---|
| Mục tiêu kinh doanh | MT-1 (hồ sơ tập trung), MT-3 (kiểm soát dữ liệu nhạy cảm) |
| Tác nhân chính | Nhân viên (xem, tự sửa liên hệ); HR (tạo, sửa mọi trường, xem trường nhạy cảm) |
| Tác nhân phụ, hệ thống ngoài | Quản lý trực tiếp (xem thông tin cá nhân của cấp dưới); identity provider (đăng nhập) |
| Yêu cầu (SRS) | FR-1.1 → FR-1.6 |
| Quy tắc | ADR-08 (mã hóa trường nhạy cảm), ADR-09 (audit), ADR-10 (MANAGER suy ra từ tổ chức), [ma trận phân quyền – Hồ sơ nhân viên](../../security/access-control-matrix.md#hồ-sơ-nhân-viên) |
| Mức ưu tiên | M (FR-1.6 là S) |
| Trạng thái | Đã có API và giao diện (giao diện HR tạo, sửa hồ sơ merge 12/11, PR #63) |
| Phiên bản | 1.0 – 13/11/2026 |

## 1. Mô tả ngắn

Mỗi nhân viên có một hồ sơ duy nhất trên hệ thống thay cho các file Excel. Ai được xem gì phụ thuộc quan hệ với chủ hồ sơ:
- Người khác chỉ thấy thông tin danh bạ.
- Chủ hồ sơ và quản lý trực tiếp thấy thêm thông tin cá nhân.
- HR thấy toàn bộ, kể cả CCCD, số tài khoản và lương. Mỗi lần HR xem các trường này đều ghi audit.

Nhân viên tự sửa số điện thoại, địa chỉ của mình. HR tạo hồ sơ mới và sửa mọi trường.

## 2. Tác nhân và quyền

| Tác nhân | Được làm gì | Giới hạn theo dữ liệu |
|---|---|---|
| Nhân viên (mọi vai trò có hồ sơ) | Xem hồ sơ mình ở mức cá nhân; sửa `phone`, `address` của mình | Không sửa trường khác; không xem trường nhạy cảm, kể cả của mình |
| Quản lý trực tiếp | Xem thông tin cá nhân của cấp dưới trực tiếp | Không sửa hồ sơ cấp dưới; không xem trường nhạy cảm |
| HR | Tạo hồ sơ; sửa mọi trường; xem trường nhạy cảm khi yêu cầu rõ (`include=sensitive`) | Mỗi lượt xem trường nhạy cảm ghi audit `VIEW_SENSITIVE` |
| ADMIN | Như nhân viên đối với hồ sơ của chính mình | Hồ sơ người khác chỉ ở mức danh bạ; không tạo hồ sơ; không xem trường nhạy cảm |

**Ba mức xem hồ sơ (FR-1.1):**

| Mức | Ai thấy | Trường |
|---|---|---|
| Danh bạ | Mọi người đã đăng nhập | Mã, họ tên, email công ty, điện thoại, phòng ban, chức danh, quản lý trực tiếp |
| Cá nhân | Chủ hồ sơ, quản lý trực tiếp | Thêm ngày sinh, địa chỉ, ngày vào làm, trạng thái |
| Đầy đủ | HR | Thêm CCCD, số tài khoản, lương khi gọi `include=sensitive` |

## 3. Điều kiện

- **Điều kiện trước:** người dùng đã đăng nhập. Tài khoản đã liên kết với hồ sơ qua email công ty; nếu chưa liên kết, `GET /me`
  trả `employee: null` và người dùng không có quyền nào của chủ hồ sơ.
- **Kích hoạt:**
  - Mở trang "Hồ sơ của tôi".
  - Mở hồ sơ một người từ danh bạ hoặc sơ đồ tổ chức.
  - HR bấm "Thêm nhân viên" hoặc "Sửa".
- **Điều kiện sau khi thành công:**
  - Hồ sơ được lưu, `version` tăng 1 sau **mọi** lần sửa thành công, kể cả khi chỉ đổi trường nhạy cảm.
  - Trường nhạy cảm được mã hóa trước khi lưu.
  - Có audit `CREATE` hoặc `UPDATE`, ghi theo ba nhóm trường:
    - trường tổ chức (phòng ban, chức danh, quản lý trực tiếp, trạng thái, ngày vào làm): tên trường, giá trị cũ và mới, để
      tra được lịch sử điều chuyển;
    - trường cá nhân (họ tên, điện thoại, địa chỉ, ngày sinh): chỉ tên trường, vì ADMIN đọc được audit nhưng không được xem
      thông tin cá nhân của người khác;
    - trường nhạy cảm (CCCD, số tài khoản, lương): chỉ tên trường.
  - HR xem trường nhạy cảm sinh audit `VIEW_SENSITIVE`.
- **Điều kiện sau khi thất bại:** hồ sơ và `version` giữ nguyên, không có audit.
- **Nghỉ việc:** khi hồ sơ chuyển `TERMINATED`, người đó không dùng được hệ thống nữa: HR khóa tài khoản ở identity provider
  trong ngày, và API từ chối mọi request của tài khoản gắn với hồ sơ `TERMINATED` (kể cả khi token cũ còn hạn).

## 4. Luồng chính

### 4.1 Nhân viên xem và tự sửa liên hệ (FR-1.1, FR-1.2, FR-1.6)

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Nhân viên mở trang "Hồ sơ của tôi" | Gọi `GET /me`, trả tài khoản, vai trò và hồ sơ liên kết ở mức cá nhân (không có trường nhạy cảm) |
| 2 | Bấm sửa, nhập số điện thoại hoặc địa chỉ mới, bấm Lưu | Gửi `PATCH /employees/{id}` kèm `version` đang hiển thị |
| 3 | | Kiểm người gọi là chủ hồ sơ và chỉ gửi `phone`, `address` |
| 4 | | Kiểm `version` khớp bản ghi hiện tại |
| 5 | | Lưu, tăng `version`, ghi audit `UPDATE` (tên trường đã đổi) trong cùng giao dịch |
| 6 | Thấy hồ sơ đã cập nhật | Trả hồ sơ mới |

### 4.2 HR tạo hồ sơ nhân viên (FR-1.5)

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | HR bấm "Thêm nhân viên" | Hiện form; nạp danh sách phòng ban, chức danh, nhân viên để chọn quản lý |
| 2 | HR nhập thông tin (mục 8) và bấm Lưu | Gửi `POST /employees` |
| 3 | | Kiểm dữ liệu: mã `E` + 5 số, email hợp lệ, phòng ban và chức danh tồn tại |
| 4 | | Kiểm quy tắc quản lý (FR-2.5): có đúng một quản lý trực tiếp đang làm việc, trừ CEO; không tạo vòng quản lý |
| 5 | | Mã hóa CCCD, số tài khoản, lương nếu có |
| 6 | | Lưu hồ sơ, ghi audit `CREATE` trong cùng giao dịch |
| 7 | HR được chuyển tới trang hồ sơ vừa tạo | Trả hồ sơ, mã 201 |

### 4.3 HR xem và sửa trường nhạy cảm (FR-1.3, FR-1.4)

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | HR mở hồ sơ và bấm "Hiện thông tin nhạy cảm" | Gọi `GET /employees/{id}?include=sensitive`. Chỉ gọi khi HR bấm; mở hồ sơ hay mở form sửa không tự tải giá trị nhạy cảm, để audit `VIEW_SENSITIVE` phản ánh đúng lần HR thật sự cần xem |
| 2 | | Kiểm vai trò HR; giải mã CCCD, số tài khoản, lương; ghi audit `VIEW_SENSITIVE` |
| 3 | HR bấm Sửa, đổi trường bất kỳ, bấm Lưu. Trường nhạy cảm để trống nghĩa là giữ nguyên; muốn đổi thì nhập giá trị mới | Gửi `PATCH /employees/{id}` kèm `version`, chỉ gửi trường đã đổi |
| 4 | | Kiểm `version`, kiểm quy tắc quản lý nếu đổi `managerId`, mã hóa trường nhạy cảm |
| 5 | | Lưu, tăng `version`, ghi audit `UPDATE` theo ba nhóm trường ở mục 3 |
| 6 | HR thấy hồ sơ đã cập nhật | Trả hồ sơ mới |

## 5. Luồng thay thế

- **A1 (từ 4.1 bước 1):** người dùng mở hồ sơ của người khác qua danh bạ. Hệ thống trả mức danh bạ, hoặc mức cá nhân nếu
  người gọi là quản lý trực tiếp của người đó.
- **A2 (từ 4.1 bước 2):** client không gửi `version`. Hệ thống từ chối (E9), không ghi đè.
- **A3 (từ 4.2 bước 4):** chức danh là CEO. Cho phép không có quản lý; chỉ được có một CEO đang làm việc.
- **A4 (từ 4.3 bước 3), HR chuyển nhân viên sang `TERMINATED`:** nếu người đó còn cấp dưới đang làm việc, hệ thống từ chối
  (E10) và yêu cầu HR chuyển các cấp dưới sang quản lý khác trước. Đơn nghỉ `SUBMITTED` người đó đang chờ duyệt sẽ chuyển sang
  quản lý mới theo BR-05.

## 6. Ngoại lệ

| Mã | Tình huống | Hệ thống phản hồi |
|---|---|---|
| E1 | Nhân viên sửa trường không phải `phone`, `address`, hoặc sửa hồ sơ người khác | 403 `FORBIDDEN`; hồ sơ không đổi |
| E2 | Vai trò không phải HR gọi `include=sensitive` hoặc sửa trường nhạy cảm | 403 `FORBIDDEN`; không ghi audit đọc |
| E3 | `version` gửi lên khác bản ghi hiện tại (người khác vừa sửa) | 409 `CONFLICT`; client tải lại rồi cho người dùng làm lại |
| E4 | Dữ liệu sai định dạng: mã nhân viên, email, CCCD không đủ 12 số, điện thoại sai mẫu | 400 `BAD_REQUEST` kèm `fields` để hiện lỗi đúng ô |
| E5 | Thiếu quản lý trực tiếp (không phải CEO), quản lý không tồn tại hoặc tạo vòng quản lý | 400 `BAD_REQUEST` |
| E6 | Mã nhân viên hoặc email đã tồn tại | 409 `CONFLICT` |
| E7 | Hồ sơ không tồn tại | 404 `NOT_FOUND` |
| E8 | ADMIN hoặc vai trò khác gọi `POST /employees` | 403 `FORBIDDEN` |
| E9 | Sửa hồ sơ không kèm `version` | 400 `BAD_REQUEST` |
| E10 | Chuyển `TERMINATED` khi còn cấp dưới đang làm việc | 400 `BAD_REQUEST`, nêu số cấp dưới cần chuyển |

## 7. Quy tắc áp dụng

- [ADR-08](../../architecture/adr/ADR-08-field-encryption.md): trường nhạy cảm mã hóa AES-256-GCM ở tầng ứng dụng.
- [ADR-09](../../architecture/adr/ADR-09-append-only-audit.md): audit chỉ thêm, ghi cùng giao dịch.
- [ADR-10](../../architecture/adr/ADR-10-manager-role-derived.md): quan hệ quản lý quyết định mức xem cá nhân.
- FR-2.5 (UC2) và issue #22: quy tắc một quản lý trực tiếp, trừ CEO.
- [Ma trận phân quyền – Hồ sơ nhân viên](../../security/access-control-matrix.md#hồ-sơ-nhân-viên).

## 8. Dữ liệu vào

| Trường | Bắt buộc khi tạo | Ai sửa | Kiểm tra |
|---|---|---|---|
| `employeeCode` | Có | Không sửa | Dạng `E` + 5 chữ số, duy nhất |
| `fullName` | Có | HR | 2–150 ký tự |
| `workEmail` | Có | HR (khi đổi email công ty) | Email hợp lệ, duy nhất, lưu chữ thường; dùng để liên kết tài khoản đăng nhập, nên đổi cùng lúc với tài khoản ở identity provider |
| `phone` | Không | Chủ hồ sơ, HR | 8–20 ký tự số, có thể có `+`, khoảng trắng, `.`, `-` |
| `address` | Không | Chủ hồ sơ, HR | Tối đa 255 ký tự |
| `dateOfBirth` | Không | HR | Ngày hợp lệ |
| `departmentId`, `positionId` | Có | HR | Phải tồn tại |
| `managerId` | Có, trừ CEO | HR | Nhân viên đang làm việc; không tạo vòng |
| `hireDate` | Có | HR (sửa sai sót nhập liệu) | Ngày hợp lệ; dùng để tính phép năm theo thâm niên (UC3) |
| `status` | Mặc định `ACTIVE` | HR | `ACTIVE`, `ON_LEAVE`, `TERMINATED` |
| `nationalId` | Không | HR | Đúng 12 chữ số; mã hóa khi lưu |
| `bankAccount` | Không | HR | 6–20 chữ số; mã hóa khi lưu |
| `salary` | Không | HR | Chuỗi số; mã hóa khi lưu |
| `version` | Có khi sửa | – | Bằng `version` hiện tại của hồ sơ |

## 9. Giao diện và API

| Luồng | Màn hình | API |
|---|---|---|
| 4.1 | `/` (Hồ sơ của tôi) | `GET /me`, `PATCH /employees/{id}` |
| A1 | `/employees/:id` | `GET /employees/{id}` |
| 4.2 | `/employees/new` | `POST /employees`, `GET /departments`, `GET /positions`, `GET /employees` |
| 4.3 | `/employees/:id`, `/employees/:id/edit` | `GET /employees/{id}?include=sensitive`, `PATCH /employees/{id}` |

## 10. Yêu cầu phi chức năng liên quan

- NFR-1.1: xem hồ sơ p95 < 300 ms. NFR-1.2: sửa hồ sơ p95 < 500 ms.
- NFR-5.13: phân quyền theo dữ liệu. NFR-5.17: mã hóa trường nhạy cảm. NFR-5.18: không lộ giá trị nhạy cảm qua log, audit.
- NFR-6.1: 100% lượt sửa và lượt đọc trường nhạy cảm có audit.
- NFR-11.2: chỉ thu dữ liệu cần thiết.

## 11. Kiểm thử

Chiến lược, test đã có, bảng phủ tiêu chí và ca còn thiếu: [test.md](test.md). Cách triển khai: [deploy.md](deploy.md).

## 12. Hiện trạng và việc còn lại

| Nội dung | Trạng thái | Việc còn lại |
|---|---|---|
| Ba mức xem, tự sửa liên hệ, trường nhạy cảm, audit | Đã có | – |
| HR tạo, sửa hồ sơ trên giao diện | Đã có (PR #63) | TV2 cập nhật trạng thái FR-1.4, FR-1.5 trong SRS |
| `version` bắt buộc khi sửa (E9) | Code chưa đúng: chỉ so khi client gửi | TV1, `fix/employee-org-integrity` |
| Chặn chuyển `TERMINATED` khi còn cấp dưới (A4, E10) | Code chưa có | TV2 xác nhận quy tắc, TV1 làm |
| Người `TERMINATED` không dùng được hệ thống | Code chưa có: API không kiểm trạng thái hồ sơ khi xác thực | TV1; TV3 thêm bước khóa tài khoản Cognito vào quy trình nghỉ việc |
| HR sửa `hireDate`, `workEmail` | Code chưa có: API không nhận hai trường này | TV1 |
| Audit theo ba nhóm trường (mục 3) | Code chưa đúng: ghi giá trị mới của mọi trường thường, kể cả địa chỉ, ngày sinh; không ghi giá trị cũ | TV1 |
| Sửa chỉ trường nhạy cảm tăng `version` | Code chưa đúng: không tăng | TV1 |
| Chỉ tải trường nhạy cảm khi HR bấm hiện | Code chưa đúng: form sửa tự tải, mỗi lần mở sinh `VIEW_SENSITIVE` | TV1 |
