# ADR-06 – Availability 99.5% và thiết kế cho 50 RPS (không dùng Kubernetes)

| Mục | Nội dung |
|---|---|
| Trạng thái | **Đã chấp nhận** |
| Ngày quyết định | 12/10/2026 |
| Thời điểm | Tuần 5 (5/10 – 12/10/2026) |
| Người viết | Nhóm |
| Góc nhìn | Hệ thống |
| ADR liên quan | ADR-00, ADR-01 |
| Nguồn gốc | Mục quyết định trong [tuần 5](../../progress/tuan-05/README.md) |

## Lịch sử thay đổi

- Không có.

## Nội dung quyết định

**Bối cảnh:** peak ước tính ≈ 10 RPS; hệ thống nội bộ, không phải thanh toán; ngân sách < 100 USD/tháng.

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | 99.9%, multi-AZ, Kubernetes | Cụm Kubernetes trên nhiều AZ, database multi-AZ |
| B | 99.5%, 2 instance sau load balancer | 2 instance của app (container service), database single-AZ có backup |
| C | 99%, 1 instance | 1 VM chạy toàn bộ |

**Tiêu chí lựa chọn:**

| Tiêu chí | A | B | C |
|---|---|---|---|
| Phù hợp nhu cầu thật (nội bộ, peak 10 RPS) | 2 | 5 | 3 |
| Chi phí | 1 | 4 | 5 |
| Độ phức tạp vận hành cho nhóm 4 người | 1 | 4 | 5 |
| Chịu được 1 instance lỗi / deploy không downtime | 5 | 4 | 1 |

**Giải pháp được chọn:** B. Hai instance là để đạt availability và deploy cuốn chiếu, không phải để scale.

**Trade-off:** chấp nhận ≈ 3.6 giờ downtime/tháng; database single-AZ là điểm lỗi đơn (bù bằng backup + PITR, RTO ≤ 4 giờ).

**Tiêu chí nghiệm thu:** load test tuần 11 ở 50 RPS đạt p95 < 300 ms (đọc) và < 500 ms (ghi); tắt 1 instance trong lúc
test thì tỷ lệ lỗi < 1%.

**Khi nào xem lại:** nếu số nhân viên vượt 10,000 hoặc yêu cầu availability lên 99.9%.
