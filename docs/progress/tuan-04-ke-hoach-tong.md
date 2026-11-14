# Tuần 4 (28/9 – 5/10) – Khởi động và kế hoạch tổng 10 tuần

Nhóm chọn đề tài số 3 – **Enterprise HR Platform**. MVP tập trung vào một luồng nghiệp vụ end-to-end:
nhân viên tạo đơn nghỉ phép → quản lý duyệt → HR xử lý → hoàn tất, có phân quyền theo vai trò, audit và kho tài liệu
chính sách HR. AI assistant hỏi đáp chính sách là phần mở rộng ở tuần 12.

Thread trên Discussions: **[Tên nhóm]_Enterprise HR Platform**. Mỗi báo cáo thứ 2 hàng tuần là một reply trong thread này.

## 1. Các công việc đã hoàn thành

| Thành viên | Công việc đã hoàn thành |
|---|---|
| TV1 (Duong, nhóm trưởng) | Chọn đề tài, xác định phạm vi MVP; lập kế hoạch 10 tuần; phân vai trong nhóm; tạo thread trên Discussions |
| TV2 (Thanh) | Đọc yêu cầu đề tài, đề xuất danh sách use case và entity ban đầu |
| TV3 (Bảo) | Tìm hiểu quy trình HR (hồ sơ nhân viên, nghỉ phép) làm cơ sở viết requirements |
| TV4 (Duy) | Tạo repo GitHub và board quản lý công việc; tìm hiểu các cloud provider và chương trình credit cho sinh viên |

## 2. Phân công vai trò (4 người)

Phân vai có hai giai đoạn. Giai đoạn phân tích, thiết kế (tuần 4–6) theo phân vai ban đầu. Từ giai đoạn code (tuần 7),
thực tế chỉ TV1 code nên nhóm điều chỉnh theo [ADR-11](../architecture/adr/ADR-11-role-adjustment.md).

### Từ tuần 7 (đang áp dụng)

| Mã | Thành viên | Vai trò | Phụ trách chính |
|---|---|---|---|
| TV1 | Duong – nhóm trưởng | Code chính + Solution architect | Toàn bộ code backend và frontend, kiến trúc và ADR, review và merge PR, báo cáo thứ 2; AI assistant (tuần 12) |
| TV2 | Thanh | Nghiệp vụ | Business rule từng use case trước khi code, quy trình nghiệp vụ, giữ requirements/NFR cập nhật, đối chiếu code với requirements |
| TV3 | Bảo | Cloud, IaC, CI/CD | Chọn cloud provider, chi phí, hạ tầng local (docker-compose), CI/CD, IaC, deploy, monitoring |
| TV4 | Duy | Ca kiểm thử + một phần nghiệp vụ | Danh mục và quy định nhỏ (loại phép, ngày lễ), ca kiểm thử từ business rule, kiểm thử chức năng cuối tuần; load test (tuần 11) |

### Tuần 4–6 (phân vai ban đầu)

| Mã | Thành viên | Vai trò | Phụ trách chính trong 10 tuần |
|---|---|---|---|
| TV1 | Duong – nhóm trưởng | Project lead + Solution architect | Kế hoạch, báo cáo thứ 2, kiến trúc tổng thể và ADR, review code; backend module Leave (workflow nghỉ phép); AI assistant (tuần 12) |
| TV2 | Thanh | Backend developer | Data model, API spec; module Employee, Organization, Identity & Access, Audit, Search |
| TV3 | Bảo | Frontend developer + Business analyst | Requirements, NFR, user journey; giao diện SPA; kiểm thử chức năng |
| TV4 | Duy | DevOps / Cloud engineer | Cloud, container, CI/CD, IaC; module Document (object storage), queue + worker; monitoring, load test |

## 3. Phạm vi MVP

- **Trong phạm vi:** 7 use case bắt buộc – Employee profile, Organizational information, Leave request workflow,
  Manager approval, HR policy/document repository, Employee self-service search, Audit history.
