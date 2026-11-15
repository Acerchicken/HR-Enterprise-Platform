# ADR-07 – Không dùng Redis ở MVP

| Mục | Nội dung |
|---|---|
| Trạng thái | **Đã chấp nhận** |
| Ngày quyết định | 19/10/2026 |
| Thời điểm | Tuần 6 (12/10 – 19/10/2026) |
| Người viết | TV3 (Bảo) |
| Góc nhìn | Phần mềm |
| ADR liên quan | ADR-02, ADR-06 |
| Nguồn gốc | Mục quyết định trong [tuần 6](../../progress/tuan-06/README.md) |

## Lịch sử thay đổi

- Không có.

## Nội dung quyết định

**Bối cảnh:** read-heavy (~90% đọc) nhưng tải nhỏ; dữ liệu tham chiếu (phòng ban, chức danh, loại phép) đọc nhiều, ít đổi.

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | Không cache | Mọi request đọc database |
| B | Cache in-memory | Cache-aside trong từng instance, TTL 10 phút, xóa khi cập nhật |
| C | Redis | Cache dùng chung giữa các instance |

**Tiêu chí lựa chọn:**

| Tiêu chí | A | B | C |
|---|---|---|---|
| Giảm tải database cho dữ liệu đọc nhiều | 2 | 4 | 5 |
| Thêm thành phần phải vận hành và chi phí | 5 | 5 | 2 |
| Dữ liệu nhất quán giữa các instance | 5 | 3 | 5 |
| Độ phức tạp code | 5 | 4 | 3 |

**Giải pháp được chọn:** B, dù điểm gần bằng A. Lý do nghiêng về B: tuần 11 cần chứng minh được chiến lược cache; dữ liệu
cũ tối đa 10 phút là chấp nhận được với phòng ban, chức danh.

**Trade-off:** hai instance có thể lệch nhau tối đa 10 phút sau khi HR sửa phòng ban. Không cache số dư phép, quyền truy cập
và dữ liệu nhạy cảm.

**Tiêu chí nghiệm thu:** gọi danh sách phòng ban 100 lần liên tiếp chỉ tạo 1 truy vấn database trong 10 phút; sửa phòng ban
xong thì instance đó trả dữ liệu mới ngay.

**Khi nào xem lại:** cần session dùng chung, rate limit dùng chung, hoặc database CPU > 60% khi load test.
