# UC2 – Thông tin tổ chức: yêu cầu và tiêu chí chấp nhận

> Đọc file này trước khi mở nhánh làm UC2. Luồng chi tiết: [spec.md](spec.md). Nguồn FR: [SRS mục 4.2](../../requirements/SRS.md#42-uc2--thông-tin-tổ-chức-fr-2x).
> Mỗi tiêu chí `AC-x.y.z` là một ca kiểm thử. PR làm chức năng ghi mã AC đã làm trong mô tả PR.

## 1. User story

| Mã | Là | Tôi muốn | Để | FR |
|---|---|---|---|---|
| US-2.1 | Nhân viên | Tìm đồng nghiệp theo tên, email, mã, lọc theo phòng ban | Liên lạc đúng người | FR-2.1 |
| US-2.2 | Nhân viên | Xem cây tổ chức và thành viên từng phòng ban | Hiểu công ty tổ chức thế nào | FR-2.2 |
| US-2.3 | Nhân viên | Xem quản lý trực tiếp và cấp dưới của một người | Biết ai duyệt việc của ai | FR-2.3 |
| US-2.4 | HR, ADMIN | Tạo, sửa đơn vị (Công ty, Trung tâm, Phòng, Nhóm) | Cây tổ chức luôn đúng thực tế, đúng cấp | FR-2.4 |
| US-2.5 | HR | Mỗi nhân viên có đúng một quản lý trực tiếp, trừ CEO | Đơn nghỉ luôn có người duyệt | FR-2.5 |
| US-2.6 | HR | Quản lý danh mục chức danh và cấp bậc | Chức danh thống nhất, không gõ tự do mỗi người một kiểu | FR-2.6 |
| US-2.7 | HR | Điều chuyển nhân viên sang phòng ban, chức danh, quản lý mới từ một ngày hiệu lực | Đổi đúng ngày, không phải nhớ để sửa tay | FR-2.7 |
| US-2.8 | Nhân viên, quản lý, HR | Xem quá trình công tác: ở phòng nào, chức danh gì, ai quản lý, từ ngày nào | Hồ sơ có lịch sử thật (UC1 mục "Quá trình công tác") | FR-2.8 |
| US-2.9 | HR, nhân viên | Biết trưởng và phó của mỗi đơn vị (Tổng Giám đốc, Giám đốc trung tâm, trưởng phòng, trưởng nhóm) | Biết ai phụ trách đơn vị, ai thay khi trưởng vắng | FR-2.9 |
| US-2.10 | HR | Ngừng hoạt động một đơn vị bị giải thể, sáp nhập | Cây chỉ còn đơn vị đang hoạt động mà lịch sử công tác vẫn đúng | FR-2.10 |

## 2. Tiêu chí chấp nhận

### FR-2.1 Danh bạ (M, đã có)

- **AC-2.1.1** Khi tìm theo một phần tên, email hoặc mã. Thì trả các nhân viên khớp, có phân trang.
- **AC-2.1.2** Giả sử nhân viên X đã `TERMINATED`. Khi tìm đúng tên X. Thì X không có trong kết quả.
- **AC-2.1.3** Khi lọc theo `dept` (UUID phòng ban). Thì chỉ trả nhân viên thuộc phòng ban đó.
- **AC-2.1.4** Khi gửi `size` lớn hơn 100. Thì trả 400.

### FR-2.2 Cây tổ chức (M, đã có)

- **AC-2.2.1** Khi mở cây tổ chức. Thì cây có đúng một gốc và chứa mọi phòng ban, không cần nhập mã phòng ban (issue #21).
- **AC-2.2.3** *(chưa có)* Khi mở cây tổ chức. Thì gốc là đơn vị loại Công ty; mỗi đơn vị hiện loại (Trung tâm, Phòng, Nhóm) và
  trưởng đơn vị với đúng tên vai trò theo loại (ADR-14); đơn vị đã ngừng hoạt động không hiện.
- **AC-2.2.2** Khi mở thành viên một phòng ban. Thì chỉ thấy trường danh bạ của từng người.

### FR-2.3 Quản lý và cấp dưới (M, đã có)

- **AC-2.3.1** Khi xem một nhân viên. Thì thấy quản lý trực tiếp và danh sách cấp dưới trực tiếp đúng với dữ liệu.

### FR-2.4 Quản lý phòng ban (S, có API, chưa có giao diện)

- **AC-2.4.1** Khi HR hoặc ADMIN tạo phòng ban hợp lệ. Thì trả 201, có audit `CREATE` với `entityType = department`.
- **AC-2.4.2** Khi đổi phòng ban cha thành chính nó hoặc một phòng ban con của nó. Thì trả 400.
- **AC-2.4.3** Khi mã phòng ban đã tồn tại. Thì trả 409.
- **AC-2.4.4** Khi nhân viên hoặc quản lý tạo, sửa phòng ban. Thì trả 403.
- **AC-2.4.5** *(chưa có)* HR, ADMIN tạo và sửa phòng ban trên giao diện, lỗi hiện đúng ô.
- **AC-2.4.6** Khi tạo phòng ban không có `parentId`, hoặc sửa `parentId` thành `null`. Thì trả 400; cây giữ
  đúng một gốc.
- **AC-2.4.7** Khi `headEmployeeId` không phải nhân viên đang làm việc. Thì trả 400.
- **AC-2.4.8** *(chưa có)* Khi tạo hoặc sửa đơn vị sai luật loại cha, loại con (ADR-14): Trung tâm không thuộc Công ty; Phòng
  không thuộc Công ty hoặc Trung tâm; Nhóm không thuộc Phòng; tạo đơn vị Công ty thứ hai. Thì trả 400. Đổi loại một đơn vị
  làm đơn vị con của nó sai luật cũng trả 400.
- **AC-2.4.9** *(chưa có)* Khi tạo Phòng Pháp chế thẳng dưới Công ty (không qua Trung tâm). Thì trả 201.

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

> **Liên quan UC1 (rà 18/11):** mục "Quá trình công tác" của UC1 đã có (#90) nhưng **dựng tạm từ audit** nhóm trường tổ
> chức (`UPDATE` có `{ from, to }`) cộng các dòng HR nhập tay, nên chưa có ngày hiệu lực khác ngày sửa, chưa có "Sắp hiệu lực",
> lý do chỉ suy ra (điều chuyển, đổi chức danh, đổi quản lý). Khi làm FR-2.7, FR-2.8 thì lịch sử bổ nhiệm của UC2 là nguồn
> chính và `ProfileChangeService.computed('career-history')` đọc từ đó; audit chỉ còn để tra cứu.

- **AC-2.8.1** *(chưa có)* Khi mở mục "Quá trình công tác" (UC1). Thì thấy các dòng: phòng ban, chức danh, quản lý trực tiếp,
  từ ngày, đến ngày, lý do (tuyển mới, điều chuyển, thăng chức, đổi quản lý), mới nhất trước.
- **AC-2.8.2** *(chưa có)* Chủ hồ sơ, quản lý trực tiếp hiện tại và HR xem được; người khác không thấy mục này (UC1 mức QL).
- **AC-2.8.3** *(chưa có)* Khi HR tạo nhân viên. Thì có dòng đầu tiên mở từ ngày vào làm, lý do "Tuyển mới". Dòng lịch sử
  không sửa, không xóa; sai thì HR thêm điều chỉnh có ghi lý do.

### FR-2.9 Trưởng và phó đơn vị mọi cấp (S, chưa có; ADR-14)

| Loại đơn vị | Trưởng | Phó (tối đa) |
|---|---|---|
| Công ty | Tổng Giám đốc (CEO) | Phó Tổng Giám đốc (5) |
| Trung tâm | Giám đốc trung tâm | Phó Giám đốc trung tâm (3) |
| Phòng | Trưởng phòng | Phó phòng (3) |
| Nhóm | Trưởng nhóm | Không có |

- **AC-2.9.1** *(chưa có)* Trưởng và phó là nhân viên đang làm việc, thuộc **chính đơn vị đó hoặc một đơn vị cha của nó**
  (kiêm nhiệm, ví dụ Giám đốc trung tâm kiêm trưởng một phòng của trung tâm). Gán người ngoài nhánh, người đã nghỉ việc, hoặc
  quá số phó theo bảng trên thì trả 400. Một người làm trưởng nhiều đơn vị được.
- **AC-2.9.2** *(chưa có)* Khi HR tạo nhân viên mới vào đơn vị X. Thì ô "Quản lý trực tiếp" điền sẵn trưởng của X (HR đổi được).
  Nếu người mới là trưởng của X thì điền sẵn trưởng của đơn vị cha gần nhất có trưởng. HR được chọn người khác, ví dụ Giám
  đốc trung tâm báo cáo một Phó Tổng Giám đốc phụ trách.
- **AC-2.9.3** *(chưa có)* Khi HR tạo phân công duyệt thay cho trưởng đơn vị X (UC4 FR-4.3). Thì danh sách chọn người thay đưa
  phó của X lên đầu. Phó **không** tự động có quyền duyệt đơn của cả đơn vị.
- **AC-2.9.4** *(chưa có)* Trang đơn vị trong sơ đồ tổ chức hiện trưởng, phó trước (đúng tên vai trò theo loại), rồi tới thành
  viên, rồi tới đơn vị con.
- **AC-2.9.5** *(chưa có)* Đổi trưởng, phó có audit; không tự đổi quản lý trực tiếp của ai.
- **AC-2.9.6** *(chưa có)* Khi HR đánh dấu trưởng X là "Quyền" (`headActing = true`). Thì sơ đồ tổ chức và hồ sơ hiện
  "Quyền Trưởng phòng" (hoặc "Quyền Giám đốc trung tâm"…); quyền hạn không khác trưởng chính thức.
- **AC-2.9.7** *(chưa có)* CEO là trưởng của đơn vị Công ty và thuộc đơn vị đó. Đơn nghỉ của CEO do HR xử lý (UC4 E8).

**Quy tắc (chốt 14/11/2026, mở rộng cho mọi cấp theo ADR-14 ngày 15/11/2026; soạn thay TV2, TV1 và TV2 rà lại):** trưởng đơn
vị là **vai trò của đơn vị**, quản lý trực tiếp là **quan hệ giữa hai người**. Hai thứ thường trùng (trưởng phòng quản lý trực
tiếp các thành viên) nhưng không bắt buộc, vì phòng lớn có nhóm do trưởng nhóm quản lý, và Giám đốc trung tâm có thể báo cáo
Phó Tổng Giám đốc. Quyền duyệt đơn nghỉ luôn theo quản lý trực tiếp (BR-05), không theo chức danh trưởng, phó.

### FR-2.10 Ngừng hoạt động đơn vị (C, chưa có; ADR-14)

- **AC-2.10.1** *(chưa có)* Giả sử đơn vị X còn nhân viên đang làm việc hoặc còn đơn vị con đang hoạt động. Khi HR ngừng hoạt
  động X. Thì trả 409 và nói rõ còn bao nhiêu người, bao nhiêu đơn vị con.
- **AC-2.10.2** *(chưa có)* Khi HR ngừng hoạt động đơn vị X đã trống. Thì X không còn trong cây, danh bạ, danh sách chọn khi
  tạo, điều chuyển nhân viên; quá trình công tác cũ vẫn hiện tên X; có audit. Không xóa hẳn đơn vị.
- **AC-2.10.3** *(chưa có)* Sáp nhập phòng A vào phòng B: HR điều chuyển hết người của A sang B (FR-2.7, cùng ngày hiệu lực) rồi
  ngừng hoạt động A. Không có thao tác "sáp nhập" riêng.

## 3. Yêu cầu phi chức năng liên quan

NFR-1.1 và NFR-1.3 (danh bạ p95 < 1 s với 2.000 nhân viên); NFR-1.6 (phân trang tối đa 100 dòng); NFR-5.11 (mọi API cần
đăng nhập).

## 4. Việc còn lại

Lịch làm theo [kế hoạch hoàn thành từng chức năng](../../progress/ke-hoach-tong.md#7-kế-hoạch-hoàn-thành-từng-chức-năng-tuần-10--13).

| Việc | Tiêu chí | Người | Nhánh | Tuần |
|---|---|---|---|---|
| Rà lại quy tắc trưởng, phó đơn vị (FR-2.9) và ADR-14 đã soạn thay | – | TV2 | `docs/org-integrity-rules` | 11 (rà lại sau #83, #84) |
| Chặn gốc thứ hai, kiểm `headEmployeeId`; thêm loại đơn vị, luật cha con, đổi seed (Công ty, Trung tâm, Nhóm) | AC-2.4.6 → AC-2.4.9, AC-2.2.3 | TV1 | `fix/employee-org-integrity` | 11 (gốc thứ hai, `headEmployeeId` đã merge #84; loại đơn vị ở `feat/org-unit-types`) |
| Giao diện quản lý phòng ban (mức S, cắt đầu tiên nếu thiếu thời gian) | AC-2.4.5 | TV1 | `feat/department-admin-ui` | 13 |
| Trưởng, phó đơn vị mọi cấp; danh mục chức danh; ngừng hoạt động đơn vị | AC-2.9.x, AC-2.6.x, AC-2.10.x | TV1 | `feat/department-admin-ui` (cùng nhánh) | 13 |
| Quá trình công tác, điều chuyển có ngày hiệu lực | AC-2.8.x, AC-2.7.x | TV1 | `feat/employee-transfer` | 13 (mức S; nếu không kịp thì chỉ làm AC-2.8.x với dòng ghi khi tạo, sửa hồ sơ) |
