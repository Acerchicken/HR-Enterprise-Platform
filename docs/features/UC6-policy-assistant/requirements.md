# UC6 – Trợ lý chính sách: yêu cầu và tiêu chí chấp nhận

> Đọc file này trước khi mở nhánh làm UC6. Luồng chi tiết: [spec.md](spec.md). Nguồn FR: [SRS mục 4.6](../../requirements/SRS.md#46-uc6--trợ-lý-chính-sách-fr-6x).
> Quy tắc: [document-rules.md](../../business/document-rules.md) (DR-02, DR-06, DR-08), [ADR-16](../../architecture/adr/ADR-16-policy-assistant.md) (cách làm), [ADR-15](../../architecture/adr/ADR-15-service-extraction.md) (assistant service).
> Mỗi tiêu chí `AC-x.y.z` là một ca kiểm thử.

Từ 22/11/2026 UC6 chỉ còn trợ lý hỏi đáp (FR-6.3) và cấu hình nhà cung cấp AI (FR-6.4). FR-6.1, FR-6.2 đã bỏ, số FR không
dùng lại.

## 1. User story

| Mã | Là | Tôi muốn | Để | FR |
|---|---|---|---|---|
| US-6.3 | Nhân viên | Hỏi trợ lý bằng câu tự nhiên trên trang "Tra cứu tài liệu" và nhận câu trả lời có trích dẫn | Có câu trả lời nhanh mà không phải hỏi HR, kiểm lại được ở tài liệu gốc | FR-6.3 |
| US-6.4 | ADMIN | Chọn nhà cung cấp AI, model và dán API key ngay trong ứng dụng | Đổi nhà cung cấp hoặc khóa mà không phải sửa cấu hình máy chủ, deploy lại | FR-6.4 |

## 2. Tiêu chí chấp nhận

### FR-6.3 Trợ lý chính sách (S, đã code trong `feat/policy-assistant`, tuần 12)

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
- **AC-6.3.8** Khi câu hỏi có số điện thoại, email, số CCCD hoặc số tài khoản. Thì phần đó được thay bằng `[đã ẩn]` trước khi
  gửi nhà cung cấp AI, giao diện báo "Đã ẩn thông tin cá nhân trước khi gửi"; ngày tháng, số điều khoản, số ngày phép không bị
  che (ADR-16 mục 11, G1).
- **AC-6.3.9** Khi câu trả lời của LLM có số điện thoại, email, dãy số dài không có trong tài liệu được trích. Thì phần đó bị che;
  số có trong tài liệu (ví dụ hotline HR) giữ nguyên. Khi câu trả lời lặp lại system prompt, hoặc làm theo lệnh cài trong nội
  dung tài liệu. Thì trả `fallback = true` (G2, G3).

Không lưu câu hỏi, câu trả lời vào database, audit hay log; lịch sử hỏi chỉ nằm trong trang đang mở.

### FR-6.4 Cấu hình nhà cung cấp AI (S, đã code trong `feat/assistant-config`, tuần 12; thêm 23/11/2026)

Trang "Cấu hình trợ lý" (`/admin/assistant`) chỉ cho ADMIN. Trước mắt có ba nhà cung cấp: Claude (Anthropic), Google Gemini,
DeepSeek. Cách làm và cách thêm nhà cung cấp mới: [ADR-16](../../architecture/adr/ADR-16-policy-assistant.md) mục 6, 7.

- **AC-6.4.1** Khi ADMIN chọn nhà cung cấp, dán API key và bấm "Tải danh sách model". Thì danh sách model lấy từ API của nhà cung
  cấp đó; khóa sai thì báo "Khóa không hợp lệ", không lưu gì.
- **AC-6.4.2** Khi ADMIN bấm "Kiểm tra kết nối". Thì hệ thống gửi một câu hỏi ngắn tới model đã chọn và báo thành công kèm độ trễ,
  hoặc lỗi dễ hiểu (khóa sai, model không tồn tại, hết hạn mức, quá thời gian). Có audit `ASSISTANT_CONFIG_TEST`.
- **AC-6.4.3** Khi ADMIN lưu cấu hình. Thì câu hỏi kế tiếp của nhân viên dùng nhà cung cấp và model mới, không cần deploy hay khởi
  động lại; có audit `ASSISTANT_CONFIG_UPDATE` ghi nhà cung cấp, model cũ và mới, 4 ký tự cuối của khóa.
- **AC-6.4.4** Khi xem lại trang cấu hình, gọi `GET` cấu hình, hoặc đọc audit, log. Thì không bao giờ thấy khóa đầy đủ, chỉ 4 ký
  tự cuối. Trong database khóa ở dạng mã hóa (ADR-08).
- **AC-6.4.5** Khi đổi sang nhà cung cấp khác. Thì phải nhập khóa mới mới lưu được (400 `fields.apiKey`). Giữ nguyên nhà cung
  cấp, chỉ đổi model thì không cần nhập lại khóa.
- **AC-6.4.6** Khi người không phải ADMIN (kể cả HR) gọi API cấu hình. Thì trả 403. Khi gửi `version` cũ thì trả 409.
- **AC-6.4.7** Giả sử chưa có cấu hình, hoặc ADMIN tắt trợ lý. Khi nhân viên hỏi. Thì nhận `fallback = true` kèm danh sách tài
  liệu liên quan (như AC-6.3.4).

## 3. Yêu cầu phi chức năng liên quan

NFR-1.3 (trợ lý p95 ≤ 6 s khi LLM bình thường, với 500 tài liệu); NFR-5.17, NFR-5.18 (khóa API mã hóa, không lộ qua log, audit); NFR-3.5 (timeout gọi LLM ≤ 10 s); NFR-5.21 (10 câu/phút,
100 câu/ngày mỗi người); NFR-7.1 (chi phí LLM trong ngân sách); NFR-11.1 (không giữ dữ liệu cá nhân ngoài mục đích).

## 4. Việc còn lại

Lịch làm theo [kế hoạch hoàn thành từng chức năng](../../progress/ke-hoach-tong.md#77-bước-5--uc6-trợ-lý-chính-sách-t2-2311--t6-2711).

| Việc | Tiêu chí | Người | Nhánh | Tuần |
|---|---|---|---|---|
| ADR-16 và sửa tài liệu UC6 sau khi thu gọn | AC-6.3.5 | TV1 | `docs/adr-16-policy-assistant` | 12 |
| Event tài liệu qua outbox chung, lệnh đồng bộ lần đầu (UC5 13.2) | AC-5.4.1 → AC-5.4.4 | TV1 | `feat/assistant-service` (bước đầu) | 12 |
| `services/assistant`: nhận event, trích văn bản, chia đoạn, index full-text và vector | AC-6.3.7 | TV1 | `feat/assistant-service` | 12 |
| API hỏi đáp, adapter `openai-compatible` (DeepSeek), trích dẫn, fallback, giới hạn tần suất, khung trợ lý trên `/documents` | AC-6.3.1 → AC-6.3.4, AC-6.3.6 | TV1 | `feat/policy-assistant` | 12 |
| Trang "Cấu hình trợ lý", lưu khóa mã hóa, audit; adapter `anthropic`, `google` | AC-6.4.1 → AC-6.4.7 | TV1 | `feat/assistant-config` | 12–13 |
| Bộ câu hỏi đánh giá có đáp án (ít nhất 30 câu), chạy được với mọi nhà cung cấp | AC-6.3.1 → AC-6.3.3, AC-6.3.5 | TV2 | `docs/assistant-eval-set` | 12 |
| Khóa mã hóa cấu hình (`ASSISTANT_CONFIG_KEY`) trong Secrets Manager, RDS bật `vector`, task assistant, cho phép gọi ra API của ba nhà cung cấp | NFR-7.1 | TV3 | `infra/llm-secrets-cost` | 12 |
| Chạy bộ đánh giá, đo độ trễ và chi phí mỗi câu | AC-6.3.x | TV4 | `docs/assistant-eval-report` | 13 |
