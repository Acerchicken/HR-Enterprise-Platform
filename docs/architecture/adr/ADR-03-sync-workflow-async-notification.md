# ADR-03 – Workflow đồng bộ, thông báo và index bất đồng bộ

| Mục | Nội dung |
|---|---|
| Trạng thái | **Đã chấp nhận** |
| Ngày quyết định | 19/10/2026 |
| Thời điểm | Tuần 6 (12/10 – 19/10/2026) |
| Người viết | TV1 (Dương) |
| Góc nhìn | Cả hai |
| ADR liên quan | ADR-01, ADR-12 |
| Nguồn gốc | Mục quyết định trong [tuần 6](../../progress/tuan-06/README.md) |

## Lịch sử thay đổi

- Không có.

## Nội dung quyết định

**Bối cảnh:** chuyển trạng thái đơn phải chính xác ngay; email provider có thể lỗi; trích text tài liệu tốn thời gian.

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | Toàn bộ sync | API gửi email và index ngay trong request |
| B | Toàn bộ async | Mọi thao tác, kể cả duyệt đơn, đi qua queue |
| C | Kết hợp | Workflow sync trong transaction; thông báo và index qua outbox → queue → worker |

**Tiêu chí lựa chọn:**

| Tiêu chí | A | B | C |
|---|---|---|---|
| Kết quả duyệt chính xác ngay cho người dùng | 5 | 2 | 5 |
| Lỗi email/index không làm hỏng quy trình duyệt | 1 | 5 | 5 |
| Giữ API p95 < 500 ms | 2 | 5 | 5 |
| Độ phức tạp (queue, worker, outbox) | 5 | 2 | 3 |
| Không mất event | 2 | 4 | 5 |

**Giải pháp được chọn:** C. Dùng **queue** (không dùng event stream) vì mỗi event chỉ có 1–2 consumer và vài trăm event/ngày.

**Trade-off:** thông báo đến trễ vài giây (eventual consistency); thêm queue, worker và bảng outbox; consumer phải idempotent.

**Tiêu chí nghiệm thu:**
- Tắt email provider (hoặc worker) thì vẫn duyệt đơn được, trạng thái đơn đúng; bật lại thì email được gửi bù.
- Gửi trùng một message thì email chỉ gửi một lần.
- Sau 5 lần lỗi, message vào dead-letter queue.

**Khi nào xem lại:** có nhiều consumer cần đọc lại lịch sử event (ví dụ analytics) thì cân nhắc event stream.
