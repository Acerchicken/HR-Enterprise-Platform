# Assistant service (UC6)

Service riêng của trợ lý chính sách ([ADR-15](../../docs/architecture/adr/ADR-15-service-extraction.md),
[ADR-16](../../docs/architecture/adr/ADR-16-policy-assistant.md)). Không import code của `backend/`.

Hiện có phần **index** (`feat/assistant-service`): nhận event tài liệu từ queue `assistant.document`, đọc file từ object
storage, trích văn bản PDF (theo trang) và DOCX (theo tiêu đề, "Điều n"), chia đoạn, tính embedding EmbeddingGemma, ghi vào
schema `assistant` (full-text không dấu và vector). Phần hỏi đáp làm ở `feat/policy-assistant`.

| Thư mục | Nội dung |
|---|---|
| `src/ingest/` | Trích văn bản, chia đoạn, ghi index theo event |
| `src/rag/embedders/` | Giao diện `Embedder`, adapter EmbeddingGemma, embedder băm cho test, registry |
| `src/messaging/` | Consumer RabbitMQ (local) và SQS (AWS) |
| `src/cli/` | `download-model` (lúc build image), `reindex-embeddings` (đổi model) |

## Chạy

- Docker (cách thường dùng): `docker compose up -d --build` ở thư mục gốc. Lần build đầu tải model (~300 MB) vào image.
  Kiểm: `curl http://localhost:3100/health`. Index tài liệu đã đăng từ trước: `docker compose exec api node dist/database/sync-document-events.js`.
- Không Docker: `npm ci && npm run build && ASSISTANT_MODEL_DIR=.model-cache npm run download-model`, rồi đặt biến theo
  [configuration.md mục 2a](../../docs/development/configuration.md) và `npm run start:dev`. Chạy thử không cần model:
  `ASSISTANT_EMBEDDING_MODEL=hash-256`.
- Test: `npm test`; thêm `TEST_DB_URL=postgres://hr:hr@localhost:5432/hr` (đã chạy migration của backend) để chạy cả test với
  PostgreSQL.

## Đổi model embedding

Xem đầu file `src/cli/reindex-embeddings.ts` và [ADR-16 mục 4](../../docs/architecture/adr/ADR-16-policy-assistant.md).
