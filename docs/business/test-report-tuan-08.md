# Biên bản Kiểm thử Chức năng Màn hình Tuần 7 (Test Report Week 7)

- **Người thực hiện:** Duy (TV4 - Tester)
- **Ngày thực hiện:** 01/11/2026
- **Phạm vi kiểm thử:** 5 màn hình Tuần 7 (Đăng nhập, Hồ sơ, Danh bạ, Chi tiết nhân viên, Sơ đồ tổ chức)
- **Tài khoản demo (Mật khẩu: `Passw0rd!`):** `employee`, `manager`, `hr`, `admin`

## 1. Chi tiết kiểm thử theo Bước và Kết quả thực tế

| Màn hình | Các bước thực hiện (Steps) | Kết quả mong đợi (Expected) | Kết quả thực tế (Actual) |
| :--- | :--- | :--- | :--- |
| **1. Đăng nhập** | Nhập sai tài khoản hoặc sai mật khẩu. | Báo lỗi chuẩn của Keycloak: "Invalid username or password." | Hiển thị thông báo "Invalid username or password." của Keycloak. Đạt. |
| **1. Đăng nhập** | Đăng nhập với các tài khoản demo. | Vào màn hình chính thành công. | Đăng nhập thành công với 4 tài khoản. Đạt. |
| **2. Hồ sơ** | Chọn mục Hồ sơ cá nhân. | Hiển thị đúng thông tin của user đang đăng nhập. | Hiển thị chính xác thông tin cá nhân. Đạt. |
| **3. Danh bạ** | Tìm kiếm nhân viên bất kỳ. | Kết quả lọc đúng, phân trang hoạt động. | Lọc và phân trang hoạt động tốt. Đạt. |
| **4. Chi tiết NV** | `employee` xem nhân viên khác. | Chỉ thấy thông tin cơ bản (phòng ban, email). | Ẩn hoàn toàn thông tin lương, hợp đồng. Đạt. |
| **4. Chi tiết NV** | `manager` xem cấp dưới. | Thấy thông tin cơ bản và lịch sử công tác. | Hoạt động đúng quyền. Đạt. |
| **4. Chi tiết NV** | `hr` xem thông tin lương, hợp đồng. | Hiển thị đầy đủ thông tin nhạy cảm. | `hr` xem được dữ liệu nhạy cảm. Đạt. |
| **4. Chi tiết NV** | `admin` xem thông tin lương, hợp đồng. | Bị hệ thống chặn HTTP `403 Forbidden`. | Giao diện chặn và báo `403 Forbidden` đúng thiết kế. Đạt. |
| **5. Sơ đồ TC** | Vào màn hình Sơ đồ tổ chức. | Vẽ đúng cây sơ đồ theo phòng ban, chức vụ. | Hiển thị đầy đủ mối quan hệ quản lý. Đạt. |

## 2. Màn hình nghỉ phép (Leave Workflow UI)

Thực hiện kiểm thử trên môi trường `dev` (sau khi merge `feat/leave-ui`) theo các ca từ TC-01 đến TC-22.

| Mã TC | Chức năng kiểm thử | Kết quả mong đợi | Kết quả thực tế | Trạng thái | Ghi chú |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **TC-01 -> TC-04** | Tạo đơn xin nghỉ (hợp lệ, nửa ngày, trùng lịch, quá số dư) | Phản hồi đúng trạng thái và thông báo lỗi. | Hoạt động đúng thiết kế. | PASSED | |
| **TC-05 -> TC-10** | Quản lý duyệt/từ chối đơn và kiểm tra phân quyền | Trạng thái cập nhật chuẩn xác, chặn đúng quyền `403`. | Xử lý đúng Business Rule. | PASSED | |
| **TC-11 -> TC-14** | Nhân viên tự hủy đơn / HR hoàn tất đơn | Trạng thái chuyển `CANCELLED` hoặc `COMPLETED` hợp lý. | Gặp lỗi L-01 theo mô tả tại mục 1.3. | FAILED | Issue `#18` |
| **TC-15 -> TC-22** | Các ca ngoại lệ (Delegation, duyệt 2 lần, v.v.) | Xử lý chặt chẽ, không bị lỗi dữ liệu số dư. | Gặp lỗi L-02 theo mô tả tại mục 1.3. | FAILED | Issue `#19` |
