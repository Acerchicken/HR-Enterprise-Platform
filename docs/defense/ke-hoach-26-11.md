# Kế hoạch một ngày T5 (26/11/2026): đóng các việc còn thiếu so với yêu cầu môn học

> Lập tối T4 (25/11) theo yêu cầu của Duong: dồn việc N1 → N12 trong
> [đối chiếu yêu cầu môn học mục 6](doi-chieu-yeu-cau-mon-hoc.md#6-danh-sách-cần-làm-ngay) vào một ngày.
> Hạn trong [kế hoạch tổng mục 8.2](../progress/ke-hoach-tong.md#82-việc-bổ-sung-tới-buổi-bảo-vệ) giữ làm **hạn cuối** nếu việc nào
> trễ. Giờ là giờ Việt Nam. Hiện trạng lúc lập: `dev` 906a68f; TV3 chưa mở PR hạ tầng nào, TV2 chưa mở bộ câu hỏi đánh giá,
> #121 (load test) còn Request changes.

## 1. Nguyên tắc trong ngày

- **Đường găng là staging.** Mọi việc đo, thử lỗi, dashboard trên cloud chờ `apply`. Ai xong việc của mình thì hỗ trợ TV3, không
  ngồi chờ.
- **Ba mốc kiểm:** 12:00, 17:00, 21:00. Tới mốc, mỗi người nhắn trong nhóm một dòng: đã xong gì, link PR, đang chặn ở đâu.
- **Mốc cắt 14:00:** tới 14:00 staging chưa trả `/api/v1/health` 200 thì buổi chiều chuyển sang **phương án local** (mục 4). TV3 vẫn
  làm tiếp staging, hạn cuối T6 (27/11) 21:00; quá hạn đó thì báo giảng viên và demo local (đã thống nhất ở tuần 12).
- **TV1 nhận thêm phần code hạ tầng** để TV3 chỉ còn Terraform lõi, `apply` và vận hành: workflow và Terraform cho trợ lý (F4), job
  e2e trong CI (N9). Báo cáo tuần ghi đúng người viết.
- Mỗi việc vẫn một nhánh, một PR vào `dev`, review trong ngày. Staging **tắt lúc 22:00** theo `infra/README.md` mục 5.3.

## 2. Tối nay T4 (25/11), 21:00 → 23:30

| Người | Việc | Mã | Kết quả trước khi ngủ |
|---|---|---|---|
| TV1 Duong | `feat/document-search`: `q` cho `GET /documents` (tiêu đề, mô tả, không dấu), ô tìm trên `/documents`, e2e, FR-5.4 trong SRS và UC5 | N2 | PR mở |
| TV1 Duong | `feat/notification-service` phần F1 (đọc `MAIL_DRIVER=ses`, gửi bằng SES API) và `fix/trust-proxy` (F5) | N3 | PR mở |
| TV3 Bảo | `infra/idp-hardening` gồm B1 (Cognito: `callback_urls` có `/callback`, MFA `ON`, chỉ admin tạo user, chữ hoa, token 15 phút, refresh 10 giờ, email qua SES, `ALLOW_REFRESH_TOKEN_AUTH`) và Keycloak `passwordPolicy`, `failureFactor: 5` (N8) | N1, N8 | PR mở (hạn này đã có từ tuần 12) |
| TV2 Thanh | `docs/assistant-eval-set`: ít nhất 15/30 câu, đủ 4 loại (có đáp án, ngoài tài liệu, ngoài phạm vi đơn vị, prompt injection) | N7 | Bản nháp đẩy lên nhánh |
| TV4 Duy | Sửa #121: mỗi VU giữ token tới gần hết hạn, không xin token đồng loạt | N4 | Commit lên #121 |

## 3. T5 (26/11) theo giờ

| Giờ | TV1 Duong | TV2 Thanh | TV3 Bảo | TV4 Duy |
|---|---|---|---|---|
| 08:00 → 10:00 | Review, merge N2, N3; review PR `infra/idp-hardening`. Code `feat/observability-basics` (N5): log JSON có `traceId`, `/health` trả commit, metric outbox tồn, timeout kết nối và `statement_timeout` 5 s | Xong `docs/assistant-eval-set` đủ ≥ 30 câu, mở PR **trước 10:00** | Sửa theo review; `infra/profile-files` (F3) và quyền Cognito cho worker (F2); `terraform plan`, gửi dòng `Plan: N to add` cho TV1 | Chạy lại NFR-2.1 ở local (50 request/giây, 15 phút) với #121 đã sửa; đẩy kết quả lên #121 |
| 10:00 → 12:00 | Duyệt plan. Code F4: Terraform cho assistant (ECR `hr-assistant`, SQS + DLQ, task ECS `desired_count = 0`, Cloud Map, secret, IAM) và bước build assistant trong workflow; mở PR cho TV3 review | Review UC6 trên PR của TV4 khi có; bắt đầu N10 (cột trạng thái FR trong SRS) | Bootstrap, ECR, push image, **`apply` lõi**; GitHub Variables; chạy Deploy Staging `run_seed = true` | Chạy bộ đánh giá trợ lý **ở local** với DeepSeek ngay khi bộ câu hỏi merge (không chờ staging) |
| **12:00** | **Mốc 1:** staging có URL chưa; N2, N3, N7 bộ câu hỏi đã merge chưa | | | |
| 13:00 → 15:00 | Merge N5; review và cùng TV3 `apply` F4; `ci/e2e` (N9): job e2e có Postgres trong `ci.yml` | `docs/threat-model-uc5-uc6-cloud` (N11): kho tài liệu, trợ lý (prompt injection trực tiếp, gián tiếp; rò dữ liệu qua LLM; lộ khóa API), Cognito, AWS; sửa T-18 | Dashboard CloudWatch theo 5 SLI + queue, DLQ (`aws_cloudwatch_dashboard`); App Runner tối thiểu 2 instance trong lúc đo; bật MFA test bằng tài khoản `hr` | Smoke test staging theo `deploy.md` mục 5: UC8 → UC1 → UC2 → UC3 → UC4 → UC5 → UC7 → UC6 |
| **14:00** | **Mốc cắt:** staging chưa chạy thì chuyển mục 4 | | | |
| 15:00 → 17:00 | Hỗ trợ đo; sửa lỗi smoke test (nhánh `fix/staging-*`) | N10 xong, mở PR | Theo dõi dashboard khi đo; ghi CPU, kết nối RDS | Load test trên staging: 50 request/giây 15 phút, **deploy bản mới giữa lúc chạy** (NFR-3.3, thay cho tắt instance vì App Runner không cho tắt từng instance); một lượt tăng dần 10 → 250 request/giây (5×, NFR-2.2) |
| **17:00** | **Mốc 2:** có số đo staging chưa; PR nào còn chờ review | | | |
| 17:00 → 19:00 | Cùng diễn tập lỗi (N6) | Review biên bản của TV4 | Diễn tập lỗi (N6): (1) worker `desired-count 0`, tạo đơn, bật lại, email gửi bù; (2) khóa LLM sai → `fallback`; (3) assistant `desired-count 0` → `fallback`; (4) rollback Deploy Staging bằng `image_tag` cũ, bấm giờ; (5) khôi phục RDS về một thời điểm sang instance mới, bấm giờ (RTO), xóa instance sau khi kiểm | Ghi biên bản N6: thời gian, ảnh, kết quả từng ca |
| 19:00 → 21:00 | Đổi ADR-15 → ADR-18 sang "Đã chấp nhận" (N12); cập nhật cột trạng thái ở [đối chiếu yêu cầu](doi-chieu-yeu-cau-mon-hoc.md) và kế hoạch tổng mục 8.1 | Review N4, N7 báo cáo | `docs/slo-dashboard-cost`: ảnh dashboard, chi phí thật của ngày 26/11 (Cost Explorer), dự toán có thêm task assistant và tiền LLM, thống nhất NFR-7.1 với Budgets | Mở PR: `docs/load-test-staging` (N4), `docs/test-report-failure` (N6), `docs/assistant-eval-report` (N7: tỉ lệ đúng, trích dẫn đúng, Recall@6, tỉ lệ chặn injection, p95 độ trễ, token và chi phí mỗi câu) |
| **21:00** | **Mốc 3:** review, merge những PR đủ điều kiện; ghi việc trễ | | | |
| 22:00 | | | Tắt staging (`infra/README.md` mục 5.3) | |

## 4. Phương án local nếu 14:00 staging chưa chạy

| Việc | Làm ở local | Còn nợ trên staging |
|---|---|---|
| N4 load test | Đã có số đo NFR-1, NFR-2.1 ở local (buổi sáng); thêm một lượt tăng dần 10 → 250 request/giây | Đo lại khi staging chạy |
| N6 thử lỗi | `docker compose stop worker` rồi tạo đơn, bật lại, email gửi bù (Mailpit); khóa LLM sai; tắt container assistant; `docker compose stop rabbitmq` rồi tạo đơn | Rollback bằng `image_tag`, khôi phục RDS |
| N5 dashboard | Viết sẵn Terraform `aws_cloudwatch_dashboard`, `validate`, `plan` | Ảnh dashboard thật |
| N7 đánh giá trợ lý | Không phụ thuộc staging | – |

## 5. Không thể xong trong một ngày (ghi rõ để không báo sai)

| Việc | Vì sao | Khi nào |
|---|---|---|
| Chi phí thật "sau 3 ngày" (N5) | Mới có số liệu một ngày | Cập nhật CN (29/11) |
| SLI đo được cả tháng | Staging chỉ bật trong giờ demo | Chỉ báo SLI của các lượt đo |
| Tập bảo vệ, slide, video (N13) | Cần các số đo ở trên trước | T6 (4/12) tập, T2 (7/12) bảo vệ |
| Phần còn lại của `docs/feature-status-final` | Theo kế hoạch sau đóng băng | T5 (3/12) |
| SNS fan-out, tách notification service (ADR-15), tracing | Không do slide yêu cầu trực tiếp; đã có trong tuần 12 | Theo tuần 12, cắt được |

## 6. Nghiệm thu cuối ngày

Ngày 26/11 coi là đạt khi có đủ:

1. URL staging trả `/api/v1/health` 200 và đăng nhập được 4 tài khoản demo, hoặc đã chuyển phương án local và ghi rõ lý do.
2. PR đã merge: N2, N3, N5 (code), N7 bộ câu hỏi, N12.
3. PR đã mở có kết quả chạy thật: N4, N6, N7 báo cáo, N5 chi phí và dashboard, N9, N10, N11.
4. [Đối chiếu yêu cầu môn học](doi-chieu-yeu-cau-mon-hoc.md) và kế hoạch tổng mục 8.1 cập nhật trạng thái theo kết quả trên.
