# Biên bản Kiểm thử Giao diện Màn hình Tuần 7 (Test Report Week 7)

- **Người thực hiện:** Duy (TV4 - Tester)
- **Ngày thực hiện:** 28/10/2026
- **Phạm vi kiểm thử:** Màn hình Tuần 7 (Đăng nhập, Hồ sơ, Danh bạ, Chi tiết nhân viên, Sơ đồ tổ chức)
- **Tài khoản kiểm thử (Password: `Passw0rd!`):** `employee`, `manager`, `hr`, `admin`

## 1. Tóm tắt kết quả kiểm thử trên 4 tài khoản Demo

| Màn hình | Tài khoản `employee` | Tài khoản `manager` | Tài khoản `hr` | Tài khoản `admin` | Kết quả |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **1. Đăng nhập (Login)** | PASSED | PASSED | PASSED | PASSED | Đạt |
| **2. Hồ sơ (Profile)** | PASSED | PASSED | PASSED | PASSED | Đạt |
| **3. Danh bạ (Directory)** | PASSED | PASSED | PASSED | PASSED | Đạt |
| **4. Chi tiết nhân viên** | PASSED (Xem bản thân) | PASSED (Xem cấp dưới) | PASSED (Xem toàn bộ) | PASSED (Full quyền) | Đạt |
| **5. Sơ đồ tổ chức (Org Chart)** | PASSED | PASSED | PASSED | PASSED | Đạt |

## 2. Chi tiết kết quả kiểm thử theo màn hình

1. **Màn hình Đăng nhập (Login):**
   - Đăng nhập thành công với 4 tài khoản (`employee`, `manager`, `hr`, `admin`) bằng mật khẩu `Passw0rd!`.
   - Kiểm tra nhập sai mật khẩu: Báo lỗi chính xác "Mật khẩu không đúng".
2. **Màn hình Hồ sơ (Profile):**
   - Hiển thị đầy đủ thông tin cá nhân tương ứng với từng tài khoản đang đăng nhập.
3. **Màn hình Danh bạ (Directory):**
   - Tìm kiếm nhân viên và phân trang hoạt động chính xác.
4. **Màn hình Chi tiết nhân viên (Employee Detail):**
   - Phân quyền đúng: `employee` chỉ xem thông tin cơ bản; `manager` xem được cấp dưới; `hr` và `admin` xem đầy đủ thông tin hợp đồng/lương.
5. **Màn hình Sơ đồ tổ chức (Org Chart):**
   - Cấu trúc cây phòng ban hiển thị rõ ràng mối quan hệ quản lý - nhân viên.

## 3. Danh sách Issue / Lỗi phát sinh
- Không phát sinh lỗi nghiêm trọng (Blocker/Critical) trên các màn hình Tuần 7. Các giao diện chạy đúng yêu cầu kỹ thuật trên 4 tài khoản demo.