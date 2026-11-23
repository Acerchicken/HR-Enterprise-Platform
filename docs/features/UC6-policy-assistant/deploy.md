# UC6 – Trợ lý chính sách: triển khai

> Cách chạy chung, staging, rollback chung: [README](../README.md#môi-trường). File này chỉ ghi phần riêng của UC6.
> Cách làm và lý do: [ADR-16](../../architecture/adr/ADR-16-policy-assistant.md). Service tách riêng: [ADR-15](../../architecture/adr/ADR-15-service-extraction.md).

## 1. Thành phần

| Thành phần | Việc |
|---|---|
| API (`backend/`) | `POST /assistant/questions`: kiểm đầu vào, giới hạn tần suất, tính phạm vi người hỏi, gọi nội bộ assistant service |
| Module document (`backend/`) | Ghi event `document.*` vào `document.outbox` (UC5 spec 13.2) |
| Assistant service (`services/assistant/`) | Nhận event từ queue `assistant.document`, trích văn bản PDF, DOCX, chia đoạn, tính embedding, ghi index; trả lời câu hỏi qua adapter của nhà cung cấp ADMIN chọn; giữ cấu hình và khóa API đã mã hóa |
| Web | Khung "Hỏi trợ lý chính sách" trên trang `/documents`; trang "Cấu hình trợ lý" `/admin/assistant` (ADMIN) |
| Database | Schema `assistant` (bảng `document`, `chunk`, `llm_config`), extension `vector` và `unaccent`, DB user `assistant_svc` |
| Dịch vụ ngoài | API của nhà cung cấp LLM: Claude (Anthropic), Google Gemini, DeepSeek; object storage (đọc file) |

## 2. Biến môi trường

Tên đề xuất, chốt trong PR `feat/assistant-service`, `feat/policy-assistant`, `feat/assistant-config`, rồi thêm vào
[configuration.md](../../development/configuration.md). **API key của nhà cung cấp LLM không nằm trong biến môi trường:** ADMIN
dán trên trang "Cấu hình trợ lý", lưu mã hóa trong `assistant.llm_config` (FR-6.4, ADR-16 mục 7).

| Biến | Nơi đọc | Local | Staging | Thiếu thì sao |
|---|---|---|---|---|
| `ASSISTANT_CONFIG_KEY` | Assistant service | Chuỗi 32 byte base64 trong `.env` cá nhân | Secrets Manager | Service không khởi động (không mã hóa, giải mã được khóa API) |
| `ASSISTANT_LLM_TIMEOUT_MS` | Assistant service | `10000` | `10000` | Dùng mặc định |
| `ASSISTANT_URL`, `ASSISTANT_INTERNAL_TOKEN` | API | `http://localhost:3100`, chuỗi bất kỳ | URL nội bộ, Secrets Manager | API trả `fallback = true`, câu "Trợ lý tạm thời không dùng được" |
| `ASSISTANT_DB_URL` | Assistant service | User `assistant_svc` | User `assistant_svc` | Service không chạy |
| `STORAGE_*` | Assistant service | Như UC5, quyền chỉ đọc | Như UC5, IAM chỉ đọc bucket | Không trích được văn bản; tài liệu mới không vào index |
| Nhóm `assistant` trong `RATE_LIMIT_OVERRIDES` | API | Mặc định 10/phút, 100/ngày | Như local; nâng tạm khi chạy bộ đánh giá | – |

## 3. Hạ tầng

| Môi trường | Tài nguyên | File |
|---|---|---|
| Local | PostgreSQL đổi image sang `pgvector/pgvector:pg16`; RabbitMQ thêm queue `assistant.document`; S3Mock như UC5 | `docker-compose.yml` |
| Staging | RDS bật extension `vector`; SQS `assistant.document` + DLQ, subscription SNS lọc `document.*`; task Fargate assistant khoảng 1 GB RAM (model embedding); secret `ASSISTANT_CONFIG_KEY`; security group, NAT cho phép gọi HTTPS ra API của ba nhà cung cấp | `infra/staging/` (nhánh `infra/llm-secrets-cost`) |

## 4. Các bước

1. Migration tạo schema `assistant`, extension `vector`, `unaccent` (cần quyền `rds_superuser` trên RDS, chạy bằng user migration).
2. Tạo API key ở nhà cung cấp định dùng, nạp credit trả trước hoặc đặt giới hạn chi tiêu ở đó. ADMIN dán khóa trên
   `/admin/assistant`, bấm "Kiểm tra kết nối" rồi lưu.
3. Sau khi deploy assistant service: chạy lệnh đồng bộ lần đầu (UC5 13.2) để index tài liệu đã đăng trước đó.
4. Chạy bộ đánh giá của TV2 trên staging với từng nhà cung cấp định demo, ghi tỉ lệ đúng, độ trễ, chi phí mỗi câu vào báo cáo
   tuần 12.

## 5. Kiểm tra sau deploy

1. Hỏi một câu có trong tài liệu được xem: có câu trả lời và trích dẫn đúng tài liệu, phiên bản.
2. Hỏi một câu chỉ có đáp án trong tài liệu ngoài phạm vi: "không tìm thấy".
3. Tắt trợ lý trên `/admin/assistant` hoặc lưu một khóa sai: nhân viên hỏi nhận danh sách tài liệu, không lỗi 5xx.
   Đổi sang nhà cung cấp khác: câu hỏi kế tiếp dùng nhà cung cấp mới; `GET` cấu hình chỉ trả 4 ký tự cuối của khóa.
4. Hỏi 11 câu trong một phút: câu thứ 11 nhận 429.
5. Grep log của API và assistant service: không có nội dung câu hỏi, không có API key.

## 6. Rollback và sự cố

- Rollback assistant service không ảnh hưởng UC5: module document vẫn ghi outbox, event chờ trong queue và được xử lý khi service
  chạy lại.
- Index hỏng: xóa dữ liệu schema `assistant` rồi chạy lại lệnh đồng bộ lần đầu.
- Chi phí bất thường hoặc lộ khóa: ADMIN tắt trợ lý trên `/admin/assistant` và thu hồi khóa ở trang của nhà cung cấp; trợ lý tự
  lùi về danh sách tài liệu (A2 trong spec).
- Mất `ASSISTANT_CONFIG_KEY`: không giải mã được khóa đã lưu; tạo khóa mới, ADMIN dán lại API key.
- Phần vector gây lỗi hoặc chậm: tắt nhánh vector bằng cấu hình, chỉ dùng full-text (phương án cắt của ADR-16).

## 7. Còn thiếu

Toàn bộ UC6 chưa có trên `dev`. Cập nhật file này trong PR `feat/assistant-service`, `feat/policy-assistant`, `feat/assistant-config`.
