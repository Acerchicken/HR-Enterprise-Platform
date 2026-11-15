# ADR-13 – Kho tài liệu: tải lên trực tiếp, tải xuống qua API, lọc phạm vi trong truy vấn

| Mục | Nội dung |
|---|---|
| Trạng thái | **Đã chấp nhận** |
| Ngày quyết định | 12/11/2026 |
| Thời điểm | Tuần 10 (9/11 – 16/11/2026) |
| Người viết | TV1 (Dương) |
| Góc nhìn | Phần mềm |
| ADR liên quan | ADR-00, ADR-12 |
| Nguồn gốc | Mục quyết định trong [tuần 10](../../progress/tuan-10/README.md) |

## Lịch sử thay đổi

- Không có.

## Nội dung quyết định

**Bối cảnh:** UC5 cần lưu file PDF/DOCX tối đa 20 MiB, nhiều phiên bản, phạm vi xem theo toàn công ty, phòng ban (gồm phòng ban
con) và vai trò (`document-rules.md` DR-01 → DR-08). DR-06 yêu cầu mất quyền là không tải được ngay, kể cả bằng link đã cấp;
DR-08 yêu cầu không lộ tài liệu ngoài phạm vi, kể cả tiêu đề hay số lượng.

**Các giải pháp:**

| # | Giải pháp |
|---|---|
| A | File đi qua API cả hai chiều |
| B | Tải lên bằng presigned URL PUT; tải xuống qua API (API đọc từ storage và stream về) |
| C | Presigned URL cả hai chiều |

**Tiêu chí lựa chọn:**

| Tiêu chí | A | B | C |
|---|---|---|---|
| Đáp ứng DR-06 (thu hồi quyền tải ngay) | 5 | 5 | 1 |
| Tải lên không chiếm băng thông, bộ nhớ của API (FR-5.1) | 2 | 5 | 5 |
| Độ phức tạp | 4 | 3 | 4 |
| **Tổng** | **11** | **13** | **10** |

**Giải pháp được chọn:** B.

- Tải lên: HR khai báo tên file, loại, dung lượng → API kiểm DR-01 và ký URL PUT 10 phút; trình duyệt PUT thẳng lên storage
  (MinIO/S3); HR gọi `confirm`, API kiểm file đã có, đúng dung lượng, đúng định dạng thực (magic number) rồi mới cho phiên bản
  thành `READY`. Sai thì xóa file, phiên bản `REJECTED`.
- Tải xuống: `GET /documents/{id}/download` kiểm quyền ở mỗi lần gọi rồi stream từ storage; không phát link tải.
- Phạm vi xem: tính lại mỗi request từ phòng ban hiện tại (kèm phòng ban cha) và vai trò hiện tại; lọc bằng điều kiện SQL ngay
  trong truy vấn danh sách, nên phân trang và số lượng không lộ tài liệu ngoài phạm vi. Ngoài phạm vi trả 404 như không tồn tại.
- Tìm kiếm (`feat/document-search`) dùng full-text PostgreSQL trên cùng điều kiện phạm vi, không thêm dịch vụ search riêng.

**Đánh đổi:** tải xuống tốn băng thông API (file ≤ 20 MiB, lượng tải thấp); thêm bước `confirm` sau khi upload; phiên bản
`PENDING` bỏ dở cần dọn định kỳ (chưa làm).

**Khi nào xem lại:** tải xuống làm API chậm rõ rệt khi load test tuần 11, hoặc cần file lớn hơn 20 MiB.
