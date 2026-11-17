# ADR-04 – Tech stack: NestJS + React + PostgreSQL + Keycloak

| Mục | Nội dung |
|---|---|
| Trạng thái | **Đã chấp nhận** |
| Ngày quyết định | 26/10/2026 |
| Thời điểm | Tuần 7 (19/10 – 26/10/2026) |
| Người viết | TV1 (Dương) |
| Góc nhìn | Phần mềm |
| ADR liên quan | ADR-01, ADR-02 |
| Nguồn gốc | Mục quyết định trong [tuần 7](../../progress/tuan-07/README.md) |

## Lịch sử thay đổi

- Không có.

## Nội dung quyết định

**Bối cảnh:** nhóm 4 người, còn 7 tuần; kiến trúc đã chốt là modular monolith (ADR-01) trên PostgreSQL (ADR-02); cần OIDC
chuẩn để khi lên cloud thay bằng managed identity provider (ADR-00).

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | NestJS (TypeScript) | Framework Node.js có module, dependency injection, guard; frontend React cùng ngôn ngữ |
| B | Spring Boot (Java) | Framework enterprise, chặt chẽ; frontend React dùng ngôn ngữ khác |
| C | FastAPI (Python) | Gọn, nhanh viết; thuận cho AI; frontend React dùng ngôn ngữ khác |

**Tiêu chí lựa chọn:**

| Tiêu chí | A | B | C |
|---|---|---|---|
| Cả 4 người đọc và review được code của nhau (một ngôn ngữ cho FE + BE) | 5 | 2 | 2 |
| Hỗ trợ sẵn cấu trúc module, DI, guard cho modular monolith | 5 | 5 | 3 |
| Tốc độ phát triển trong 7 tuần | 4 | 3 | 5 |
| Thư viện cho OIDC, ORM, migration, OpenAPI | 4 | 5 | 4 |
| Thuận lợi cho phần AI (tuần 12) | 3 | 3 | 5 |

**Giải pháp được chọn:** A, với TypeORM truy cập PostgreSQL và Keycloak làm identity provider khi chạy local.

**Trade-off:** TypeScript chặt chẽ kém Java ở quy mô rất lớn; phần AI gọi LLM API qua HTTP thay vì dùng thư viện Python;
Keycloak tốn khoảng 500 MB RAM khi chạy local.

**Tiêu chí nghiệm thu:**
- Mọi thành viên clone repo và chạy được hệ thống trong dưới 15 phút theo hướng dẫn.
- Đổi từ Keycloak local sang managed identity provider chỉ bằng biến môi trường `OIDC_ISSUER`, `OIDC_JWKS_URI`.
- `npm run lint` chạy được trên cả Windows và Linux.

**Khi nào xem lại:** nếu phần AI cần thư viện chỉ có ở Python, tách AI assistant thành service Python riêng (đã là ứng viên tách theo ADR-01).
