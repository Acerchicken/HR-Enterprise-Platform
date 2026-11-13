# ADR-08 – Mã hóa trường nhạy cảm ở tầng ứng dụng

| Mục | Nội dung |
|---|---|
| Trạng thái | **Đã chấp nhận** |
| Ngày quyết định | 26/10/2026 |
| Thời điểm | Tuần 7 (19/10 – 26/10/2026) |
| Người viết | TV1 (Dương) |
| Góc nhìn | Phần mềm |
| ADR liên quan | ADR-09 |
| Nguồn gốc | Mục quyết định trong [tuần 7](../../progress/tuan-07/README.md) |

## Lịch sử thay đổi

- Không có.

## Nội dung quyết định

**Bối cảnh:** NFR yêu cầu CCCD, số tài khoản, lương mã hóa at rest và chỉ HR xem được; ngay cả người có quyền đọc database
(admin, backup bị lộ) cũng không được thấy.

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | Chỉ mã hóa ổ đĩa | Dùng mã hóa at rest có sẵn của managed database |
| B | Mã hóa trong database (pgcrypto) | Hàm mã hóa của PostgreSQL, khóa truyền vào câu SQL |
| C | Mã hóa ở tầng ứng dụng (AES-256-GCM) | API mã hóa trước khi ghi, giải mã khi HR xem; khóa nằm ngoài database |

**Tiêu chí lựa chọn:**

| Tiêu chí | A | B | C |
|---|---|---|---|
| Người đọc được database / backup vẫn không thấy dữ liệu | 1 | 3 | 5 |
| Khóa không lộ qua log SQL hay database | 3 | 2 | 5 |
| Phát hiện dữ liệu bị sửa | 1 | 2 | 5 |
| Độ phức tạp code | 5 | 3 | 3 |
| Tìm kiếm / lọc trên trường đó | 5 | 2 | 1 |

**Giải pháp được chọn:** C, **kết hợp với** A khi lên cloud (hai lớp). Trường nhạy cảm tách sang bảng `employee_sensitive`.

**Trade-off:** không tìm kiếm hay sắp xếp được theo lương, CCCD trong database; mất khóa là mất dữ liệu, nên khóa phải được
quản lý cẩn thận (tuần 9 chuyển sang secret manager).

**Tiêu chí nghiệm thu:**
- Đọc thẳng bảng `employee.employee_sensitive` chỉ thấy chuỗi mã hóa.
- Sửa một byte trong chuỗi mã hóa thì giải mã báo lỗi.
- Nhân viên, quản lý, admin gọi `?include=sensitive` đều bị 403; HR xem được và có một dòng audit `VIEW_SENSITIVE`.

**Khi nào xem lại:** cần tìm theo CCCD thì thêm cột hash (HMAC) để tra cứu chính xác mà không giải mã.
