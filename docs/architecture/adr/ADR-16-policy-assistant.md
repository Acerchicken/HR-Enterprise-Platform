# ADR-16 – Trợ lý chính sách: truy hồi lai full-text và pgvector trong PostgreSQL, trả lời bằng Claude API

| Mục | Nội dung |
|---|---|
| Trạng thái | **Đề xuất** (Duong chọn ngày 23/11/2026) |
| Ngày quyết định | Ngày merge PR |
| Thời điểm | Tuần 12 (23/11 – 30/11/2026) |
| Người viết | TV1 (Dương) |
| Góc nhìn | Cả hai |
| ADR liên quan | ADR-01, ADR-02, ADR-07, ADR-12, ADR-13, ADR-15, ADR-18 |
| Yêu cầu liên quan | FR-6.3, AC-6.3.1 → AC-6.3.7, NFR-1.3, NFR-3.5, NFR-5.21, NFR-7.1 (SRS) |

## Lịch sử thay đổi

- 22/11/2026: Duong thu gọn UC6 chỉ còn trợ lý hỏi đáp. Ô tìm đồng nghiệp (FR-6.1 cũ) trùng UC2, tìm tài liệu theo từ khóa
  (FR-6.2 cũ) trùng UC5. Đề xuất các hướng triển khai trong thread "Thu gọn UC6 thành hỏi đáp AI".
- 23/11/2026: Duong chọn phương án A trên thẻ quyết định ("Full-text + pgvector, Claude API").

## Nội dung quyết định

**Bối cảnh:**

- Nhân viên hỏi bằng câu tự nhiên tiếng Việt ("nghỉ cưới được mấy ngày"), trong khi tài liệu viết theo văn bản hành chính
  ("người lao động kết hôn được nghỉ 3 ngày"). Tìm theo từ khóa dễ trượt khi câu hỏi và tài liệu khác chữ.
