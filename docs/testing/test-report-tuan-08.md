# Biên bản Kiểm thử Giao diện Màn hình Tuần 7 (Test Report Week 7)

- **Người thực hiện:** Duy (TV4 - Tester)
- **Ngày thực hiện:** 28/10/2026
- **Phạm vi kiểm thử:** Màn hình Quản lý nghỉ phép (Leave Management UI & API Foundation)

## 1. Tóm tắt kết quả kiểm thử (Summary)

| Tổng số Ca kiểm thử | Đạt (Passed) | Thất bại (Failed) | Bị nghẽn (Blocked) | Tỷ lệ Đạt |
| :---: | :---: | :---: | :---: | :---: |
| 12 | 12 | 0 | 0 | **100%** |

## 2. Chi tiết kết quả kiểm thử màn hình

1. **Giao diện Danh sách loại phép & Ngày lễ:**
   - Hiển thị đầy đủ danh mục loại phép (`ANNUAL`, `SICK`, `PERSONAL`, `MATERNITY`, `UNPAID`). [PASSED]
   - Bảng hiển thị rõ ràng cột có lương, số ngày tối đa và giấy tờ cần thiết. [PASSED]
2. **Form Đăng ký nghỉ phép:**
   - Validation ngày bắt đầu/kết thúc hoạt động chính xác. [PASSED]
   - Tính toán tự động trừ ngày nghỉ lễ theo BR-03 hoạt động đúng logic. [PASSED]
3. **Workflow xử lý đơn:**
   - Các nút chức năng (Duyệt, Từ chối, Hủy, Hoàn tất) hiển thị đúng theo phân quyền tài khoản. [PASSED]

## 3. Kết luận
Màn hình và các tính năng nền tảng Tuần 7 đạt yêu cầu nghiệp vụ, sẵn sàng ghép nối dữ liệu chính thức.