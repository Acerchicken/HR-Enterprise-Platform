# UC6 – Trợ lý chính sách: yêu cầu và tiêu chí chấp nhận

> Đọc file này trước khi mở nhánh làm UC6. Luồng chi tiết: [spec.md](spec.md). Nguồn FR: [SRS mục 4.6](../../requirements/SRS.md#46-uc6--trợ-lý-chính-sách-fr-6x).
> Quy tắc: [document-rules.md](../../business/document-rules.md) (DR-02, DR-06, DR-08), [ADR-16](../../architecture/adr/ADR-16-policy-assistant.md) (cách làm), [ADR-15](../../architecture/adr/ADR-15-service-extraction.md) (assistant service).
> Mỗi tiêu chí `AC-x.y.z` là một ca kiểm thử.

Từ 22/11/2026 UC6 chỉ còn trợ lý hỏi đáp. Hai yêu cầu cũ đã bỏ vì trùng tính năng có sẵn:

- FR-6.1 (ô tìm đồng nghiệp trên nav bar): chuyển về UC2 ([AC-2.1.6 → AC-2.1.9](../UC2-organization/requirements.md#fr-21-danh-bạ-m-đã-có)),
  đã có trong code.
- FR-6.2 (tìm tài liệu theo từ khóa trong tiêu đề và nội dung): bỏ, nhân viên xem danh sách tài liệu của UC5. Số FR không dùng lại.

## 1. User story

| Mã | Là | Tôi muốn | Để | FR |
|---|---|---|---|---|
| US-6.3 | Nhân viên | Hỏi trợ lý bằng câu tự nhiên trên trang "Tra cứu tài liệu" và nhận câu trả lời có trích dẫn | Có câu trả lời nhanh mà không phải hỏi HR, kiểm lại được ở tài liệu gốc | FR-6.3 |

## 2. Tiêu chí chấp nhận

### FR-6.3 Trợ lý chính sách (S, chưa có, tuần 12)

Khung hỏi trợ lý nằm trên trang "Tra cứu tài liệu" (`/documents`) của UC5, cạnh danh sách tài liệu; không có trang riêng.

- **AC-6.3.1** Khi hỏi câu có đáp án trong tài liệu được xem. Thì câu trả lời kèm trích dẫn (tài liệu, phiên bản, mục); mỗi ý
  dẫn về tài liệu nguồn; bấm trích dẫn mở đúng tài liệu.
- **AC-6.3.2** Giả sử đáp án chỉ có trong tài liệu ngoài phạm vi. Khi hỏi. Thì trợ lý trả lời không tìm thấy và gợi ý liên hệ
  HR; câu trả lời, trích dẫn và danh sách tài liệu không chứa gì của tài liệu đó (DR-08).
- **AC-6.3.3** Khi câu hỏi yêu cầu bỏ qua phân quyền hoặc tiết lộ tài liệu khác (prompt injection). Thì không có nội dung ngoài
  phạm vi trong câu trả lời, vì đoạn văn bản đã lọc phạm vi trước khi gửi LLM.
- **AC-6.3.4** Khi LLM quá 10 giây, lỗi, từ chối trả lời, hoặc chưa cấu hình khóa. Thì trả `fallback = true` kèm danh sách tài
  liệu liên quan thay cho câu trả lời, không lỗi 5xx (NFR-3.5).
- **AC-6.3.5** Trên bộ câu hỏi đánh giá của TV2, đạt ngưỡng trong [ADR-16](../../architecture/adr/ADR-16-policy-assistant.md):
  ít nhất 80% câu trả lời đúng và trích đúng tài liệu; 100% câu ngoài phạm vi, prompt injection không lộ nội dung.
- **AC-6.3.6** Khi một người hỏi quá 10 câu trong một phút hoặc quá 100 câu trong một ngày. Thì trả 429 kèm `Retry-After`
  (NFR-5.21). Câu hỏi rỗng hoặc dài quá 500 ký tự thì trả 400 kèm `fields.question`.
- **AC-6.3.7** Giả sử nhân viên vừa đổi đơn vị, hoặc tài liệu vừa bị ẩn. Khi hỏi lại. Thì câu trả lời theo phạm vi mới, không
  dùng tài liệu đã ẩn (DR-06). Giả sử HR vừa đăng bản mới. Khi index xong (vài giây). Thì trích dẫn ghi phiên bản mới.

Không lưu câu hỏi, câu trả lời vào database, audit hay log; lịch sử hỏi chỉ nằm trong trang đang mở.

## 3. Yêu cầu phi chức năng liên quan

NFR-1.3 (trợ lý p95 ≤ 6 s khi LLM bình thường, với 500 tài liệu); NFR-3.5 (timeout gọi LLM ≤ 10 s); NFR-5.21 (10 câu/phút,
100 câu/ngày mỗi người); NFR-7.1 (chi phí LLM trong ngân sách); NFR-11.1 (không giữ dữ liệu cá nhân ngoài mục đích).

## 4. Việc còn lại

Lịch làm theo [kế hoạch hoàn thành từng chức năng](../../progress/ke-hoach-tong.md#77-bước-5--uc6-trợ-lý-chính-sách-t2-2311--t6-2711).

| Việc | Tiêu chí | Người | Nhánh | Tuần |
|---|---|---|---|---|
| ADR-16 và sửa tài liệu UC6 sau khi thu gọn | AC-6.3.5 | TV1 | `docs/adr-16-policy-assistant` | 12 |
| Event tài liệu qua `document.outbox`, lệnh đồng bộ lần đầu (UC5 13.2) | AC-5.4.1 → AC-5.4.4 | TV1 | `feat/assistant-service` (bước đầu) | 12 |
| `services/assistant`: nhận event, trích văn bản, chia đoạn, index full-text và vector | AC-6.3.7 | TV1 | `feat/assistant-service` | 12 |
| API hỏi đáp, gọi Claude, trích dẫn, fallback, giới hạn tần suất, khung trợ lý trên `/documents` | AC-6.3.1 → AC-6.3.4, AC-6.3.6 | TV1 | `feat/policy-assistant` | 12 |
| Bộ câu hỏi đánh giá có đáp án (ít nhất 30 câu) | AC-6.3.1 → AC-6.3.3, AC-6.3.5 | TV2 | `docs/assistant-eval-set` | 12 |
| Khóa Claude API trong Secrets Manager, RDS bật `vector`, cấu hình task assistant | NFR-7.1 | TV3 | `infra/llm-secrets-cost` | 12 |
| Chạy bộ đánh giá, đo độ trễ và chi phí mỗi câu | AC-6.3.x | TV4 | `docs/assistant-eval-report` | 13 |
