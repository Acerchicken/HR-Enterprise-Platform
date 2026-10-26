# Tuần 5 – TV4: Workload analysis và kiến trúc cloud ban đầu

## Việc đã làm

| Việc | Output | Trạng thái |
|---|---|---|
| Phân tích workload, ước lượng average RPS và peak RPS | Mục 1 | Xong |
| Vẽ kiến trúc cloud ban đầu ở mức capability | Mục 2 | Xong |
| Map capability sang dịch vụ cụ thể | – | Chưa làm: chờ chốt cloud provider |

## 1. Workload analysis

Workload chính là online transactional (API + DB), read-heavy (~90% đọc). Phụ: xử lý file (tài liệu PDF) và về sau là AI (RAG).

| Chỉ số | Cách tính | Kết quả |
|---|---|---|
| Daily active users | 60% của 2,000 | 1,200 |
| Request / ngày | 1,200 × ~30 request, làm tròn | ~40,000 |
| Average RPS | 40,000 ÷ 86,400 | ≈ 0.5 RPS |
| Peak RPS | × peak factor 20 (dồn vào 8:00–9:00 và đầu tháng) | ≈ 10 RPS |
| Mục tiêu thiết kế | Peak × 5 (tăng trưởng) | 50 RPS |
| Đơn nghỉ phép | 2,000 × 12 đơn/năm ÷ 250 ngày làm việc | ≈ 100 đơn / ngày |
| Audit log | ~5,000 bản ghi/ngày × 250 ngày | ≈ 1.25 triệu bản ghi / năm |
| Tài liệu HR | ~500 file × ~4 MB | ≈ 2 GB |

Kết luận: một ứng dụng chạy 2 instance sau load balancer là đủ (2 instance để đạt availability, không phải để scale).
Kubernetes hay microservices là over-engineering cho nhóm 4 người (ADR-06).

## 2. Kiến trúc cloud ban đầu

Luồng request: DNS → CDN/WAF → Load balancer → 2 instance HR application → PostgreSQL + object storage.
Database, object storage, identity và monitoring đều là dịch vụ managed (ADR-00).

| Requirement | Capability | Component | Infrastructure (managed) |
|---|---|---|---|
| Đăng nhập, SSO-ready | Identity | Auth module | Managed identity provider (OIDC) |
| Hồ sơ, đơn, số dư phép, audit | Transactional database | HR application | Managed PostgreSQL |
| Tài liệu chính sách | Object storage | Document module | Object storage |
| Giao diện web | Static hosting + edge cache | Frontend SPA | CDN |
| Bảo vệ web | Web security | – | WAF |
| Phân phối traffic | Load balancing | – | Load balancer |
| Logs, metrics | Observability | – | Managed monitoring |

## Vướng mắc

- Cần chốt cloud provider (phụ thuộc credit sinh viên) để map cột cuối sang tên dịch vụ cụ thể.
