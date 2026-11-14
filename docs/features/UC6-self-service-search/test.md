# UC6 – Tra cứu chung và trợ lý: kiểm thử

> Tiêu chí: [requirements.md](requirements.md). Cách chạy chung, tài khoản mẫu: [README](../README.md#kiểm-thử).
> Phần tìm đồng nghiệp bên trong FR-6.1 kiểm như [UC2 test](../UC2-organization/test.md); phần gộp, gợi ý, trang `/search` kiểm theo AC-6.1.x.

## 1. Chiến lược

Rủi ro chính là **lộ tài liệu ngoài phạm vi qua kết quả tìm hoặc câu trả lời của trợ lý**. Mọi test tìm kiếm và trợ lý phải có
ít nhất một tài liệu ngoài phạm vi chứa đúng từ khóa hoặc đáp án, để chứng minh lọc phạm vi chạy trước.

| Phần | Mức kiểm thử |
|---|---|
| Tìm tài liệu | Unit: hàm xếp hạng DR-07. e2e: phạm vi, xếp hạng, đổi phòng ban. Hiệu năng: NFR-1.3 với 500 tài liệu |
| Trợ lý | Bộ câu hỏi đánh giá có đáp án (TV2), chạy tự động và chấm; câu ngoài tài liệu; câu prompt injection; LLM lỗi |

## 2. Test tự động đã có

Chưa có: tính năng chưa làm. PR `feat/document-search` và `feat/policy-assistant` phải thêm test vào bảng dưới.

## 3. Bảng phủ tiêu chí

| Tiêu chí | Test tự động | Ca tay | Trạng thái |
|---|---|---|---|
| AC-6.1.1 → AC-6.1.4 | e2e giao diện khi có ô tìm kiếm chung (`feat/document-search`) | `docs/test-cases-week11` | Chưa |
| AC-6.2.1 → AC-6.2.6 | e2e trong `feat/document-search` | `docs/test-cases-week11` | Chưa |
| AC-6.2.7 | e2e trong `feat/security-headers-ratelimit` | `docs/security-test-cases-week11` | Chưa |
| AC-6.3.1 → AC-6.3.3, AC-6.3.5 | Script chạy bộ đánh giá | `docs/assistant-eval-set` | Chưa |
| AC-6.3.4 | e2e với LLM giả trả chậm | – | Chưa |

## 4. Dữ liệu và tài khoản

- Ít nhất 3 tài liệu cho DR-07: một khớp nguyên tiêu đề, một khớp một phần tiêu đề, một chỉ khớp nội dung.
- Một tài liệu ngoài phạm vi của `employee@hr.local` có tiêu đề và nội dung chứa đúng từ khóa thử.
- Bộ câu hỏi đánh giá (TV2): câu hỏi, đáp án, tài liệu nguồn; có câu ngoài tài liệu và câu prompt injection.
- Hiệu năng: 500 tài liệu sinh tự động.

## 5. Cách chạy

Như [UC5 test](../UC5-document-repository/test.md#5-cách-chạy) (cần MinIO). Bộ đánh giá trợ lý: lệnh chốt trong
`feat/policy-assistant`; không chạy trong CI để không tốn chi phí LLM.

## 6. Kiểm thử phi chức năng

- NFR-1.3: tìm tài liệu p95 < 1 s với 500 tài liệu.
- NFR-3.5: LLM quá 10 s thì trả danh sách tài liệu gốc.
- NFR-7.1: chi phí mỗi câu hỏi, ghi vào báo cáo tuần 12.

## 7. Ca còn thiếu (TV4)

Toàn bộ. Viết ca tìm kiếm ở `docs/test-cases-week11` sau khi API xong; ca trợ lý ở tuần 12 cùng bộ đánh giá.
