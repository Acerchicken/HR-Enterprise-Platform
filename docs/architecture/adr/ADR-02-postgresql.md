# ADR-02 – PostgreSQL thay vì NoSQL

| Mục | Nội dung |
|---|---|
| Trạng thái | **Đã chấp nhận** |
| Ngày quyết định | 19/10/2026 |
| Thời điểm | Tuần 6 (12/10 – 19/10/2026) |
| Người viết | TV2 (Thanh) |
| Góc nhìn | Cả hai |
| ADR liên quan | ADR-00, ADR-07 |
| Nguồn gốc | Mục quyết định trong [tuần 6](../../progress/tuan-06/README.md) |

## Lịch sử thay đổi

- Không có.

## Nội dung quyết định

**Bối cảnh:** dữ liệu nhiều quan hệ (nhân viên – phòng ban – quản lý – đơn); số dư phép cần strong consistency; cần truy vấn audit linh hoạt.

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | PostgreSQL (managed) | Relational, ACID, có full-text search và pgvector |
| B | MongoDB | Document database, schema linh hoạt |
| C | DynamoDB | Key-value managed, scale gần như vô hạn |

**Tiêu chí lựa chọn:**

| Tiêu chí | A | B | C |
|---|---|---|---|
| Quan hệ và JOIN (tổ chức, quản lý, đơn) | 5 | 3 | 1 |
| Transaction ACID cho số dư phép | 5 | 3 | 3 |
| Truy vấn linh hoạt cho audit, báo cáo | 5 | 4 | 2 |
| Ít thành phần phải vận hành (full-text, vector có sẵn) | 5 | 3 | 2 |
| Khả năng scale ngang | 3 | 4 | 5 |
| Nhóm đã quen | 5 | 3 | 2 |

**Giải pháp được chọn:** A. Relational model + ACID; full-text search và pgvector (cho RAG tuần 12) có sẵn, ít thành phần phải vận hành.

**Trade-off:** scale ngang phức tạp hơn NoSQL, không phải vấn đề ở quy mô 10,000 nhân viên; full-text kém hơn search engine chuyên dụng.

**Tiêu chí nghiệm thu:**
- Ràng buộc nghiệp vụ quan trọng nằm ngay trong database (unique, check, foreign key trong schema).
- Tìm danh bạ trên 2,000 nhân viên p95 < 1 s; tra audit theo đối tượng dùng index, không quét cả bảng.

**Khi nào xem lại:** search tài liệu không đạt p95 < 1 s ở tuần 11 thì thêm search engine riêng cho tài liệu.
