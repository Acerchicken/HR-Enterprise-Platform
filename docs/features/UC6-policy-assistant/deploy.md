# UC6 – Trợ lý chính sách: triển khai

> Cách chạy chung, staging, rollback chung: [README](../README.md#môi-trường). File này chỉ ghi phần riêng của UC6.
> Cách làm và lý do: [ADR-16](../../architecture/adr/ADR-16-policy-assistant.md). Service tách riêng: [ADR-15](../../architecture/adr/ADR-15-service-extraction.md).

## 1. Thành phần

| Thành phần | Việc |
|---|---|
| API (`backend/`) | `POST /assistant/questions`: kiểm đầu vào, giới hạn tần suất, tính phạm vi người hỏi, gọi nội bộ assistant service |
| Module document (`backend/`) | Ghi event `document.*` vào `document.outbox` (UC5 spec 13.2) |
| Assistant service (`services/assistant/`) | Nhận event từ queue `assistant.document`, trích văn bản PDF, DOCX, chia đoạn, tính embedding, ghi index; trả lời câu hỏi qua Claude API |
| Web | Khung "Hỏi trợ lý chính sách" trên trang `/documents` |
| Database | Schema `assistant` (bảng `document`, `chunk`), extension `vector` và `unaccent`, DB user `assistant_svc` |
| Dịch vụ ngoài | Claude API; object storage (đọc file) |

## 2. Biến môi trường

Tên đề xuất, chốt trong PR `feat/assistant-service` và `feat/policy-assistant`, rồi thêm vào
[configuration.md](../../development/configuration.md).

| Biến | Nơi đọc | Local | Staging | Thiếu thì sao |
|---|---|---|---|---|
| `ANTHROPIC_API_KEY` | Assistant service | `.env` cá nhân, không commit | Secrets Manager | Trợ lý trả `fallback = true` kèm danh sách tài liệu (AC-6.3.4) |
| `ASSISTANT_MODEL` | Assistant service | `claude-haiku-5-5` | `claude-haiku-5-5` | Dùng mặc định |
| `ASSISTANT_LLM_TIMEOUT_MS` | Assistant service | `10000` | `10000` | Dùng mặc định |
| `ASSISTANT_URL`, `ASSISTANT_INTERNAL_TOKEN` | API | `http://localhost:3100`, chuỗi bất kỳ | URL nội bộ, Secrets Manager | API trả `fallback = true`, câu "Trợ lý tạm thời không dùng được" |
| `ASSISTANT_DB_URL` | Assistant service | User `assistant_svc` | User `assistant_svc` | Service không chạy |
| `STORAGE_*` | Assistant service | Như UC5, quyền chỉ đọc | Như UC5, IAM chỉ đọc bucket | Không trích được văn bản; tài liệu mới không vào index |
| Nhóm `assistant` trong `RATE_LIMIT_OVERRIDES` | API | Mặc định 10/phút, 100/ngày | Như local; nâng tạm khi chạy bộ đánh giá | – |

## 3. Hạ tầng

| Môi trường | Tài nguyên | File |
|---|---|---|
| Local | PostgreSQL đổi image sang `pgvector/pgvector:pg16`; RabbitMQ thêm queue `assistant.document`; S3Mock như UC5 | `docker-compose.yml` |
| Staging | RDS bật extension `vector`; SQS `assistant.document` + DLQ, subscription SNS lọc `document.*`; task Fargate assistant khoảng 1 GB RAM (model embedding); secret `ANTHROPIC_API_KEY` | `infra/staging/` (nhánh `infra/llm-secrets-cost`) |

## 4. Các bước

1. Migration tạo schema `assistant`, extension `vector`, `unaccent` (cần quyền `rds_superuser` trên RDS, chạy bằng user migration).
2. Nạp credit trả trước cho Claude API (5–10 USD) và đặt giới hạn chi tiêu của workspace trên Claude Console.
3. Sau khi deploy assistant service: chạy lệnh đồng bộ lần đầu (UC5 13.2) để index tài liệu đã đăng trước đó.
4. Chạy bộ đánh giá của TV2 trên staging, ghi tỉ lệ đúng, độ trễ, chi phí mỗi câu vào báo cáo tuần 12.

## 5. Kiểm tra sau deploy

1. Hỏi một câu có trong tài liệu được xem: có câu trả lời và trích dẫn đúng tài liệu, phiên bản.
2. Hỏi một câu chỉ có đáp án trong tài liệu ngoài phạm vi: "không tìm thấy".
3. Xóa `ANTHROPIC_API_KEY` rồi khởi động lại: nhận danh sách tài liệu, không lỗi 5xx.
4. Hỏi 11 câu trong một phút: câu thứ 11 nhận 429.
5. Grep log của API và assistant service: không có nội dung câu hỏi.

## 6. Rollback và sự cố

- Rollback assistant service không ảnh hưởng UC5: module document vẫn ghi outbox, event chờ trong queue và được xử lý khi service
  chạy lại.
- Index hỏng: xóa dữ liệu schema `assistant` rồi chạy lại lệnh đồng bộ lần đầu.
- Chi phí bất thường: thu hồi khóa trên Claude Console; trợ lý tự lùi về danh sách tài liệu (A2 trong spec).
- Phần vector gây lỗi hoặc chậm: tắt nhánh vector bằng cấu hình, chỉ dùng full-text (phương án cắt của ADR-16).

## 7. Còn thiếu

Toàn bộ UC6 chưa có trên `dev`. Cập nhật file này trong PR `feat/assistant-service` và `feat/policy-assistant`.
