# Biên bản kiểm thử chức năng – Tuần 10

- **Ngày thực hiện:** 16/11/2026
- **Nhánh / Commit:** Nhánh `docs/test-report-week10` (Kiểm thử thực tế trên nhánh `dev` sau khi merge `#60`, `#63`, `#64`, `#76`)
- **Môi trường:** Local (`docker compose up -d`), Web `http://localhost:5173`, API `http://localhost:3000/api/docs`
- **Người thực hiện:** Duy (TV4)

## 1. Kết quả kiểm tra và đối chiếu tài liệu tính năng (Tuần 10)

| Hạng mục / Use Case | PR liên quan | Nội dung / Trọng tâm kiểm tra | Trạng thái | Ghi chú |
| :--- | :--- | :--- | :--- | :--- |
| **Đặc tả Use Case (UC1 – UC7)** | `#76` | Review 7 file `test.md` và cấu trúc 4 file đặc tả (`requirements`, `spec`, `deploy`, `test`) cho UC1–UC7. | Đã hoàn thành | Đã đối chiếu bảng phủ AC, xác định các ca còn thiếu cho TV4. |
| **Quy tắc 1 quản lý & HR duyệt đơn CEO** | `#60` | Kiểm thử API & E2E cho FR-2.5 (1 quản lý trừ CEO) và FR-4.4 (`HR_FOR_CEO`, `canDecide`). | Đạt | Đã chạy thực tế Unit, E2E và kiểm tra luồng duyệt trên Web. |
| **Giao diện HR tạo/sửa hồ sơ** | `#63` | Kiểm thử Form `/employees/new`, `/employees/:id/edit`, mã hóa trường nhạy cảm, validation `fields`. | Đạt | Đã test trực tiếp trên giao diện với vai trò HR và Employee. |
| **API Kho tài liệu HR** | `#64` | Kiểm thử upload presigned PUT, magic number, phạm vi xem (phòng ban/vai trò), versioning, optimistic locking. | Đạt | Đã chạy Unit & E2E kiểm tra đầy đủ luồng và ngoại lệ. |

## 2. Chi tiết ca kiểm thử và kết quả chạy thực tế (`#60`, `#63`, `#64`)

### 2.1. Tổng hợp kết quả chạy bộ test tự động trên nhánh `dev`
- **Unit Test (`npm test`):** `69/69 passed` (bao gồm các spec mới: `HR_FOR_CEO` state machine, `employee-fields.spec.ts`, quy tắc file & phạm vi kho tài liệu).
- **E2E Test (`npm run test:e2e`):** `46/46 passed` (khi bật S3 storage local; nếu tắt storage thì `40 passed, 6 skipped` cho nhóm kho tài liệu).

### 2.2. Bảng ca kiểm thử chi tiết theo từng PR

