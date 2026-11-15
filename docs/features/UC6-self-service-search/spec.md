# UC6 – Tra cứu chung và trợ lý

| Mục | Nội dung |
|---|---|
| Mục tiêu kinh doanh | MT-4 (giảm câu hỏi phải gửi HR) |
| Tác nhân chính | Nhân viên (mọi vai trò) |
| Tác nhân phụ, hệ thống ngoài | LLM API (trợ lý chính sách, tuần 12); worker trích văn bản từ file tài liệu |
| Yêu cầu (SRS) | FR-6.1 → FR-6.3 |
| Quy tắc | [DR-07, DR-08](../../business/document-rules.md), DR-02 (phạm vi xem), ADR-13 |
| Mức ưu tiên | FR-6.1, FR-6.2 là M; FR-6.3 là C |
| Trạng thái | FR-6.1 đã có; FR-6.2 kế hoạch tuần 10; FR-6.3 kế hoạch tuần 12 |
| Phiên bản | 1.2 – 14/11/2026 (ô tìm kiếm trên nav bar chỉ tìm đồng nghiệp; tìm tài liệu và trợ lý AI ở trang "Tra cứu tài liệu") |

## 1. Mô tả ngắn

Nhân viên tự tìm thông tin thay vì hỏi HR, theo ba cách:

1. **Ô tìm đồng nghiệp** trên nav bar, chỉ tìm đồng nghiệp (dùng lại tìm danh bạ của UC2). Danh bạ đầy đủ vẫn là trang của
   UC2.
2. **Tìm tài liệu** theo từ khóa trong tiêu đề và nội dung, chỉ trên tài liệu mình được xem.
3. **Hỏi trợ lý chính sách** bằng câu hỏi tự nhiên. Trợ lý trả lời kèm trích dẫn và chỉ dùng tài liệu người hỏi được xem.

Tìm tài liệu và trợ lý nằm chung một trang **"Tra cứu tài liệu"** (`/documents`), mở bằng ô chức năng ở trang chủ, cùng với
danh sách tài liệu của UC5. Không đặt trên nav bar (quyết định 14/11/2026).

## 2. Tác nhân và quyền

| Tác nhân | Được làm gì | Giới hạn theo dữ liệu |
|---|---|---|
| Nhân viên (mọi vai trò) | Tìm đồng nghiệp, tìm tài liệu, hỏi trợ lý | Kết quả tài liệu và câu trả lời chỉ dựa trên tài liệu trong phạm vi của người hỏi (DR-02), tính lại ở mỗi lần gọi (DR-06) |

## 3. Điều kiện

- **Điều kiện trước:** người dùng đã đăng nhập. Với tìm tài liệu và trợ lý: nội dung file đã được trích văn bản và đánh chỉ mục.
- **Kích hoạt:** nhập từ khóa vào ô tìm kiếm, hoặc gửi câu hỏi cho trợ lý.
- **Điều kiện sau khi thành công:** người dùng nhận kết quả. Hệ thống không thay đổi dữ liệu nghiệp vụ.
- **Điều kiện sau khi thất bại:**
  - Kết quả rỗng; không lộ tài liệu ngoài phạm vi.
  - Nếu trợ lý không trả lời được, hệ thống chỉ tới tài liệu gốc.

## 4. Luồng chính

