# Tuần 7 – TV4

## Việc đã làm

Không có công việc hoàn thành trong tuần 7. Việc map capability sang cloud service (từ tuần 5) vẫn chưa làm, chuyển sang tuần 8.

## Vai trò từ tuần 8: Cloud, IaC và CI/CD

Theo [ADR-11](README.md#adr-11--điều-chỉnh-phân-vai-cho-giai-đoạn-code), TV4 chịu trách nhiệm:
- Chọn cloud provider, map capability sang dịch vụ cụ thể, ước tính và theo dõi chi phí.
- Viết **IaC** (hạ tầng bằng code) và **CI/CD** (pipeline tự động build, test, deploy).
- Hạ tầng chạy local trong `docker-compose.yml` (queue, mail giả lập…).

## Việc tuần 8

| Việc | Output |
|---|---|
| So sánh 2–3 cloud provider (credit sinh viên, chi phí, dịch vụ managed cần dùng), viết ADR-12 theo khung quyết định | ADR-12 trong báo cáo tuần 8 |
| Map 7 capability của kiến trúc v1 sang dịch vụ cụ thể, ước tính chi phí/tháng | Bảng mapping + bảng chi phí |
| CI trên GitHub Actions: mỗi PR chạy lint + unit test backend và build frontend | `.github/workflows/ci.yml` |
| Thêm RabbitMQ và Mailpit vào docker-compose cho worker thông báo | `docker-compose.yml` cập nhật |