- Câu trả lời chỉ được dựa trên tài liệu người hỏi được xem (DR-02, DR-08). Phạm vi tính lại ở mỗi lần hỏi (DR-06).
- Quy mô: 500 tài liệu, 2.000 nhân viên (NFR-1.3). Timeout gọi LLM 10 giây (NFR-3.5).
- Ngân sách AWS: dự toán 56,80 USD/tháng, hạn mức thẻ 60 USD, chỉ dư khoảng 3 USD (ADR-12).
- ADR-15 đã có service tách riêng nhận event tài liệu qua `document.outbox` ([UC5 spec 13.2](../../features/UC5-document-repository/spec.md#132-event-cho-tìm-kiếm-adr-15)).
  Khi bỏ tìm tài liệu, service này chỉ còn phục vụ trợ lý.
- Feature freeze 2/12/2026, chỉ TV1 code (ADR-11).

**Các giải pháp truy hồi:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | Lai full-text và pgvector trong PostgreSQL | Chia tài liệu thành đoạn; mỗi đoạn có `tsvector` và vector embedding. Lấy đoạn theo cả hai cách, gộp thứ hạng, lọc phạm vi trong cùng câu SQL |
| B | Chỉ full-text PostgreSQL | Như A nhưng không có vector |
| C | Amazon Bedrock Knowledge Bases | AWS lo chia đoạn, embedding và tìm; lọc phạm vi bằng metadata |
| D | Đưa toàn bộ tài liệu được xem vào prompt | Không có index; gửi văn bản mọi tài liệu trong phạm vi cho LLM |

**Tiêu chí lựa chọn truy hồi** (điểm 1–5, không trọng số):

| Tiêu chí | A | B | C | D |
|---|---|---|---|---|
| Tìm đúng khi câu hỏi khác chữ với tài liệu | 5 | 2 | 5 | 5 |
| Không lộ tài liệu ngoài phạm vi (lọc trước khi gửi LLM) | 5 | 5 | 3 | 5 |
| Chi phí trong ngân sách ADR-12 | 5 | 5 | 1 | 2 |
| Đáp ứng 500 tài liệu, 10 giây | 5 | 5 | 4 | 1 |
| Chạy được ở local giống staging | 4 | 5 | 1 | 5 |
| Giữ kiến trúc event của ADR-15 | 5 | 5 | 2 | 3 |
| Xong trước 2/12 | 3 | 5 | 2 | 4 |

C bị loại vì vector store mặc định (OpenSearch Serverless) tốn hàng trăm USD/tháng và metadata phạm vi phải đồng bộ riêng.
D bị loại vì 500 tài liệu vượt cửa sổ ngữ cảnh hợp lý và mỗi câu hỏi tốn tiền theo cả kho.

**Các giải pháp nhà cung cấp LLM:**

| # | Giải pháp | Mô tả |
|---|---|---|
| P1 | Claude API trực tiếp | Khóa API trong Secrets Manager; trả trước bằng credit |
| P2 | Claude qua Amazon Bedrock | IAM role, tính tiền vào tài khoản AWS |

| Tiêu chí | P1 | P2 |
|---|---|---|
| Chi phí có trần cứng, không đụng hạn mức thẻ AWS | 5 | 2 |
| Local và staging chạy giống nhau | 5 | 3 |
| Không phải giữ khóa bí mật | 3 | 5 |
| Có ngay model và tính năng mới (trích dẫn) | 5 | 4 |

**Giải pháp được chọn:** A và P1. Truy hồi lai bắt được câu hỏi khác chữ; mọi thứ nằm trong PostgreSQL sẵn có nên không thêm
chi phí AWS; credit trả trước của Claude API là trần cứng cho chi phí LLM.

Cụ thể:

1. **Vị trí:** service `services/assistant/` (đổi tên từ search service của ADR-15), schema `assistant`, DB user `assistant_svc`
   chỉ có quyền trên schema đó. Service nhận event `document.*` (UC5 spec 13.2), không đọc schema khác.
2. **Index:**
   - Bảng `assistant.document`: `id`, `title`, `type`, `version_id`, `version_no`, `hidden`, phạm vi (`scope_all`,
     `scope_department_ids uuid[]`, `scope_roles text[]`). Event ghi đè cả bộ.
   - Bảng `assistant.chunk`: `document_id`, `version_id`, `ord`, `heading` (mục, điều, trang để trích dẫn), `content`,
     `tsv tsvector`, `embedding vector(384)`. Chỉ giữ đoạn của phiên bản `READY` mới nhất.
   - Chỉ mục GIN cho `tsv`, HNSW (cosine) cho `embedding`.
3. **Ingest:** khi nhận `DocumentPublished`, service đọc file từ storage bằng quyền chỉ đọc, trích văn bản PDF, DOCX, chia đoạn
   khoảng 1.500 ký tự theo tiêu đề và đoạn văn (chồng 200 ký tự), tính embedding rồi thay toàn bộ đoạn của tài liệu trong một
   transaction. Trích lỗi thì ghi log, tài liệu không có đoạn (trợ lý không dùng được tài liệu đó, không ảnh hưởng UC5).
4. **Embedding:** model đa ngôn ngữ nhỏ chạy ngay trong service (đề xuất `multilingual-e5-small`, 384 chiều, bản ONNX qua
   `@huggingface/transformers`), đóng sẵn vào image. Không gọi dịch vụ ngoài, không tốn tiền theo lượt, local và staging như nhau.
5. **Truy hồi khi hỏi:**
   - API (vai trò BFF, ADR-15) tính phạm vi hiện tại của người hỏi: đơn vị hiện tại và mọi đơn vị cha (ADR-14), vai trò
     (ADR-18). Người không có hồ sơ đang làm việc có phạm vi rỗng.
   - API gọi nội bộ assistant service kèm câu hỏi và phạm vi.
   - Service lấy 20 đoạn theo full-text (`unaccent`, cấu hình `simple`) và 20 đoạn theo vector, cả hai câu đều có điều kiện
     `NOT hidden AND (scope_all OR scope_department_ids && $units OR scope_roles && $roles)`; gộp bằng Reciprocal Rank Fusion,
     lấy tối đa 6 đoạn.
   - Không có đoạn nào vượt ngưỡng liên quan (chỉnh theo bộ đánh giá) thì trả "không tìm thấy" ngay, không gọi LLM.
6. **Sinh câu trả lời:** model `claude-haiku-5-5` qua SDK `@anthropic-ai/sdk`. Mỗi đoạn gửi dưới dạng khối `search_result`
   (nguồn `doc:{documentId}:v{versionNo}`, tiêu đề, mục) bật trích dẫn, nên câu trả lời có trích dẫn do API trả về, không phải
   do model tự viết. System prompt: chỉ trả lời từ các đoạn được đưa; không có thì nói không tìm thấy và gợi ý liên hệ HR; câu hỏi
   về trường hợp riêng của một người thì chỉ tới HR; trả lời tiếng Việt, ngắn.
7. **Thời gian và lỗi:** timeout 10 giây, không tự thử lại. Quá thời gian, lỗi, model từ chối, hoặc thiếu khóa API thì trả
   `fallback = true` kèm danh sách tài liệu của các đoạn tìm được (AC-6.3.4).
8. **Giới hạn và chi phí:** câu hỏi 1–500 ký tự; nhóm giới hạn `assistant` 10 câu/phút và 100 câu/ngày mỗi người (NFR-5.21).
   Mỗi câu khoảng 3.000 token vào, 400 token ra, ước dưới 0,002 USD. Credit trả trước 5–10 USD; đặt giới hạn chi tiêu của workspace
   trên Claude Console.
9. **Dữ liệu cá nhân:** không lưu câu hỏi và câu trả lời vào database, audit hay log. Log chỉ ghi số đoạn, độ trễ, số token,
   lý do fallback, `traceId`. Giao diện nhắc không nhập thông tin cá nhân vào câu hỏi.
10. **Đổi nhà cung cấp:** code gọi LLM qua một interface; chuyển sang Bedrock chỉ cần thêm một cài đặt dùng client Bedrock của
    cùng SDK và đổi cấu hình.

**Không làm:** lưu lịch sử hội thoại phía server, hội thoại nhiều lượt có ngữ cảnh, agent tự gọi công cụ, OpenSearch,
Bedrock Knowledge Bases, dịch vụ embedding trả phí, tìm tài liệu theo từ khóa cho người dùng (đã bỏ khỏi UC6).

**Trade-off:**

- Câu hỏi và các đoạn tài liệu được gửi tới Anthropic, ra ngoài hạ tầng AWS của nhóm. Giảm thiểu: chỉ gửi đoạn đã lọc phạm vi,
  không gửi thông tin hồ sơ, nhắc người dùng không nhập dữ liệu cá nhân.
- Thêm một khóa bí mật (khóa Claude API). Giảm thiểu: Secrets Manager trên staging, `.env` cá nhân ở local, không commit.
- Image assistant lớn thêm khoảng 120 MB vì có model embedding, cần khoảng 1 GB RAM. TV3 tính lại cấu hình task Fargate.
- Image PostgreSQL local đổi sang `pgvector/pgvector:pg16`; RDS phải bật extension `vector` (RDS PostgreSQL 16 có sẵn).
- Index trễ vài giây sau khi đăng tài liệu (eventual consistency, giống ADR-15). Phạm vi vẫn tính đồng bộ nên không lộ dữ liệu.
- Phần pgvector là phần dễ trễ nhất. Phương án cắt: nếu thứ Sáu 27/11 chưa xong thì giao bản chỉ dùng full-text (giải pháp B),
  vẫn đạt AC-6.3.1 → AC-6.3.4; cột `embedding` thêm sau.

**Tiêu chí nghiệm thu:**

- Trên bộ câu hỏi đánh giá của TV2 (ít nhất 30 câu, có đáp án và tài liệu nguồn):
  - ít nhất 80% câu có đáp án trong phạm vi được trả lời đúng và trích đúng tài liệu;
  - 100% câu chỉ có đáp án ngoài phạm vi và câu prompt injection không chứa nội dung tài liệu ngoài phạm vi;
  - p95 độ trễ không quá 6 giây khi LLM chạy bình thường.
- Tắt khóa API hoặc giả LLM trả chậm hơn 10 giây: nhận `fallback = true` kèm danh sách tài liệu, không lỗi 5xx.
- DB user `assistant_svc` truy vấn schema khác bị từ chối; `services/assistant` không import file nào trong `backend/`.
- Câu hỏi không xuất hiện trong log, audit, database (kiểm bằng grep log sau khi chạy bộ đánh giá).

**Khi nào xem lại:** tỉ lệ trả lời đúng dưới 80% sau khi chỉnh chia đoạn và ngưỡng; chi phí thực tế vượt 10 USD/tháng; nhóm
không được dùng dịch vụ AI ngoài AWS; hoặc kho vượt khoảng 5.000 tài liệu.
