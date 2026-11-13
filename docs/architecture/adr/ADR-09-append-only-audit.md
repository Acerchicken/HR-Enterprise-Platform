# ADR-09 – Audit log append-only khóa ở mức database

| Mục | Nội dung |
|---|---|
| Trạng thái | **Đã chấp nhận** |
| Ngày quyết định | 26/10/2026 |
| Thời điểm | Tuần 7 (19/10 – 26/10/2026) |
| Người viết | TV1 (Dương) |
| Góc nhìn | Phần mềm |
| ADR liên quan | ADR-08 |
| Nguồn gốc | Mục quyết định trong [tuần 7](../../progress/tuan-07/README.md) |

## Lịch sử thay đổi

- Không có.

## Nội dung quyết định

**Bối cảnh:** UC7 và NFR yêu cầu log chỉ được thêm, không ai sửa/xóa, kể cả khi code có lỗi.

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | Chỉ quy ước trong code | Code không bao giờ gọi UPDATE/DELETE trên audit_log |
| B | Trigger trong PostgreSQL | Trigger chặn mọi UPDATE/DELETE trên audit_log |
| C | Lưu ra dịch vụ log bất biến | Đẩy audit sang storage dạng WORM / dịch vụ log của cloud |

**Tiêu chí lựa chọn:**

| Tiêu chí | A | B | C |
|---|---|---|---|
| Chặn được sửa/xóa kể cả khi code lỗi | 1 | 4 | 5 |
| Ghi audit cùng transaction với thao tác | 5 | 5 | 2 |
| Tra cứu audit linh hoạt (theo đối tượng, người, thời gian) | 5 | 5 | 3 |
| Công triển khai | 5 | 4 | 2 |

**Giải pháp được chọn:** B.

**Trade-off:** người có quyền superuser của database vẫn tắt được trigger; xóa dữ liệu khi test phải dùng `TRUNCATE`
(chỉ dùng trong seed `--reset` ở môi trường dev).

**Tiêu chí nghiệm thu:** chạy `DELETE FROM audit.audit_log` bị database từ chối với thông báo "audit_log là append-only".

**Khi nào xem lại:** tuần 9 (threat model) nếu yêu cầu chống cả admin database thì sao chép audit sang storage bất biến (C).
