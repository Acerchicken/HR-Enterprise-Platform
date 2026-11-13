# ADR-00 – Dùng managed services cho database, storage và identity

| Mục | Nội dung |
|---|---|
| Trạng thái | **Đã chấp nhận** |
| Ngày quyết định | 12/10/2026 |
| Thời điểm | Tuần 5 (5/10 – 12/10/2026) |
| Người viết | TV1 (Dương) |
| Góc nhìn | Hệ thống |
| ADR liên quan | ADR-06, ADR-12 |
| Nguồn gốc | Mục quyết định trong [tuần 5](../../progress/tuan-05/README.md) |

## Lịch sử thay đổi

- Không có.

## Nội dung quyết định

**Bối cảnh:** nhóm 4 người, 10 tuần, không có người vận hành chuyên trách; NFR yêu cầu backup, mã hóa at rest, RPO ≤ 1 giờ,
RTO ≤ 4 giờ; ngân sách < 100 USD/tháng.

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | Tự cài trên VM | PostgreSQL, MinIO (object storage), Keycloak cài trên 1–2 máy ảo |
| B | Managed services | Managed PostgreSQL, object storage, managed identity provider của cloud |
| C | Kết hợp | Managed database + object storage, tự chạy Keycloak trên VM |

**Tiêu chí lựa chọn:**

| Tiêu chí | A | B | C |
|---|---|---|---|
| Đáp ứng RPO ≤ 1 giờ, RTO ≤ 4 giờ (backup, point-in-time recovery) | 2 | 5 | 4 |
| Công vận hành của nhóm (vá lỗi, backup, giám sát) | 1 | 5 | 3 |
| Bảo mật có sẵn (mã hóa at rest, TLS, vá bảo mật) | 2 | 5 | 4 |
| Chi phí hàng tháng trong ngân sách | 4 | 3 | 3 |
| Mức phụ thuộc vào vendor (lock-in) | 5 | 2 | 3 |

**Giải pháp được chọn:** B. Nhóm dồn effort vào business logic (workflow, phân quyền, audit), là phần tạo ra giá trị và được chấm điểm.

**Trade-off:** phụ thuộc vendor, ít quyền tùy biến, chi phí cố định cao hơn VM tự quản. Giảm lock-in bằng cách chỉ dùng
chuẩn mở: OIDC cho đăng nhập, PostgreSQL cho database, API kiểu S3 cho object storage.

**Tiêu chí nghiệm thu:**
- Bật được backup tự động và khôi phục thử về một thời điểm trong quá khứ (point-in-time) trong vòng 4 giờ.
- Ứng dụng đổi từ môi trường local (PostgreSQL, Keycloak, MinIO chạy bằng Docker) sang dịch vụ managed chỉ bằng cách đổi biến môi trường, không sửa code.
- Chi phí ước tính cho cả 3 dịch vụ ở tier nhỏ nhất < 60 USD/tháng, chừa phần còn lại cho compute.

**Khi nào xem lại:** nếu credit sinh viên không đủ cho managed database, chuyển sang giải pháp C cho môi trường staging.