- **Mở rộng (advanced):** AI assistant trả lời câu hỏi về chính sách HR, có trích dẫn nguồn và chỉ dùng tài liệu người hỏi được phép xem.
- **Ngoài phạm vi:** tính lương, chấm công, tuyển dụng, mobile app.

## 4. Kế hoạch tổng 10 tuần

| Tuần | Thời gian | Giai đoạn | Công việc chính | Output |
|---|---|---|---|---|
| 4 | 28/9 – 5/10 | Khởi động | Chọn đề tài, phạm vi MVP, kế hoạch 10 tuần, phân vai, tạo repo và board | Thread Discussions, kế hoạch 10 tuần, repo GitHub, bảng phân công |
| 5 | 5/10 – 12/10 | P1 – Business & Cloud Architecture | Problem statement; users/stakeholders; functional requirements; user journey; NFR có số đo; workload analysis; kiến trúc cloud ban đầu; Architecture Canvas; ADR đầu tiên | Requirements + NFR + workload, sơ đồ kiến trúc v1, Architecture Canvas, ADR-00 |
| 6 | 12/10 – 19/10 | P2 – Application, Data & Integration | Capability map; component diagram; API spec; data model + data ownership; storage/cache; integration; sync/async; event model; xử lý lỗi | Component diagram, API spec, ERD, bảng sync/async, danh sách event, ADR-01 → ADR-03 |
| 7 | 19/10 – 26/10 | Implementation 1 – Nền tảng | Khung dự án modular monolith, DB + migration, đăng nhập OIDC/JWT, module Employee và Organization, dữ liệu mẫu, docker-compose | API Employee/Organization chạy local, migration, seed ~2,000 nhân viên, README |
| 8 | 26/10 – 2/11 | Implementation 2 – Workflow | State machine đơn nghỉ phép, số dư phép, idempotency, audit log, thông báo qua queue + worker; frontend các màn hình chính | Demo luồng nghỉ phép end-to-end ở local, audit trail, test tự động cho workflow |
| 9 | 2/11 – 9/11 | P3 – Security & DevOps (dự kiến) | Threat model; ma trận phân quyền RBAC/ABAC; mã hóa dữ liệu nhạy cảm; quản lý secret; container; CI/CD; IaC; deploy cloud lần đầu | Threat model, access-control matrix, Dockerfile, pipeline CI/CD, staging trên cloud |
| 10 | 9/11 – 16/11 | Hoàn thiện chức năng (dự kiến) | Kho tài liệu HR (object storage + metadata), self-service search; chặn truy cập trái phép; deploy/rollback; logging/metrics cơ bản | Đủ 7 use case trên cloud, demo role-based access, tài liệu deploy/rollback |
| 11 | 16/11 – 23/11 | P4 – Production Engineering (dự kiến) | Load test theo NFR; kịch bản lỗi; SLI/SLO; observability dashboard; capacity và cost analysis | Báo cáo load test, failure scenarios, dashboard, bảng SLO, chi phí/tháng |
| 12 | 23/11 – 30/11 | P5 – AI Engineering (dự kiến) | HR policy assistant dạng RAG: ingest tài liệu, retrieval có kiểm soát quyền, trích dẫn; bộ câu hỏi đánh giá; chống prompt injection; đo latency và token cost | AI assistant trên staging, evaluation report, cost/request |
| 13 | 30/11 – 7/12 | Đóng gói & bảo vệ | Sửa lỗi, đóng băng tính năng; hoàn thiện tài liệu kiến trúc + ADR; chuẩn bị Architecture Defense; slide và video demo | Báo cáo cuối, slide, video demo, bản deploy hoàn chỉnh |

Tuần 9–13 là kế hoạch tổng quan vì nhóm chưa học P3–P5; mỗi tuần sẽ được chi tiết hóa trong báo cáo thứ 2 của tuần liền trước.

