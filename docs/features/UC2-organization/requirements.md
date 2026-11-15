# UC2 – Thông tin tổ chức: yêu cầu và tiêu chí chấp nhận

> Đọc file này trước khi mở nhánh làm UC2. Luồng chi tiết: [spec.md](spec.md). Nguồn FR: [SRS mục 4.2](../../requirements/SRS.md#42-uc2--thông-tin-tổ-chức-fr-2x).
> Mỗi tiêu chí `AC-x.y.z` là một ca kiểm thử. PR làm chức năng ghi mã AC đã làm trong mô tả PR.

## 1. User story

| Mã | Là | Tôi muốn | Để | FR |
|---|---|---|---|---|
| US-2.1 | Nhân viên | Tìm đồng nghiệp theo tên, email, mã, lọc theo phòng ban | Liên lạc đúng người | FR-2.1 |
| US-2.2 | Nhân viên | Xem cây tổ chức và thành viên từng phòng ban | Hiểu công ty tổ chức thế nào | FR-2.2 |
| US-2.3 | Nhân viên | Xem quản lý trực tiếp và cấp dưới của một người | Biết ai duyệt việc của ai | FR-2.3 |
| US-2.4 | HR, ADMIN | Tạo, sửa phòng ban | Cây tổ chức luôn đúng thực tế | FR-2.4 |
| US-2.5 | HR | Mỗi nhân viên có đúng một quản lý trực tiếp, trừ CEO | Đơn nghỉ luôn có người duyệt | FR-2.5 |
| US-2.6 | HR | Quản lý danh mục chức danh và cấp bậc | Chức danh thống nhất, không gõ tự do mỗi người một kiểu | FR-2.6 |
| US-2.7 | HR | Điều chuyển nhân viên sang phòng ban, chức danh, quản lý mới từ một ngày hiệu lực | Đổi đúng ngày, không phải nhớ để sửa tay | FR-2.7 |
| US-2.8 | Nhân viên, quản lý, HR | Xem quá trình công tác: ở phòng nào, chức danh gì, ai quản lý, từ ngày nào | Hồ sơ có lịch sử thật (UC1 mục "Quá trình công tác") | FR-2.8 |
| US-2.9 | HR, nhân viên | Biết trưởng phòng và phó phòng của mỗi phòng ban | Biết ai phụ trách phòng, ai thay khi trưởng phòng vắng | FR-2.9 |

## 2. Tiêu chí chấp nhận

### FR-2.1 Danh bạ (M, đã có)

- **AC-2.1.1** Khi tìm theo một phần tên, email hoặc mã. Thì trả các nhân viên khớp, có phân trang.
- **AC-2.1.2** Giả sử nhân viên X đã `TERMINATED`. Khi tìm đúng tên X. Thì X không có trong kết quả.
- **AC-2.1.3** Khi lọc theo `dept` (UUID phòng ban). Thì chỉ trả nhân viên thuộc phòng ban đó.
- **AC-2.1.4** Khi gửi `size` lớn hơn 100. Thì trả 400.

### FR-2.2 Cây tổ chức (M, đã có)

- **AC-2.2.1** Khi mở cây tổ chức. Thì cây có đúng một gốc và chứa mọi phòng ban, không cần nhập mã phòng ban (issue #21).
- **AC-2.2.2** Khi mở thành viên một phòng ban. Thì chỉ thấy trường danh bạ của từng người.

### FR-2.3 Quản lý và cấp dưới (M, đã có)

- **AC-2.3.1** Khi xem một nhân viên. Thì thấy quản lý trực tiếp và danh sách cấp dưới trực tiếp đúng với dữ liệu.

### FR-2.4 Quản lý phòng ban (S, có API, chưa có giao diện)

- **AC-2.4.1** Khi HR hoặc ADMIN tạo phòng ban hợp lệ. Thì trả 201, có audit `CREATE` với `entityType = department`.
- **AC-2.4.2** Khi đổi phòng ban cha thành chính nó hoặc một phòng ban con của nó. Thì trả 400.
- **AC-2.4.3** Khi mã phòng ban đã tồn tại. Thì trả 409.
- **AC-2.4.4** Khi nhân viên hoặc quản lý tạo, sửa phòng ban. Thì trả 403.
- **AC-2.4.5** *(chưa có)* HR, ADMIN tạo và sửa phòng ban trên giao diện, lỗi hiện đúng ô.
- **AC-2.4.6** *(chưa đạt)* Khi tạo phòng ban không có `parentId`, hoặc sửa `parentId` thành `null`. Thì trả 400; cây giữ
  đúng một gốc. Hiện API chấp nhận và tạo thêm gốc.
- **AC-2.4.7** *(chưa đạt)* Khi `headEmployeeId` không phải nhân viên đang làm việc. Thì trả 400. Hiện API không kiểm.

### FR-2.5 Một quản lý trực tiếp, trừ CEO (M, đã có, PR #60)

- **AC-2.5.1** Khi tạo nhân viên không phải CEO mà thiếu quản lý trực tiếp, hoặc tạo CEO thứ hai. Thì trả 400 (issue #22).
- **AC-2.5.2** Khi gán quản lý tạo thành vòng (A quản lý B, B quản lý A). Thì trả 400.
- **AC-2.5.3** Khi gán quản lý đã `TERMINATED`, gán quản lý cho CEO, hoặc bỏ quản lý của nhân viên không phải CEO. Thì trả 400.

### FR-2.6 Danh mục chức danh, cấp bậc (S, chưa có; hiện chỉ có `GET /positions`)

- **AC-2.6.1** *(chưa có)* Khi HR tạo chức danh có mã (duy nhất, không sửa sau khi tạo), tên, cấp bậc 1–10. Thì trả 201, có
  audit. Vai trò khác thì trả 403.
- **AC-2.6.2** *(chưa có)* Khi HR ngừng dùng một chức danh. Thì chức danh không còn trong danh sách chọn khi tạo, điều chuyển
  nhân viên; nhân viên đang giữ chức danh đó không bị đổi. Xóa hẳn chức danh đang được dùng (hoặc có trong lịch sử) thì trả 409.

### FR-2.7 Điều chuyển có ngày hiệu lực (S, chưa có)

- **AC-2.7.1** *(chưa có)* Khi HR điều chuyển nhân viên A sang phòng ban, chức danh, quản lý mới, hiệu lực hôm nay. Thì hồ sơ A
  đổi ngay; quá trình công tác có dòng cũ đóng ở hôm qua và dòng mới mở từ hôm nay; có audit `TRANSFER`.
- **AC-2.7.2** *(chưa có)* Khi hiệu lực là ngày 1 tháng sau. Thì hồ sơ A chưa đổi; quá trình công tác có dòng "Sắp hiệu lực";
  đúng 00:00 ngày đó (giờ Việt Nam) job áp dụng điều chuyển. HR hủy được điều chuyển chưa hiệu lực.
- **AC-2.7.3** *(chưa có)* Giả sử A có đơn nghỉ `SUBMITTED`. Khi điều chuyển có hiệu lực và A đổi quản lý. Thì đơn chuyển sang
  danh sách chờ của quản lý mới, quản lý cũ không duyệt được nữa (UC4 AC-4.2.6); quản lý mới nhận email chung.
- **AC-2.7.4** *(chưa có)* Khi điều chuyển vi phạm FR-2.5 (quản lý đã nghỉ việc, tạo vòng, bỏ quản lý của người không phải
  CEO) hoặc hiệu lực trước ngày vào làm. Thì trả 400. Hiệu lực ở quá khứ chỉ cho tối đa 30 ngày (ghi lại điều chuyển làm muộn).
- **AC-2.7.5** *(chưa có)* Giả sử A đang là trưởng phòng X. Khi điều chuyển A sang phòng khác. Thì phải chọn trưởng phòng mới
  cho X hoặc để trống có chủ ý; không để X trỏ tới người không còn trong phòng.

### FR-2.8 Quá trình công tác (S, chưa có)

- **AC-2.8.1** *(chưa có)* Khi mở mục "Quá trình công tác" (UC1). Thì thấy các dòng: phòng ban, chức danh, quản lý trực tiếp,
  từ ngày, đến ngày, lý do (tuyển mới, điều chuyển, thăng chức, đổi quản lý), mới nhất trước.
- **AC-2.8.2** *(chưa có)* Chủ hồ sơ, quản lý trực tiếp hiện tại và HR xem được; người khác không thấy mục này (UC1 mức QL).
- **AC-2.8.3** *(chưa có)* Khi HR tạo nhân viên. Thì có dòng đầu tiên mở từ ngày vào làm, lý do "Tuyển mới". Dòng lịch sử
  không sửa, không xóa; sai thì HR thêm điều chỉnh có ghi lý do.

### FR-2.9 Trưởng phòng, phó phòng (S, chưa có; thay quy tắc chờ chốt về `headEmployeeId`)

- **AC-2.9.1** *(chưa có)* Mỗi phòng ban có tối đa một trưởng phòng và tối đa 3 phó phòng, đều là nhân viên đang làm việc
  **thuộc chính phòng ban đó**. Gán người ngoài phòng hoặc đã nghỉ việc thì trả 400.
- **AC-2.9.2** *(chưa có)* Khi HR tạo nhân viên mới vào phòng X. Thì ô "Quản lý trực tiếp" điền sẵn trưởng phòng X (HR đổi được).
  Trưởng phòng X thì mặc định do trưởng phòng của phòng cha quản lý.
- **AC-2.9.3** *(chưa có)* Khi HR tạo phân công duyệt thay cho trưởng phòng X (UC4 FR-4.3). Thì danh sách chọn người thay đưa
  phó phòng X lên đầu. Phó phòng **không** tự động có quyền duyệt đơn của cả phòng.
- **AC-2.9.4** *(chưa có)* Trang phòng ban trong sơ đồ tổ chức hiện trưởng phòng, phó phòng trước, rồi tới thành viên.
- **AC-2.9.5** *(chưa có)* Đổi trưởng phòng, phó phòng có audit; không tự đổi quản lý trực tiếp của ai.

**Quy tắc (chốt 14/11/2026, soạn thay TV2, TV1 và TV2 rà lại):** trưởng phòng là **vai trò của phòng ban**, quản lý trực tiếp là
**quan hệ giữa hai người**. Hai thứ thường trùng (trưởng phòng quản lý trực tiếp các thành viên) nhưng không bắt buộc, vì phòng
lớn có nhóm do phó phòng hoặc trưởng nhóm quản lý. Quyền duyệt đơn nghỉ luôn theo quản lý trực tiếp (BR-05), không theo chức
danh trưởng, phó phòng.

## 3. Yêu cầu phi chức năng liên quan

NFR-1.1 và NFR-1.3 (danh bạ p95 < 1 s với 2.000 nhân viên); NFR-1.6 (phân trang tối đa 100 dòng); NFR-5.11 (mọi API cần
đăng nhập).

## 4. Việc còn lại

Lịch làm theo [kế hoạch hoàn thành từng chức năng](../../progress/ke-hoach-tong.md#7-kế-hoạch-hoàn-thành-từng-chức-năng-tuần-10--13).

| Việc | Tiêu chí | Người | Nhánh | Tuần |
|---|---|---|---|---|
| Rà lại quy tắc trưởng, phó phòng (FR-2.9) đã soạn thay | – | TV2 | `docs/org-integrity-rules` | 11 |
| Chặn gốc thứ hai, kiểm `headEmployeeId` | AC-2.4.6, AC-2.4.7 | TV1 | `fix/employee-org-integrity` | 11 |
| Giao diện quản lý phòng ban (mức S, cắt đầu tiên nếu thiếu thời gian) | AC-2.4.5 | TV1 | `feat/department-admin-ui` | 13 |
| Trưởng, phó phòng; danh mục chức danh | AC-2.9.x, AC-2.6.x | TV1 | `feat/department-admin-ui` (cùng nhánh) | 13 |
| Quá trình công tác, điều chuyển có ngày hiệu lực | AC-2.8.x, AC-2.7.x | TV1 | `feat/employee-transfer` | 13 (mức S; nếu không kịp thì chỉ làm AC-2.8.x với dòng ghi khi tạo, sửa hồ sơ) |
