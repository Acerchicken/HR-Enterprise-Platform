# Software Architecture Document (SAD) – HRHelper (HR Enterprise Platform)

SAD trả lời **hệ thống được xây thế nào**, lấy [SRS](../requirements/SRS.md) làm đầu vào (ISO/IEC/IEEE 42010). SAD gồm
file này (mục lục và danh sách ADR) và hai phần, mỗi phần một góc nhìn:

| Tài liệu | Trả lời câu hỏi | Dành cho |
|---|---|---|
| [SAD phần 1 – Kiến trúc hệ thống](SAD-1-system-architecture.md) | **Phần I – tổng quan** (không gắn công cụ) và **Phần II – hiện tại** (công cụ, framework, phiên bản, local và cloud). Hệ thống gồm những khối chạy riêng nào, nói chuyện với hệ thống ngoài nào, chạy ở đâu, mạng, bảo mật hạ tầng, sẵn sàng, phục hồi, quan sát, CI/CD, chi phí | Người vận hành, cloud, đánh giá NFR |
| [SAD phần 2 – Kiến trúc phần mềm](SAD-2-software-architecture.md) | Bên trong API, worker, web: cấu trúc code, module và phụ thuộc, luồng xử lý request, dữ liệu, pattern đảm bảo nghiệp vụ, API, frontend, kiểm thử, cách mở rộng | Người viết code, review code |
| [Phụ lục – Database schema](database-schema.md) | Sơ đồ ERD từng schema PostgreSQL; bảng, cột, kiểu, khóa chính, foreign key, unique, index, tham chiếu logic chéo schema, lịch sử migration | Người viết code, viết migration, review |

```mermaid
flowchart LR
  brd[BRD<br/>yêu cầu nghiệp vụ] --> srs[SRS<br/>FR, NFR, truy vết]
  srs --> sys[Kiến trúc hệ thống<br/>khối, hạ tầng, NFR]
  sys --> sw[Kiến trúc phần mềm<br/>module, code, pattern]
  adr[ADR-00 → ADR-12<br/>quyết định] --> sys
  adr --> sw
```

Liên quan: [BRD](../business/BRD.md) · [SRS](../requirements/SRS.md) · [ma trận phân quyền](../security/access-control-matrix.md) ·
[quy ước code](../CONVENTIONS.md) · [API](../openapi.yaml) · [danh sách ADR](../progress/README.md#danh-sách-quyết-định-adr).

## Quyết định kiến trúc (ADR)

| ADR | Quyết định | Góc nhìn | Ở đâu |
|---|---|---|---|
| ADR-00 | Managed services cho database, lưu file, đăng nhập | Hệ thống | [tuần 5](../progress/tuan-05/README.md#adr-00--dùng-managed-services-cho-database-storage-và-identity) |
| ADR-01 | Modular monolith | Phần mềm | [tuần 6](../progress/tuan-06/README.md#adr-01--modular-monolith-thay-vì-microservices) |
| ADR-02 | PostgreSQL | Cả hai | [tuần 6](../progress/tuan-06/README.md#adr-02--postgresql-thay-vì-nosql) |
| ADR-03 | Workflow đồng bộ, thông báo bất đồng bộ qua outbox + queue | Cả hai | [tuần 6](../progress/tuan-06/README.md#adr-03--workflow-đồng-bộ-thông-báo-và-index-bất-đồng-bộ) |
| ADR-04 | NestJS + React + PostgreSQL + Keycloak | Phần mềm | [tuần 7](../progress/tuan-07/README.md#adr-04--tech-stack-nestjs--react--postgresql--keycloak) |
| ADR-05 | Phạm vi MVP | Nghiệp vụ | [tuần 4](../progress/tuan-04-ke-hoach-tong.md#adr-05--phạm-vi-mvp-một-luồng-nghiệp-vụ-nghỉ-phép-end-to-end) |
| ADR-06 | 99,5%, 2 instance, thiết kế 50 RPS, không Kubernetes | Hệ thống | [tuần 5](../progress/tuan-05/README.md#adr-06--availability-995-và-thiết-kế-cho-50-rps-không-dùng-kubernetes) |
| ADR-07 | Không Redis, cache in-memory | Phần mềm | [tuần 6](../progress/tuan-06/README.md#adr-07--không-dùng-redis-ở-mvp) |
| ADR-08 | Mã hóa trường nhạy cảm ở tầng ứng dụng | Phần mềm | [tuần 7](../progress/tuan-07/README.md#adr-08--mã-hóa-trường-nhạy-cảm-ở-tầng-ứng-dụng) |
| ADR-09 | Audit log append-only khóa ở database | Phần mềm | [tuần 7](../progress/tuan-07/README.md#adr-09--audit-log-append-only-khóa-ở-mức-database) |
| ADR-10 | Role MANAGER suy ra từ sơ đồ tổ chức | Phần mềm | [tuần 7](../progress/tuan-07/README.md#adr-10--role-manager-suy-ra-từ-sơ-đồ-tổ-chức) |
| ADR-11 | Điều chỉnh phân vai | Dự án | [tuần 7](../progress/tuan-07/README.md#adr-11--điều-chỉnh-phân-vai-cho-giai-đoạn-code) |
| ADR-12 | Cloud provider | Hệ thống | [tuần 9](../progress/tuan-09/README.md#adr-12--chọn-cloud-provider) |
| ADR-13 | Kho tài liệu: tải lên trực tiếp, tải xuống qua API, lọc phạm vi trong truy vấn | Phần mềm | [tuần 10](../progress/tuan-10/README.md#adr-13--kho-tài-liệu-tải-lên-trực-tiếp-tải-xuống-qua-api-lọc-phạm-vi-trong-truy-vấn) |