**Cập nhật 13/11:** tuần 11–13 được chia lại theo từng tính năng trong [`docs/features/`](../features/README.md), xem
[mục 7](#7-kế-hoạch-theo-chức-năng-tuần-11--13). Phần P4, P5 vẫn giữ, nhưng tính năng nào chưa xong thì làm trước.

## 5. Quyết định quan trọng

### ADR-05 – Phạm vi MVP: một luồng nghiệp vụ nghỉ phép end-to-end

> Đã chuyển sang file riêng: [ADR-05 – Phạm vi MVP: một luồng nghiệp vụ nghỉ phép end-to-end](../architecture/adr/ADR-05-mvp-scope.md). Danh sách toàn bộ ADR: [`architecture/adr/`](../architecture/adr/README.md).

## 6. Kế hoạch tuần tiếp theo (tuần 5: 5/10 – 12/10)

| Thành viên | Công việc | Output |
|---|---|---|
| TV1 (nhóm trưởng) | Business problem statement, users và stakeholders; Architecture Canvas; ADR đầu tiên | Problem statement, Architecture Canvas, ADR-00 |
| TV2 (Thanh) | Functional requirements cho 7 use case theo actor–action–input–output–business rule | Bảng functional requirements |
| TV3 (Bảo) | User journey đơn nghỉ phép; NFR có target cụ thể | User journey, bảng NFR |
| TV4 (Duy) | Workload analysis, ước lượng average RPS và peak RPS; kiến trúc cloud ban đầu | Bảng workload, sơ đồ kiến trúc v1 |

## 7. Kế hoạch theo chức năng (tuần 11 – 13)

> Lập 13/11/2026 từ mục "Việc còn lại" trong `requirements.md` của từng tính năng ([`docs/features/`](../features/README.md)).
> Mỗi dòng là một nhánh, một PR. Cột "Tiêu chí" là mã AC trong `requirements.md`: PR ghi các mã này trong mô tả, và chỉ xong khi
> các AC đó có test (xem `test.md`) và chạy được theo `deploy.md`. Báo cáo thứ 2 hằng tuần chép phần của tuần đó vào
> `tuan-NN/README.md` và chỉnh ngày nếu cần.

### 7.1 Tính năng còn thiếu, theo mức ưu tiên

| Tính năng | Việc | FR | Mức | Tuần |
|---|---|---|---|---|
| UC5 | Giao diện kho tài liệu | FR-5.1 → 5.3 | M | 10, trễ thì đầu 11 |
| UC6 | Tìm tài liệu (trích văn bản, full-text, giao diện) | FR-6.2 | M | 10, trễ thì đầu 11 |
| UC7 | Màn hình tra cứu audit | FR-7.3 | M | 10, trễ thì đầu 11 |
| UC3, UC4 | Ẩn lý do nghỉ ốm với quản lý, email chỉ báo chung | BR-14, BR-15, NFR-5.18 | M (riêng tư) | 11 |
| UC1 | Bắt buộc `version` khi sửa; quy tắc chấm dứt nhân viên còn cấp dưới | FR-1.6 | S | 11 |
| UC3, UC4 | Tạo đơn hộ, người duyệt thay | FR-3.7, FR-4.3 | S | 10, trễ thì 11 |
| UC5 | Kho tài liệu trên staging | FR-5.x | M | 12 |
| UC6 | Trợ lý chính sách | FR-6.3 | C | 12 |
| UC2 | Giao diện quản lý phòng ban | FR-2.4 | S | 13, cắt đầu tiên |
| UC7 | Audit đăng nhập, cấp và thu hồi vai trò | NFR-5.10 | – | 13, cắt thứ hai |

Thiếu thời gian thì cắt từ dưới lên và ghi vào báo cáo tuần.

### 7.2 Tuần 11 (16/11 – 23/11): xong phần còn lại của UC1, UC3, UC4, UC6 và P4

Thứ tự trong tuần: việc tuần 10 còn dở → riêng tư đơn nghỉ → rate limit → load test. Load test chạy trên code đã đủ tính năng.

| Nhánh | Người | Tính năng | Việc | Tiêu chí | Mở PR | Merge | Review |
|---|---|---|---|---|---|---|---|
| `feat/document-search`, `feat/audit-ui`, `feat/leave-delegation` | TV1 Duong | UC5, UC6, UC7, UC3, UC4 | Chỉ khi tuần 10 chưa merge | Như `requirements.md` | T2 (16/11) | T3 (17/11) | Như tuần 10 |
| `docs/org-integrity-rules` | TV2 Thanh | UC1, UC2, UC5, UC7 | Chốt: chấm dứt nhân viên còn cấp dưới; ý nghĩa `headEmployeeId`; audit có ghi giá trị trường cá nhân không; thời gian lưu audit (BR-13 5 năm hay NFR-6.3 2 năm); sửa NFR-5.19 cho khớp URL tải lên 10 phút | AC-1.7.1, AC-1.4.3 | T2 (16/11), 21:00 | T3 (17/11) | TV1, TV4 |
| `docs/leave-rules-week11` | TV2 Thanh | UC3, UC4 | Bổ sung `leave-rules.md`: cách tính phép năm (tỉ lệ khi chưa đủ 12 tháng, thâm niên), nghỉ theo sự kiện, đơn qua hai năm, hủy đơn đã duyệt, hoàn tất sau ngày kết thúc, nhắc đơn chờ lâu | AC-3.1.3, AC-3.1.4, AC-3.2.4, AC-4.5.3 | T2 (16/11), 21:00 | T3 (17/11) | TV1, TV4 |
| `feat/leave-privacy` | TV1 Duong | UC3, UC4 | Ẩn lý do nghỉ ốm với quản lý (chi tiết, danh sách, lịch sử); audit HR đọc lý do; bỏ `comment` khỏi audit; email và payload outbox chỉ báo chung; email đơn CEO tới HR; sửa unit test nội dung email | AC-4.6.3, AC-4.6.5, AC-4.7.3, AC-4.7.4 | T3 (17/11) | T4 (18/11) | TV2, TV4 |
| `feat/security-headers-ratelimit` | TV1 Duong | Chung, UC6 | Header bảo mật; 100 request/phút mỗi người, 20/phút cho tìm kiếm | AC-6.2.7 | T3 (17/11) | T4 (18/11) | TV3, TV4 |
| `fix/employee-org-integrity` | TV1 Duong | UC1, UC2 | Bắt buộc `version`, tăng `version` khi sửa trường nhạy cảm; audit theo nhóm trường; HR sửa `hireDate`, `workEmail`; chặn nghỉ việc khi còn cấp dưới, chặn người đã nghỉ; chỉ tải trường nhạy cảm khi bấm hiện; chặn gốc thứ hai, kiểm `headEmployeeId` | AC-1.3.4, AC-1.4.3, AC-1.4.4, AC-1.6.2, AC-1.6.3, AC-1.7.1, AC-1.7.2, AC-2.4.6, AC-2.4.7 | T5 (19/11) | T6 (20/11) | TV2, TV4 |
| `feat/profile-layout` | TV1 Duong | UC1 | Trang hồ sơ theo nhóm (cá nhân, công việc, tài chính, phúc lợi, khác), màu chủ đạo cyan, mục chưa có tiêu đề đỏ; chủ hồ sơ tự xem lương, số tài khoản | AC-1.8.x, AC-1.3.5 | T6 (20/11) | T7 (21/11) | TV2, TV4 |
| `fix/leave-balance-rules` | TV1 Duong | UC3, UC4 | Cấp số dư theo luật, đơn qua hai năm, 403 khi chưa gắn hồ sơ, chỉ hoàn tất sau ngày kết thúc, hủy đơn đã duyệt | AC-3.1.3, AC-3.1.4, AC-3.2.4, AC-3.2.5, AC-4.5.3 | T6 (20/11) | T7 (21/11) | TV2, TV4 |
| `infra/idp-mfa` | TV3 Bảo | Chung | MFA TOTP cho HR, ADMIN | NFR-5.4 | T5 (19/11), 21:00 | T6 (20/11) | TV1 |
| `docs/test-cases-week11` | TV4 Duy | UC1 → UC7 | Ca còn thiếu trong mục 7 của mọi `test.md` | Theo `test.md` | T4 (18/11), 21:00 | T5 (19/11) | TV2, TV1 |
| `docs/security-test-cases-week11` | TV4 Duy | Chung | Tự đăng ký, mật khẩu yếu, khóa 5 lần sai, hết phiên, MFA, 429, header | NFR-5.2 → 5.5, 5.9, 5.21, 5.22 | T4 (18/11), 21:00 | T5 (19/11) | TV1, TV3 |
| `test/load-k6` | TV4 Duy, TV1 hỗ trợ | UC1 → UC5, UC7 | Load test local: 50 request/giây 15 phút; đo NFR-1.1 → 1.3, NFR-2.1, NFR-2.4 (3,75 triệu bản ghi audit), băng thông tải tài liệu | NFR-1, NFR-2 | T6 (20/11) | CN (22/11) | TV1, TV3 |
| `docs/slo-dashboard-cost` | TV3 Bảo | Chung | Dashboard CloudWatch theo SLI ở SRS 6.13; chi phí/tháng cập nhật theo kết quả load test | SRS 6.13 | T7 (21/11), 21:00 | CN (22/11) | TV1 |
| `docs/test-report-week11` | TV4 Duy | UC1 → UC7 | Chạy ca kiểm thử trên `dev` (local), ghi ngày, commit | – | CN (22/11), 12:00 | T2 (23/11), 9:00 | TV1 |

### 7.3 Tuần 12 (23/11 – 30/11): staging trên AWS, UC5 trên cloud, trợ lý UC6

| Nhánh | Người | Tính năng | Việc | Tiêu chí | Mở PR | Merge | Review |
|---|---|---|---|---|---|---|---|
| (không có nhánh) | TV3 Bảo | Chung, UC5 | `terraform apply` staging theo `docs/aws-rollout-plan`; bucket tài liệu và `STORAGE_*`; chạy Deploy Staging với seed | `deploy.md` mục 5 của UC1 → UC5, UC7 | T3 (24/11) xong | – | TV1 |
| `docs/adr-14-policy-assistant` | TV1 Duong | UC6 | ADR-14: cách truy hồi đoạn văn bản (full-text hay `pgvector`), nhà cung cấp LLM, ngưỡng đánh giá | AC-6.3.5 | T2 (23/11) | T3 (24/11) | TV2, TV3 |
| `docs/assistant-eval-set` | TV2 Thanh | UC6 | Bộ ≥ 30 câu hỏi có đáp án, tài liệu nguồn; có câu ngoài tài liệu, câu prompt injection; độ dài câu hỏi tối đa | AC-6.3.1 → 6.3.3 | T3 (24/11), 21:00 | T4 (25/11) | TV1, TV4 |
| `infra/llm-secrets-cost` | TV3 Bảo | UC6 | Khóa LLM trong Secrets Manager, budget alarm cho chi phí LLM | NFR-7.1 | T4 (25/11), 21:00 | T5 (26/11) | TV1 |
| `feat/policy-assistant` | TV1 Duong | UC6 | API và giao diện hỏi đáp; lọc phạm vi trước khi gửi LLM; trích dẫn; timeout 10 s, lùi về danh sách tài liệu | AC-6.3.1 → 6.3.4 | T5 (26/11) | T6 (27/11) | TV2, TV4 |
| `feat/profile-self-service` | TV1 Duong | UC1 | Bảng `profile_item`, API mục tự khai, email khi đổi tài khoản ngân hàng, nhật ký thay đổi | AC-1.9.x, AC-1.6.4, AC-1.11.x | T3 (24/11) | T4 (25/11) | TV2, TV4 |
| `feat/profile-files` | TV1 Duong | UC1 | Tải file hồ sơ, ảnh đại diện, hạn mức, xóa mềm | AC-1.10.x | T5 (26/11) | T6 (27/11) | TV3, TV4 |
| `feat/leave-hr-approval` | TV1 Duong | UC4 | Trạng thái `PENDING_HR`, cấu hình "Cần HR duyệt thêm" của loại phép, API `pending-hr`, `hr-approve`, `hr-reject` (BR-16) | AC-4.8.1 → 4.8.8 | T3 (24/11) | T4 (25/11) | TV2, TV4 |
| `feat/approvals-inbox` | TV1 Duong | Chung, UC1, UC4 | Trang "Việc cần duyệt" `/approvals` có tab, chuyển tiếp `/leave/approvals`, `/leave/hr` | AC-0.6.1 → 0.6.4 | T6 (27/11) | T7 (28/11) | TV2, TV4 |
| `docs/test-cases-week12` | TV4 Duy | UC4, chung | Ca kiểm thử HR duyệt thêm và trang "Việc cần duyệt" | AC-4.8.x, AC-0.6.x | T4 (25/11), 21:00 | T5 (26/11) | TV2 |
| `infra/profile-files` | TV3 Bảo | UC1 | Bucket `hr-profile-files-staging`, lifecycle 30 ngày, quyền App Runner, alarm 429 | AC-1.10.7, AC-1.10.9, AC-1.14.4, AC-1.14.5 | T3 (24/11) | T4 (25/11) | TV1 |
| `docs/test-report-week12` | TV4 Duy | UC1 → UC7 | Chạy ca kiểm thử trên **staging**, nhất là UC5 (S3, CORS, bucket không public) và đăng nhập Cognito; load test ngắn trên staging | `test.md` | T7 (28/11), 21:00 | CN (29/11) | TV1 |
| `docs/assistant-eval-report` | TV4 Duy | UC6 | Chạy bộ đánh giá: tỉ lệ đúng, có trích dẫn, độ trễ, chi phí mỗi câu | AC-6.3.5 | CN (29/11), 12:00 | T2 (30/11), 9:00 | TV1, TV2 |

Trợ lý là mức C: nếu đến T5 (26/11) staging chưa chạy được thì dừng trợ lý, dồn sức cho staging.

### 7.4 Tuần 13 (30/11 – 7/12): đóng băng, sửa lỗi, bảo vệ

| Nhánh | Người | Việc | Hạn |
|---|---|---|---|
| `feat/department-admin-ui` | TV1 Duong | UC2 AC-2.4.5, chỉ khi tuần 11–12 xong hết | Merge T3 (1/12) |
| `infra/idp-auth-events` | TV3 Bảo | UC7 AC-7.4.1: ghi đăng nhập, cấp và thu hồi vai trò từ Keycloak, Cognito | Merge T3 (1/12) |
| – | Cả nhóm | **Đóng băng tính năng T4 (2/12).** Sau đó chỉ merge sửa lỗi | T4 (2/12) |
| `docs/feature-status-final` | TV2 Thanh | Cập nhật trạng thái mọi AC trong `requirements.md`, mục 12 `spec.md`, cột trạng thái FR trong SRS; báo cáo MT-2 từ `leave_request_history` | T5 (3/12) |
| `docs/test-report-final` | TV4 Duy | Chạy lại toàn bộ ca kiểm thử trên staging, bảng phủ AC cuối cùng | T6 (4/12) |
| – | TV1, cả nhóm | Báo cáo cuối, slide, video demo, Architecture Defense; tắt staging sau buổi bảo vệ | T2 (7/12) |
