# Tuần 6 (12/10 – 19/10) – Application, Data & Integration Architecture (P2)

Tuần 6 hoàn thành bộ artifact Assignment #2 và 3 ADR. Quyết định chính: **modular monolith + PostgreSQL + message queue**.
Các bước của workflow chạy đồng bộ trong một ACID transaction, còn thông báo và index tài liệu chạy bất đồng bộ qua queue.

## 1. Các công việc đã hoàn thành

| Thành viên | Công việc đã hoàn thành | Output | Chi tiết |
|---|---|---|---|
| TV1 (nhóm trưởng) | Business capability map (4 nhóm); application components (7 module + 1 worker); ADR-01, ADR-03 | Capability map, component table, 2 ADR | [TV1_Duong.md](TV1_Duong.md) |
| TV2 (Thanh) | API specification REST /api/v1 (xác thực, lỗi, idempotency); data model 11 entity + data ownership; ADR-02 | API spec, ERD, ADR-02 | [TV2_Thanh.md](TV2_Thanh.md) |
| TV3 (Bảo) | Chiến lược lưu trữ và cache; bảng sync/async; 6 business event | Bảng storage/cache, bảng sync/async, event model | [TV3_Bao.md](TV3_Bao.md) |
| TV4 (Duy) | Integration với 5 hệ thống ngoài; 8 tình huống lỗi và cách xử lý | Bảng integration, bảng failure handling | [TV4_Duy.md](TV4_Duy.md) |

**Chưa làm được theo kế hoạch:** map capability sang cloud service (vẫn chờ chốt provider).

## 2. Tóm tắt kế hoạch tuần tiếp theo (tuần 7: 19/10 – 26/10)

| Thành viên | Công việc | Output |
|---|---|---|
| TV1 (nhóm trưởng) | Khung dự án modular monolith, quy ước code, quy trình review PR; bắt đầu module Leave (model + state machine) | Khung repo, tài liệu quy ước code |
| TV2 (Thanh) | OpenAPI; migration cho các schema; module Employee và Organization | OpenAPI YAML, migration, API Employee/Organization chạy local |
| TV3 (Bảo) | Khung frontend SPA; màn hình đăng nhập, hồ sơ cá nhân, danh bạ | Frontend chạy local, gọi được API |
| TV4 (Duy) | docker-compose (app + PostgreSQL); đăng nhập OIDC; seed ~2,000 nhân viên; map cloud service khi chốt provider | docker-compose, seed data, README |

## 3. Quyết định quan trọng

### ADR-01 – Modular monolith thay vì microservices

> Đã chuyển sang file riêng: [ADR-01 – Modular monolith thay vì microservices](../../architecture/adr/ADR-01-modular-monolith.md). Danh sách toàn bộ ADR: [`architecture/adr/`](../../architecture/adr/README.md).

### ADR-02 – PostgreSQL thay vì NoSQL

> Đã chuyển sang file riêng: [ADR-02 – PostgreSQL thay vì NoSQL](../../architecture/adr/ADR-02-postgresql.md). Danh sách toàn bộ ADR: [`architecture/adr/`](../../architecture/adr/README.md).

### ADR-03 – Workflow đồng bộ, thông báo và index bất đồng bộ

> Đã chuyển sang file riêng: [ADR-03 – Workflow đồng bộ, thông báo và index bất đồng bộ](../../architecture/adr/ADR-03-sync-workflow-async-notification.md). Danh sách toàn bộ ADR: [`architecture/adr/`](../../architecture/adr/README.md).

### ADR-07 – Không dùng Redis ở MVP

> Đã chuyển sang file riêng: [ADR-07 – Không dùng Redis ở MVP](../../architecture/adr/ADR-07-no-redis.md). Danh sách toàn bộ ADR: [`architecture/adr/`](../../architecture/adr/README.md).
