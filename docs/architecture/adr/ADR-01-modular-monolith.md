# ADR-01 – Modular monolith thay vì microservices

| Mục | Nội dung |
|---|---|
| Trạng thái | **Đã chấp nhận** |
| Ngày quyết định | 19/10/2026 |
| Thời điểm | Tuần 6 (12/10 – 19/10/2026) |
| Người viết | TV1 (Dương) |
| Góc nhìn | Phần mềm |
| ADR liên quan | ADR-03, ADR-06 |
| Nguồn gốc | Mục quyết định trong [tuần 6](../../progress/tuan-06/README.md) |

## Lịch sử thay đổi

- Không có.

## Nội dung quyết định

**Bối cảnh:** nhóm 4 người, 10 tuần; peak ≈ 10 RPS; một bước duyệt phải cập nhật đơn, số dư và audit cùng lúc.

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | Monolith thường | Một ứng dụng, code không chia ranh giới rõ |
| B | Modular monolith | Một ứng dụng + 1 worker, chia module rõ, mỗi module một schema DB, chỉ gọi nhau qua interface |
| C | Microservices | Mỗi capability một service riêng, database riêng, giao tiếp qua mạng |

**Tiêu chí lựa chọn:**

| Tiêu chí | A | B | C |
|---|---|---|---|
| Transaction đơn + số dư + audit đơn giản, đúng | 5 | 5 | 2 |
| Công deploy, debug, vận hành cho 4 người | 5 | 4 | 1 |
| Ranh giới rõ, tách được service khi cần | 1 | 4 | 5 |
| Phù hợp tải (peak 10 RPS, thiết kế 50 RPS) | 5 | 5 | 3 |
| Chi phí hạ tầng | 5 | 5 | 2 |

**Giải pháp được chọn:** B. Transaction cục bộ, không cần Saga; deploy và debug dễ; module có ranh giới rõ để tách khi cần.

**Trade-off:** phải scale cả ứng dụng; các module deploy cùng nhau; cần kỷ luật để không phá ranh giới module.
Ứng viên tách đầu tiên: Notification và AI assistant.

**Tiêu chí nghiệm thu:**
- Không module nào inject repository hay đọc bảng của module khác (kiểm tra khi review PR).
- Không có foreign key chéo schema trong migration.
- Duyệt đơn cập nhật đơn, số dư, lịch sử và audit trong đúng một transaction: lỗi giữa chừng thì không bảng nào bị thay đổi (e2e test tuần 8).

**Khi nào xem lại:** một module cần scale hoặc release độc lập (ví dụ AI assistant tốn tài nguyên), hoặc nhóm lớn hơn 8 người.
