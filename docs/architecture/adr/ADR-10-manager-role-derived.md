# ADR-10 – Role MANAGER suy ra từ sơ đồ tổ chức

| Mục | Nội dung |
|---|---|
| Trạng thái | **Đã chấp nhận** |
| Ngày quyết định | 26/10/2026 |
| Thời điểm | Tuần 7 (19/10 – 26/10/2026) |
| Người viết | TV1 (Dương) |
| Góc nhìn | Phần mềm |
| ADR liên quan | ADR-04 |
| Nguồn gốc | Mục quyết định trong [tuần 7](../../progress/tuan-07/README.md) |

## Lịch sử thay đổi

- Không có.

## Nội dung quyết định

**Bối cảnh:** khoảng 150 quản lý; người làm quản lý thay đổi theo sơ đồ tổ chức; quyền duyệt đơn phải khớp với quan hệ quản lý thật.

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | Gán tay trong Keycloak | Admin gán role manager cho từng người |
| B | Gán trong bảng role_assignment | HR gán role trong hệ thống |
| C | Suy ra khi đăng nhập | Ai có nhân viên trực thuộc thì có role MANAGER |

**Tiêu chí lựa chọn:**

| Tiêu chí | A | B | C |
|---|---|---|---|
| Luôn khớp với sơ đồ tổ chức | 1 | 2 | 5 |
| Công quản trị | 1 | 2 | 5 |
| Dễ hiểu, dễ kiểm tra | 4 | 4 | 4 |
| Hiệu năng (truy vấn thêm mỗi request) | 5 | 4 | 3 |

**Giải pháp được chọn:** C. Role HR và ADMIN vẫn gán rõ ràng (Keycloak hoặc `role_assignment`), không suy ra.

**Trade-off:** mỗi request thêm một truy vấn kiểm tra nhân viên trực thuộc (có index `manager_id`, dưới 1 ms ở 2,000 nhân viên).
Role MANAGER chỉ cho biết "là quản lý"; quyền duyệt từng đơn vẫn kiểm tra "là quản lý trực tiếp của người tạo đơn".

**Tiêu chí nghiệm thu:** tài khoản `manager` có role MANAGER, `employee` thì không; HR đổi quản lý của một nhân viên
thì lần đăng nhập sau role được cập nhật mà không phải sửa gì trong Keycloak.

**Khi nào xem lại:** cần quản lý ủy quyền (duyệt thay khi quản lý nghỉ) thì thêm bảng ủy quyền.