### 4.1 Ô tìm đồng nghiệp trên nav bar (FR-6.1)

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Gõ từ khóa vào ô tìm kiếm trên nav bar | Chờ 300 ms sau phím cuối, gọi `GET /employees?q=&size=5` (UC2); không gọi API tài liệu |
| 2 | | Hiện tối đa 5 đồng nghiệp |
| 3 | Chọn một đồng nghiệp | Mở thẻ xem nhanh ([giao diện chung mục 4.1](../frontend.md#41-thẻ-xem-nhanh)) |
| 4 | Nhấn Enter | Mở Danh bạ `/directory?q=` |

### 4.2 Tìm tài liệu (FR-6.2)

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Mở "Tra cứu tài liệu" từ trang chủ, nhập từ khóa, có thể chọn loại tài liệu | Gửi yêu cầu tìm kiếm (API sẽ có ở nhánh `feat/document-search`) |
| 2 | | Áp **điều kiện phạm vi trước**, trong cùng truy vấn SQL: chưa ẩn, có phiên bản `READY`, khớp phạm vi (ADR-13) |
| 3 | | Tìm full-text PostgreSQL trong tiêu đề và nội dung phiên bản mới nhất |
| 4 | | Xếp hạng (DR-07): khớp nguyên tiêu đề, rồi khớp một phần tiêu đề, rồi khớp nội dung. Cùng mức thì bản cập nhật mới hơn trước, rồi theo tiêu đề |
| 5 | Xem danh sách kết quả, mở hoặc tải tài liệu | Như UC5 luồng A1 |

### 4.3 Hỏi trợ lý chính sách (FR-6.3, tuần 12)

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Gõ câu hỏi, ví dụ "nghỉ cưới được mấy ngày" | |
| 2 | | Tìm các đoạn văn bản liên quan, **chỉ trong tài liệu người hỏi được xem** |
| 3 | | Gửi câu hỏi và các đoạn tìm được cho LLM, có giới hạn thời gian |
| 4 | Đọc câu trả lời kèm trích dẫn (tài liệu, phiên bản) | Trả câu trả lời; mỗi ý dẫn về tài liệu nguồn |

## 5. Luồng thay thế

- **A1 (4.2 bước 1), không nhập từ khóa:** trả danh sách tài liệu như UC5, mới cập nhật trước.
- **A2 (4.3 bước 2), không có đoạn nào liên quan:** trợ lý trả lời rằng không tìm thấy trong tài liệu được xem và gợi ý liên hệ
  HR. Trợ lý không tự bịa câu trả lời.
- **A3 (4.3 bước 3), LLM quá thời gian hoặc lỗi:** trả danh sách tài liệu gốc liên quan thay cho câu trả lời.

## 6. Ngoại lệ

| Mã | Tình huống | Hệ thống phản hồi |
|---|---|---|
| E1 | Chưa đăng nhập | 401 `UNAUTHENTICATED` |
| E2 | Từ khóa chỉ khớp tài liệu ngoài phạm vi | Kết quả rỗng; không có số lượng, tiêu đề, trích đoạn hay gợi ý nào (DR-08) |
| E3 | Gọi tìm kiếm quá nhiều trong một phút | 429, theo NFR-5.21 (kế hoạch tuần 11) |
| E4 | Câu hỏi cố lừa trợ lý bỏ qua phân quyền (prompt injection) | Không ảnh hưởng, vì đoạn văn bản đã được lọc phạm vi trước khi gửi LLM |

## 7. Quy tắc áp dụng

- [DR-07](../../business/document-rules.md) cách tìm và xếp hạng; DR-08 không lộ tài liệu ngoài phạm vi.
- DR-02 phạm vi xem; DR-06 quyền tính lại mỗi lần gọi.
- [ADR-13](../../architecture/adr/ADR-13-document-storage.md): full-text PostgreSQL trên cùng điều kiện phạm vi, không thêm dịch
  vụ tìm kiếm riêng.

## 8. Dữ liệu vào

| Trường | Bắt buộc | Kiểm tra |
|---|---|---|
| Từ khóa | Không | Chuỗi; rỗng thì liệt kê như UC5 |
| `type` | Không | `POLICY`, `PROCESS`, `GUIDE`, `FORM`, `NOTICE` |
| Câu hỏi cho trợ lý | Có | Giới hạn độ dài (chốt ở tuần 12) |

## 9. Giao diện và API

| Luồng | Màn hình | API |
|---|---|---|
| 4.1 | Ô tìm kiếm trên nav bar; Enter sang `/directory?q=` | `GET /employees?q=` |
| 4.2 | Trang "Tra cứu tài liệu" `/documents`, ô tìm tài liệu (chưa có) | Chưa có (nhánh `feat/document-search`) |
| 4.3 | Cùng trang `/documents`, khung hỏi trợ lý (chưa có) | Chưa có (tuần 12) |

## 10. Yêu cầu phi chức năng liên quan

- NFR-1.3: tìm kiếm p95 < 1 s với 2.000 nhân viên, 500 tài liệu.
- NFR-3.5: gọi LLM có timeout ≤ 10 s.
- NFR-5.21: giới hạn 20 request tìm kiếm mỗi phút cho mỗi người dùng.
- NFR-7.1: chi phí LLM nằm trong ngân sách staging; đo chi phí mỗi câu hỏi ở tuần 12.

## 11. Kiểm thử

Chiến lược, test đã có, bảng phủ tiêu chí và ca còn thiếu: [test.md](test.md). Cách triển khai: [deploy.md](deploy.md).

## 12. Hiện trạng và việc còn lại

| Nội dung | Trạng thái | Việc còn lại |
|---|---|---|
| Tìm đồng nghiệp | Có trong trang Danh bạ | Ô tìm kiếm trên nav bar: TV1, nhánh `feat/profile-layout` (tuần 11) |
| Trích văn bản, full-text, API và trang "Tra cứu tài liệu" | Chưa có | TV1, nhánh `feat/document-search` (tuần 12) |
| Trợ lý chính sách | Chưa có | Tuần 12; có thể cắt nếu thiếu thời gian (mức C) |

## 13. Thiết kế đề xuất cho phần chưa có

> Đề xuất để có chỗ bám khi code. TV1 chốt trong PR `feat/document-search` (13.1) và ADR-14 (13.2).

### 13.1 Tìm tài liệu (FR-6.2)

- **API:** mở rộng `GET /documents` bằng tham số `q`. Có `q` thì xếp theo DR-07; không có `q` thì giữ thứ tự hiện tại. Mỗi kết
  quả thêm `matchedIn` (`TITLE_EXACT`, `TITLE`, `CONTENT`) và `snippet` (tối đa 200 ký tự, chỉ từ tài liệu đã qua lọc phạm vi).
- **Dữ liệu:** migration thêm `document_version.text_content text`, `document_version.search_vector tsvector`, chỉ mục GIN; cấu
  hình `simple` kèm `unaccent` để tìm tiếng Việt có dấu và không dấu. Tiêu đề so khớp bằng `lower(unaccent(title))`.
- **Trích văn bản:** khi phiên bản thành `READY`, ghi event `DocumentPublished` vào outbox; worker đọc file từ storage, trích văn
  bản (PDF, DOCX), ghi `text_content` và `search_vector`. Lỗi trích thì vẫn tìm được theo tiêu đề. Chỉ tìm nội dung của phiên
  bản `READY` mới nhất.
- **Truy vấn:** dùng lại `visibleQuery` (điều kiện phạm vi, chưa ẩn, có `READY`) rồi mới thêm điều kiện tìm, trong cùng một câu
  SQL (ADR-13). `total` chỉ đếm trên tài liệu đã lọc.
- **Giới hạn:** `q` 1–100 ký tự; 20 request mỗi phút (NFR-5.21).

### 13.2 Trợ lý chính sách (FR-6.3)

- **API:** `POST /assistant/questions` `{ question }` → `{ answer, citations: [{ documentId, versionNo, title }], fallback }`.
  `fallback = true` khi trả danh sách tài liệu thay cho câu trả lời (A2, A3).
- **Truy hồi:** lấy các đoạn văn bản từ tài liệu qua `visibleQuery` của người hỏi, rồi mới gửi LLM. Cách chia đoạn và
  full-text hay `pgvector`: chốt ở ADR-14.
- **Câu trả lời ghi rõ chỉ để tham khảo**, căn cứ là văn bản gốc được trích dẫn; câu hỏi về trường hợp riêng (lương, kỷ luật của
  một người) thì trợ lý chỉ tới HR.
- **Không lưu câu hỏi** vào audit hay log ở dạng đầy đủ (có thể chứa thông tin sức khỏe); chỉ ghi số đoạn, độ trễ, số token.
