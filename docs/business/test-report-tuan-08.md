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

## 2. Danh sách Issue / Lỗi phát sinh
- **Lỗi 1 (Ví dụ nếu có):** Không có lỗi (0 issue). Các kết quả thực tế hoàn toàn khớp với kết quả mong đợi và thiết kế phân quyền bảo mật.
