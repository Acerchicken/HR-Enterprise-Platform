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

### Quy tắc chờ chốt (TV2)

- Ý nghĩa của `headEmployeeId` (trưởng đơn vị) và quan hệ với quản lý trực tiếp. Bản nháp: [tuần 8](../../progress/tuan-08/uc1-uc2-review-draft.md).

## 3. Yêu cầu phi chức năng liên quan

NFR-1.1 và NFR-1.3 (danh bạ p95 < 1 s với 2.000 nhân viên); NFR-1.6 (phân trang tối đa 100 dòng); NFR-5.11 (mọi API cần
đăng nhập).

## 4. Việc còn lại

Lịch làm theo [kế hoạch theo chức năng tuần 11–13](../../progress/tuan-04-ke-hoach-tong.md#7-kế-hoạch-theo-chức-năng-tuần-11--13).

| Việc | Tiêu chí | Người | Nhánh | Tuần |
|---|---|---|---|---|
| Chốt ý nghĩa `headEmployeeId` và quan hệ với quản lý trực tiếp | – | TV2 | `docs/org-integrity-rules` | 11 |
| Chặn gốc thứ hai, kiểm `headEmployeeId` | AC-2.4.6, AC-2.4.7 | TV1 | `fix/employee-org-integrity` | 11 |
| Giao diện quản lý phòng ban (mức S, cắt đầu tiên nếu thiếu thời gian) | AC-2.4.5 | TV1 | `feat/department-admin-ui` | 13 |
