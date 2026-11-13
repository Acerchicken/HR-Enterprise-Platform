# UC6 – Tự tra cứu: triển khai

> Cách chạy chung, staging, rollback chung: [README](../README.md#môi-trường). File này chỉ ghi phần riêng của UC6.
> Tìm đồng nghiệp (FR-6.1) triển khai như [UC2](../UC2-organization/deploy.md). Phần dưới cho tìm tài liệu và trợ lý.

## 1. Thành phần

| Thành phần | Tìm tài liệu (FR-6.2, tuần 10–11) | Trợ lý chính sách (FR-6.3, tuần 12) |
|---|---|---|
| API | Endpoint tìm kiếm trong `modules/document`, cùng điều kiện phạm vi với UC5 | Endpoint hỏi đáp, gọi LLM có timeout |
| Worker | Trích văn bản từ PDF, DOCX sau khi phiên bản `READY` | Chia đoạn, đánh chỉ mục đoạn văn bản (theo ADR-14) |
| Web | Ô tìm kiếm trên trang "Tài liệu" | Khung hỏi đáp |
| Database | Migration mới: cột văn bản, cột `tsvector`, chỉ mục GIN (full-text PostgreSQL, không thêm dịch vụ tìm kiếm, ADR-13) | Bảng đoạn văn bản; có thể cần `pgvector` (chốt ở ADR-14) |
| Dịch vụ ngoài | Object storage (đọc file để trích) | LLM API |

## 2. Biến môi trường

| Biến | Local | Staging | Thiếu thì sao |
|---|---|---|---|
| `STORAGE_*` | Như UC5 | Như UC5 | Không trích được văn bản; tìm chỉ theo tiêu đề |
| Ngưỡng rate limit tìm kiếm | Mặc định 20/phút | 20/phút; nâng tạm khi load test | – |
| Khóa và model LLM (tên biến chốt ở `feat/policy-assistant`) | `.env` cá nhân, không commit | Secrets Manager | Trợ lý trả danh sách tài liệu gốc thay cho câu trả lời |

Tên biến chính xác thêm vào bảng này và [configuration.md](../../development/configuration.md) trong PR làm tính năng.

## 3. Hạ tầng

| Môi trường | Tài nguyên | File |
|---|---|---|
| Local | PostgreSQL (full-text có sẵn), MinIO | `docker-compose.yml` |
| Staging | RDS; nếu dùng `pgvector` thì kiểm RDS hỗ trợ phiên bản extension; secret LLM; budget alarm cho chi phí LLM (NFR-7.1) | `infra/staging/rds.tf`, `kms_secrets.tf`, `budgets.tf` (nhánh `infra/llm-secrets-cost`) |

## 4. Các bước

- Sau khi merge tìm kiếm: chạy job trích văn bản lại cho mọi phiên bản `READY` đã có (tài liệu đăng trước khi có worker).
- LLM: chỉ bật trên staging khi đã có budget alarm; ghi chi phí mỗi câu hỏi vào báo cáo tuần 12.

## 5. Kiểm tra sau deploy

1. Tìm một từ chỉ có trong nội dung tài liệu: có kết quả. Tìm đúng tiêu đề tài liệu ngoài phạm vi: rỗng.
2. Gọi tìm kiếm 21 lần trong một phút: lần 21 nhận 429.
3. Hỏi trợ lý một câu có trong tài liệu: có câu trả lời và trích dẫn; tắt khóa LLM thì nhận danh sách tài liệu gốc.

## 6. Rollback và sự cố

- Rollback migration tìm kiếm chỉ mất chỉ mục và văn bản trích, không mất tài liệu; chạy lại job trích văn bản là có lại.
- LLM lỗi hoặc vượt ngân sách: tắt bằng cách bỏ khóa LLM; trợ lý tự lùi về danh sách tài liệu gốc (A3 trong spec).

## 7. Còn thiếu

- Toàn bộ phần FR-6.2 và FR-6.3 chưa có trên `dev`. Cập nhật file này trong PR `feat/document-search` và `feat/policy-assistant`.