| Mã ca | PR / Tiêu chí | Thao tác & Dữ liệu đầu vào | Kết quả mong đợi | Hình thức | Kết quả thực tế |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-60-01** | `#60` (FR-2.5) | Gọi `POST /employees` hoặc `PATCH` gán chức danh khác CEO nhưng thiếu `managerId`, hoặc gán `managerId` là nhân viên đã `TERMINATED`. | API từ chối, trả về mã `400 Bad Request`. | E2E | **Đạt** (`400`) |
| **TC-60-02** | `#60` (FR-2.5) | Tạo nhân viên thứ hai giữ chức danh `CEO`; gán `managerId` cho CEO hiện tại; hoặc xóa `managerId` của nhân viên thường. | API từ chối toàn bộ các trường hợp vi phạm gốc duy nhất, trả về `400 Bad Request`. | E2E | **Đạt** (`400`) |
| **TC-60-03** | `#60` (FR-4.4) | Đăng nhập tài khoản `HR`, gọi API danh sách chờ duyệt (`pending-approval`) và thực hiện duyệt/từ chối đơn nghỉ của `CEO`. | HR thấy đơn của CEO, trường `canDecide = true`, thao tác duyệt/từ chối trả về `200 OK`. | E2E + UI | **Đạt** (`200`) |
| **TC-60-04** | `#60` (FR-4.4) | Quản lý khác bấm duyệt đơn của `CEO`; hoặc `HR` gọi API duyệt/từ chối đơn nghỉ của một nhân viên thường. | Hệ thống chặn sai thẩm quyền, trả về `403 Forbidden`, `canDecide = false`. | E2E | **Đạt** (`403`) |
| **TC-63-01** | `#63` (FR-1.4) | HR mở `/employees/new`, chọn phòng ban, dùng quản lý được gợi ý sẵn, nhập đầy đủ thông tin + trường nhạy cảm (CCCD, lương, STK) và bấm Lưu. | Tạo nhân viên thành công (`201`), chuyển sang trang chi tiết hồ sơ; log audit ghi tên trường nhưng che giá trị nhạy cảm (`***`). | E2E + UI | **Đạt** |
| **TC-63-02** | `#63` (FR-1.4) | HR nhập sai định dạng trường dữ liệu (ví dụ nhập CCCD không đủ 12 số) rồi bấm Lưu. | API trả `400` kèm object `fields`; giao diện hiển thị thông báo lỗi đỏ ngay bên dưới ô CCCD. | E2E + UI | **Đạt** |
| **TC-63-03** | `#63` (FR-1.5) | HR mở `/employees/:id/edit` của một nhân viên, kiểm tra trạng thái các ô và cập nhật Số điện thoại. | Ghi nhận audit `VIEW_SENSITIVE` khi mở form; ô Mã nhân viên và Email bị khóa không cho sửa; cập nhật SĐT lưu thành công (`200`). | UI | **Đạt** |
| **TC-63-04** | `#63` (FR-1.4, 1.5) | Đăng nhập bằng tài khoản `employee` thường, kiểm tra trang Danh bạ và truy cập trực tiếp URL `/employees/new`. | Không hiển thị nút "Tạo nhân viên" / "Sửa hồ sơ"; mở thẳng URL `/employees/new` bị chặn thông báo chỉ dành cho HR. | UI | **Đạt** |
| **TC-64-01** | `#64` (FR-5.1, DR-01) | HR khai báo tạo tài liệu PDF/DOCX (`≤ 20 MiB`), tải file lên qua presigned PUT URL và gọi API `confirm`. | Phiên bản chuyển sang trạng thái `READY`; tải xuống qua API thành công với đúng nội dung file. | E2E | **Đạt** (`200/201`) |
| **TC-64-02** | `#64` (DR-01) | Upload file `.zip` đổi đuôi thành `.docx`, file vượt quá `20 MiB`, không chọn phạm vi xem hoặc gọi `confirm` khi chưa đẩy file lên storage. | Hệ thống kiểm tra magic number & dung lượng thực, từ chối toàn bộ ca lỗi với mã `400 Bad Request`. | E2E | **Đạt** (`400`) |
| **TC-64-03** | `#64` (FR-5.2, DR-02) | Thiết lập phạm vi xem theo phòng ban cha / vai trò; dùng tài khoản nhân viên thuộc phòng ban con, người ngoài phạm vi, và HR ngoài phạm vi để tải tài liệu; sau đó chuyển phòng ban của nhân viên. | Nhân viên phòng ban con tải được; người ngoài phạm vi (và HR ngoài phạm vi) tải bị trả `404 Not Found`; khi nhân viên đổi sang phòng ban khác thì mất quyền tải ngay lập tức. | E2E | **Đạt** (`404`) |
| **TC-64-04** | `#64` (FR-5.3, DR-04, DR-05) | Upload phiên bản 2 cho tài liệu đã có; thử ẩn/khôi phục tài liệu; và gọi API sửa metadata với `version` cũ. | Phiên bản 2 không ghi đè bản 1 (tải được cả 2 bản); ẩn/khôi phục giữ nguyên lịch sử phiên bản; sửa sai `version` trả `409 Conflict`. | E2E | **Đạt** (`409`) |