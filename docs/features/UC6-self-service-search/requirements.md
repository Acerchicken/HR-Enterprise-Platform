# UC6 – Tự tra cứu: yêu cầu và tiêu chí chấp nhận

> Đọc file này trước khi mở nhánh làm UC6. Luồng chi tiết: [spec.md](spec.md). Nguồn FR: [SRS mục 4.6](../../requirements/SRS.md#46-uc6--tự-tra-cứu-fr-6x).
> Quy tắc: [document-rules.md](../../business/document-rules.md) (DR-02, DR-07, DR-08), [ADR-13](../../architecture/adr/ADR-13-document-storage.md).
> Mỗi tiêu chí `AC-x.y.z` là một ca kiểm thử.

## 1. User story

| Mã | Là | Tôi muốn | Để | FR |
|---|---|---|---|---|
| US-6.1 | Nhân viên | Tìm đồng nghiệp | Liên lạc đúng người | FR-6.1 |
| US-6.2 | Nhân viên | Tìm tài liệu theo từ khóa trong tiêu đề và nội dung | Tìm ra chính sách mà không cần biết tên file | FR-6.2 |
| US-6.3 | Nhân viên | Hỏi trợ lý bằng câu tự nhiên và nhận câu trả lời có trích dẫn | Có câu trả lời nhanh, kiểm lại được ở tài liệu gốc | FR-6.3 |

## 2. Tiêu chí chấp nhận

### FR-6.1 Tìm đồng nghiệp (M, đã có)

Như [UC2 FR-2.1](../UC2-organization/requirements.md#fr-21-danh-bạ-m-đã-có) (AC-2.1.1 → AC-2.1.4).

### FR-6.2 Tìm tài liệu (M, chưa có)

- **AC-6.2.1** Khi tìm một từ có trong nội dung (không có trong tiêu đề) của tài liệu trong phạm vi. Thì tài liệu có trong kết
  quả.
- **AC-6.2.2** Giả sử tài liệu ngoài phạm vi có tiêu đề khớp đúng từ khóa. Khi tìm. Thì kết quả rỗng: không số lượng, tiêu đề,
  trích đoạn hay gợi ý nào (DR-08).
- **AC-6.2.3** Khi có ba tài liệu: khớp nguyên tiêu đề, khớp một phần tiêu đề, chỉ khớp nội dung. Thì kết quả theo đúng thứ tự
  đó; cùng mức thì bản cập nhật mới hơn trước, rồi theo tiêu đề (DR-07).
- **AC-6.2.4** Khi tìm với từ khóa rỗng. Thì trả danh sách như UC5, mới cập nhật trước. Khi kèm `type`. Thì chỉ trả loại đó.
- **AC-6.2.5** Giả sử nhân viên vừa đổi phòng ban. Khi tìm lại ngay. Thì kết quả theo phòng ban mới (DR-06).
- **AC-6.2.6** Tài liệu ẩn và phiên bản chưa `READY` không bao giờ có trong kết quả.
- **AC-6.2.7** Khi một người dùng gọi tìm kiếm quá 20 lần trong một phút. Thì trả 429 (NFR-5.21, nhánh
  `feat/security-headers-ratelimit`).

### FR-6.3 Trợ lý chính sách (C, chưa có, tuần 12)

- **AC-6.3.1** Khi hỏi câu có đáp án trong tài liệu được xem. Thì câu trả lời kèm trích dẫn (tài liệu, phiên bản); mỗi ý dẫn
  về tài liệu nguồn.
- **AC-6.3.2** Giả sử đáp án chỉ có trong tài liệu ngoài phạm vi. Khi hỏi. Thì trợ lý trả lời không tìm thấy và gợi ý liên hệ
  HR; câu trả lời không chứa nội dung tài liệu đó.
- **AC-6.3.3** Khi câu hỏi yêu cầu bỏ qua phân quyền hoặc tiết lộ tài liệu khác (prompt injection). Thì không có nội dung ngoài
  phạm vi trong câu trả lời, vì đoạn văn bản đã lọc phạm vi trước khi gửi LLM.
- **AC-6.3.4** Khi LLM quá 10 giây hoặc lỗi. Thì trả danh sách tài liệu gốc liên quan thay cho câu trả lời (NFR-3.5).
- **AC-6.3.5** Trên bộ câu hỏi đánh giá của TV2, tỉ lệ trả lời đúng và có trích dẫn đạt ngưỡng chốt trong ADR-14.

## 3. Yêu cầu phi chức năng liên quan

NFR-1.3 (tìm kiếm p95 < 1 s với 2.000 nhân viên, 500 tài liệu); NFR-3.5 (timeout gọi LLM ≤ 10 s); NFR-5.21 (20 request tìm
kiếm mỗi phút); NFR-7.1 (chi phí LLM trong ngân sách).

## 4. Việc còn lại

Lịch làm theo [kế hoạch theo chức năng tuần 11–13](../../progress/tuan-04-ke-hoach-tong.md#7-kế-hoạch-theo-chức-năng-tuần-11--13).

| Việc | Tiêu chí | Người | Nhánh | Tuần |
|---|---|---|---|---|
| Trích văn bản, full-text, API và giao diện tìm tài liệu | AC-6.2.1 → AC-6.2.6 | TV1 | `feat/document-search` | 10, chưa xong thì đầu tuần 11 |
| Giới hạn 20 request tìm kiếm mỗi phút | AC-6.2.7 | TV1 | `feat/security-headers-ratelimit` | 11 |
| Ca kiểm thử tìm tài liệu | AC-6.2.x | TV4 | `docs/test-cases-week11` | 11 |
| ADR-14: cách truy hồi, nhà cung cấp LLM, ngưỡng đánh giá | AC-6.3.5 | TV1 | `docs/adr-14-policy-assistant` | 12 |
| Bộ câu hỏi đánh giá có đáp án | AC-6.3.1 → AC-6.3.3, AC-6.3.5 | TV2 | `docs/assistant-eval-set` | 12 |
| Trợ lý: API, giao diện, timeout, trích dẫn | AC-6.3.1 → AC-6.3.4 | TV1 | `feat/policy-assistant` | 12 |
| Khóa API LLM trong Secrets Manager, cảnh báo chi phí | NFR-7.1 | TV3 | `infra/llm-secrets-cost` | 12 |
| Chạy bộ đánh giá, đo độ trễ và chi phí mỗi câu | AC-6.3.x | TV4 | `docs/assistant-eval-report` | 12 |
