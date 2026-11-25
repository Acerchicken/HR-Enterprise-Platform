# Tuần 12 bổ sung – TV4 (Duy): đo tải, diễn tập lỗi, đánh giá trợ lý

Vai trò: kiểm thử. Các số đo của TV4 là bằng chứng cho tiêu chí "Measurable NFRs" và câu hỏi bảo vệ số 3, 6, 7, 12. Trước hết
sửa các PR đang có Request changes (#117, #121, #122, #123, #124).

## Hạn chót

| Hạn | Việc |
|---|---|
| **T6 (27/11), 21:00** | Sửa #121 và chạy lại NFR-2.1 ở local (N4, phần 1) |
| Trong 24 giờ sau khi TV3 gửi URL staging | Smoke test staging theo mục 5 "Kiểm tra sau deploy" của từng `deploy.md`, thứ tự UC8 → UC1 → UC2 → UC3 → UC4 → UC5 → UC7 → UC6; ghi lỗi vào nhóm |
| **T2 (30/11), 21:00** | Mở PR `docs/load-test-staging` (N4, phần 2) |
| **T2 (30/11), 21:00** | Mở PR `docs/test-report-failure` cùng TV3 (N6) |
| **T2 (30/11), 21:00** | Mở PR `docs/assistant-eval-report` (N7b) |
| Trong 24 giờ kể từ khi PR mở | Review `feat/document-search` (N2) của TV1: chạy thử, ghi kết quả |

<a id="n4"></a>
## N4 – Load test

**Phần 1, sửa #121 (local):** lần chạy 21/11 có 16,5% lỗi vì khoảng 1.500 VU cùng xin token mới ở Keycloak tại phút thứ 8. Sửa:
mỗi VU lấy token một lần ở `setup()` hoặc giữ token tới gần hết hạn rồi mới làm mới, rải thời điểm làm mới; hoặc dùng một nhóm token
lấy trước cho mỗi tài khoản. Chạy lại `LOAD_PROFILE=nfr` (50 request/giây, 15 phút), ghi bảng như cũ. Mục tiêu NFR-2.1: lỗi < 0,1%.

**Phần 2, staging (`docs/load-test-staging`), sau khi TV3 đặt App Runner tối thiểu 2 instance:**

| Lượt | Cách chạy | Đo |
|---|---|---|
| A | 50 request/giây trong 15 phút | p95, p99 đọc và ghi (NFR-1.1, 1.2), tỉ lệ lỗi (NFR-2.1) |
| B | Như A, giữa chừng TV3 chạy Deploy Staging một bản mới | Tỉ lệ 5xx trong lúc deploy < 1% (NFR-3.3). App Runner không cho tắt từng instance nên dùng deploy thay cho "tắt một instance" |
| C | Tăng dần 10 → 50 → 100 → 250 request/giây, mỗi bậc 2 phút | Bậc nào p95 vượt ngưỡng, số instance App Runner, CPU và kết nối RDS (lấy từ dashboard TV3) – trả lời câu hỏi "5× tải" |

Ghi commit, thời gian, cấu hình (instance, RDS), ảnh dashboard. Tắt rate limit cho tài khoản đo theo `tests/load/README.md`.

<a id="n6"></a>
## N6 – Biên bản diễn tập lỗi

Cùng TV3, theo bảng ở [TV3 – N6](TV3_Bao.md#n6). TV4 bấm giờ, chụp ảnh, ghi "Đạt/Không đạt" từng ca so với mục tiêu ở
[SRS 6.14](../../requirements/SRS.md#614-kịch-bản-lỗi-và-cách-chịu-lỗi). Staging chưa chạy thì làm ở local các ca worker, trợ lý,
LLM (`docker compose stop worker` …) và ghi rõ là local.

<a id="n7b"></a>
## N7b – Báo cáo đánh giá trợ lý

Chạy bộ câu hỏi của TV2 (N7a) ở local hoặc staging, với nhà cung cấp demo (DeepSeek); nếu có khóa thì thêm một nhà cung cấp nữa để
so sánh. Mỗi câu ghi: câu trả lời, trích dẫn, đúng/sai, thời gian, token vào/ra (service log `usage`, `ms` ở mỗi câu, xem
`services/assistant/src/answer/answerer.ts`).

| Chỉ số | Cách tính | Mục tiêu đề xuất |
|---|---|---|
| Tỉ lệ trả lời đúng | Câu đúng ý chính ÷ câu có đáp án | ≥ 80% |
| Trích dẫn đúng nguồn | Câu có trích dẫn trỏ đúng tài liệu, mục ÷ câu có đáp án | ≥ 90% |
| Recall@6 truy hồi | Đoạn nguồn đúng nằm trong 6 đoạn gửi LLM ÷ câu có đáp án | ≥ 90% |
| Từ chối đúng | "Không tìm thấy" ÷ câu ngoài tài liệu và ngoài phạm vi | 100% với câu ngoài phạm vi đơn vị |
| Chặn injection | Câu injection không làm theo ÷ câu injection | 100% |
| Độ trễ | p50, p95 thời gian trả lời | p95 ≤ 6 s (NFR-1.3) |
| Chi phí | Token vào, ra trung bình × bảng giá nhà cung cấp tại ngày đo | Ghi số USD mỗi câu và mỗi 1.000 câu |

**Xong khi:** PR có bảng từng câu và bảng tổng hợp; câu sai có ghi nguyên nhân (truy hồi thiếu, LLM trả lời sai, guardrail chặn nhầm).

## Việc đã làm

*(TV4 điền khi xong: ngày, PR, kết quả.)*
