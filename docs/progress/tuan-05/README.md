# Tuần 5 (5/10 – 12/10) – Business, Requirements & Cloud Architecture (P1)

Tuần 5 hoàn thành các artifact của P1 theo kế hoạch. Kết luận chính: workload nhỏ (peak ≈ 10 RPS) nhưng dữ liệu nhạy cảm,
nên kiến trúc ưu tiên security và audit hơn là khả năng scale.

## 1. Các công việc đã hoàn thành

| Thành viên | Công việc đã hoàn thành | Output | Chi tiết |
|---|---|---|---|
| TV1 (nhóm trưởng) | Business problem statement có số đo; 4 nhóm người dùng và stakeholder; Architecture Canvas; ADR-00 | Problem statement, bảng users, Canvas, ADR-00 | [TV1_Duong.md](TV1_Duong.md) |
| TV2 (Thanh) | Functional requirements cho 7 use case theo actor–action–input–output–business rule | Bảng functional requirements | [TV2_Thanh.md](TV2_Thanh.md) |
| TV3 (Bảo) | User journey đơn nghỉ phép; NFR có target cụ thể cho 6 nhóm | User journey, bảng NFR | [TV3_Bao.md](TV3_Bao.md) |
| TV4 (Duy) | Workload analysis và ước lượng traffic (peak ≈ 10 RPS, thiết kế cho 50 RPS); kiến trúc cloud ban đầu | Bảng workload, kiến trúc v1 | [TV4_Duy.md](TV4_Duy.md) |

**Chưa làm được theo kế hoạch:** chưa chốt cloud provider, nên kiến trúc v1 mới ở mức capability (chưa gắn tên dịch vụ cụ thể).

## 2. Tóm tắt kế hoạch tuần tiếp theo (tuần 6: 12/10 – 19/10)

| Thành viên | Công việc | Output |
|---|---|---|
| TV1 (nhóm trưởng) | Business capability map, application components; ADR-01 (Monolith vs Microservices), ADR-03 (Sync vs Async) | Component diagram, 2 ADR |
| TV2 (Thanh) | API specification; data model và data ownership; ADR-02 (PostgreSQL vs NoSQL) | API spec, ERD, ADR-02 |
| TV3 (Bảo) | Chiến lược storage và cache; bảng sync/async; event model | Bảng storage/cache, bảng sync/async, danh sách event |
| TV4 (Duy) | Integration với hệ thống ngoài; phân tích tình huống lỗi; map capability sang cloud service khi chốt provider | Bảng integration, bảng failure handling |

## 3. Quyết định quan trọng

### ADR-00 – Dùng managed services cho database, storage và identity

> Đã chuyển sang file riêng: [ADR-00 – Dùng managed services cho database, storage và identity](../../architecture/adr/ADR-00-managed-services.md). Danh sách toàn bộ ADR: [`architecture/adr/`](../../architecture/adr/README.md).

### ADR-06 – Availability 99.5% và thiết kế cho 50 RPS (không dùng Kubernetes)

> Đã chuyển sang file riêng: [ADR-06 – Availability 99.5% và thiết kế cho 50 RPS (không dùng Kubernetes)](../../architecture/adr/ADR-06-availability-50-rps.md). Danh sách toàn bộ ADR: [`architecture/adr/`](../../architecture/adr/README.md).
