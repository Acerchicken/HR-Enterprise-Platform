# Kế hoạch tổng – HRHelper (HR Enterprise Platform)

> Tên cũ: `tuan-04-ke-hoach-tong.md` (đổi 14/11/2026). File lập ở tuần 4 (28/9 – 5/10) và cập nhật trong suốt dự án.
> Mục 1 và 6 là báo cáo tuần 4, giữ làm lịch sử. Lịch đang áp dụng: [mục 7 – hoàn thành từng chức năng](#7-kế-hoạch-hoàn-thành-từng-chức-năng-tuần-10--13).

Nhóm chọn đề tài số 3 – **Enterprise HR Platform**. MVP tập trung vào một luồng nghiệp vụ end-to-end:
nhân viên tạo đơn nghỉ phép → quản lý duyệt → HR xử lý → hoàn tất, có phân quyền theo vai trò, audit và kho tài liệu
chính sách HR. AI assistant hỏi đáp chính sách là phần mở rộng ở tuần 12.

Thread trên Discussions: **[Tên nhóm]_Enterprise HR Platform**. Mỗi báo cáo thứ 2 hàng tuần là một reply trong thread này.

## 1. Các công việc đã hoàn thành (tuần 4)

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
[mục 7](#7-kế-hoạch-hoàn-thành-từng-chức-năng-tuần-10--13). Phần P4, P5 vẫn giữ, nhưng tính năng nào chưa xong thì làm trước.

**Cập nhật 14/11:** chưa chức năng nào xong, nên từ CN (15/11) nhóm làm **xong từng chức năng một** theo thứ tự UC1 → UC3, UC4 →
UC7 → UC5 → UC6, chức năng nào cũng phải sẵn sàng lên cloud trước khi sang chức năng sau
([mục 7](#7-kế-hoạch-hoàn-thành-từng-chức-năng-tuần-10--13)).

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

## 7. Kế hoạch hoàn thành từng chức năng (tuần 10 – 13)

> Lập 13/11/2026 từ mục "Việc còn lại" trong `requirements.md` của từng tính năng ([`docs/features/`](../features/README.md)).
> **Sửa 14/11/2026:** bỏ cách chia theo tuần, chuyển sang **làm xong từng chức năng một**, bắt đầu với UC1 từ CN (15/11).
> Mỗi dòng là một nhánh tách từ `dev`, một PR vào `dev`. Cột "Tiêu chí" là mã AC trong `requirements.md`: PR ghi các mã này
> trong mô tả. Báo cáo thứ 2 hằng tuần chép các dòng của tuần đó vào `tuan-NN/README.md` và chỉnh ngày nếu cần.

### 7.1 Vì sao đổi, và thế nào là "xong"

**Hiện trạng 14/11:** chưa chức năng nào xong theo định nghĩa dưới đây. UC nào cũng đã có một phần (API, một số màn hình) nhưng
còn tiêu chí chưa làm, chưa có biên bản kiểm thử đủ, và chưa chạy trên cloud. Làm nhiều UC cùng lúc như tuần 10 khiến cuối tuần
UC nào cũng dở. Từ nay:

- **TV1 chỉ code một chức năng tại một thời điểm**, theo thứ tự ở mục 7.2. Chỉ mở nhánh của chức năng sau khi mọi PR code của
  chức năng trước đã mở. Việc chung (mục 7.3) chạy song song vì không gắn với một UC.
- **Các thành viên khác đi trước hoặc sau một bước:** TV2 chốt quy tắc của chức năng kế tiếp, TV4 viết ca kiểm thử của chức năng
  kế tiếp và chạy kiểm thử chức năng vừa code xong, TV3 chuẩn bị hạ tầng cho chức năng kế tiếp.

**Một chức năng "xong" (sẵn sàng lên cloud) khi đủ 4 điều:**

1. Mọi AC trong phạm vi của nó (bảng ở mục 7.4 → 7.7) đã merge vào `dev`, có test tự động hoặc ca kiểm thử tay đã chạy. CI xanh.
2. `deploy.md` của nó ghi đủ migration, biến môi trường (có cả trong [`configuration.md`](../development/configuration.md)) và tài
   nguyên cloud; tài nguyên đó đã có trong Terraform, chạy `validate` và `plan` không lỗi. Không có URL, tên bucket, khóa cố định
   trong code.
3. TV4 đã chạy ca kiểm thử của nó trên `dev` (local) và merge biên bản. Từ khi staging chạy (T3 24/11), chạy thêm phần kiểm tra
   sau deploy (`deploy.md` mục 5) trên staging.
4. `requirements.md` (bỏ dấu *chưa có*), mục 12 `spec.md`, cột trạng thái FR trong SRS đã cập nhật; TV2 đã review nghiệp vụ trên PR.

### 7.2 Thứ tự và mốc

| Bước | Chức năng | TV1 code | Xong (biên bản kiểm thử merge) | Vì sao ở vị trí này |
|---|---|---|---|---|
| 1 | **UC1 – Hồ sơ nhân viên**, cùng phần mức M của UC2 (chặn gốc thứ hai, kiểm `headEmployeeId`) | CN (15/11) → T7 (21/11) | T2 (23/11) | Dữ liệu gốc mà mọi chức năng khác dùng; thiết kế giao diện đã có (mockup trong `docs/features/mockups/`) |
| 2 | **UC3, UC4 – Tạo và duyệt đơn nghỉ** | T2 (23/11) → T6 (27/11) | CN (29/11), trên staging | Luồng end-to-end của MVP (ADR-05); hai UC chung module và chung nhánh nên làm cùng một bước |
| 3 | **UC7 – Lịch sử thao tác** | T6 (27/11) → T7 (28/11) | T4 (2/12) | Chỉ còn màn hình tra cứu; kiểm được audit của UC1, UC3, UC4 vừa làm |
| 4 | **UC5 – Kho tài liệu** | T7 (28/11) → CN (29/11) | T4 (2/12) | API đã có, còn giao diện; bucket staging tạo cùng lúc `apply` T3 (24/11) |
| 5 | **UC6 – Tra cứu chung và trợ lý** | CN (29/11) → T3 (1/12) | T4 (2/12) | Tìm tài liệu cần UC5 xong trước; trợ lý mức C nên đứng cuối |
| – | UC2 mở rộng, các việc mức S còn lại | Chỉ khi bước 1 → 5 xong trước T3 (1/12) | – | Cắt đầu tiên (mục 7.8) |

**Đóng băng tính năng T4 (2/12).** Thiếu thời gian thì cắt từ dưới lên theo mục 7.8 và ghi vào báo cáo tuần, không làm dở
nhiều chức năng cùng lúc. Load test (P4, tuần 11) chạy trên các API đã có; tuần 12 chạy lại một lượt ngắn trên staging.

### 7.3 Việc chung chạy song song

| Nhánh | Người | Việc | Tiêu chí | Mở PR | Merge | Review |
|---|---|---|---|---|---|---|
| `infra/idp-hardening` | TV3 Bảo | Tắt tự đăng ký, chính sách mật khẩu, khóa sau 5 lần sai, thời hạn token và phiên (việc tuần 10) | NFR-5.2, 5.3, 5.5, 5.9 | CN (15/11), 12:00 | T2 (16/11), 9:00 | TV1, TV4 |
| `feat/security-headers-ratelimit` | TV1 Duong | Header bảo mật; 100 request/phút mỗi người, 20/phút cho tìm kiếm; ngưỡng qua biến môi trường. Dùng cho AC-1.14.x và AC-6.2.7 | NFR-5.21, 5.22 | T3 (17/11) | T4 (18/11) | TV3, TV4 |
| `fix/auth-email-verified` | TV1 Duong | Chỉ liên kết tài khoản khi email đã xác minh (threat model T-02; dời từ tuần 10) | – | T4 (18/11) | T5 (19/11) | TV3, TV4 |
| `docs/security-test-cases-week11` | TV4 Duy | Tự đăng ký, mật khẩu yếu, khóa 5 lần sai, hết phiên, MFA, 429, header | NFR-5.2 → 5.5, 5.9, 5.21, 5.22 | T4 (18/11), 21:00 | T5 (19/11) | TV1, TV3 |
| `infra/idp-mfa` | TV3 Bảo | MFA TOTP cho HR, ADMIN (Keycloak và Cognito) | NFR-5.4 | T5 (19/11), 21:00 | T6 (20/11) | TV1 |
| `test/load-k6` | TV4 Duy, TV1 hỗ trợ | Load test local 50 request/giây 15 phút; đo NFR-1.1 → 1.3, NFR-2.1, NFR-2.4. Rate limit đã merge: dùng nhiều tài khoản hoặc nâng ngưỡng | NFR-1, NFR-2 | T6 (20/11) | CN (22/11) | TV1, TV3 |
| `docs/slo-dashboard-cost` | TV3 Bảo | Dashboard CloudWatch theo SLI ở SRS 6.13; chi phí/tháng theo kết quả load test | SRS 6.13 | T7 (21/11), 21:00 | CN (22/11) | TV1 |
| `feat/mail-driver-ses` | TV1 Duong | Driver gửi email `MAIL_DRIVER=smtp\|ses`: local giữ SMTP tới Mailpit, AWS gửi bằng SES API (`@aws-sdk/client-sesv2`) với IAM role của worker, không dùng SMTP credentials (quyết định 14/11, góp ý #70) | Worker gửi được email trên staging | T7 (21/11) | CN (22/11) | TV3 |
| (không có nhánh) | TV3 Bảo | `terraform apply` staging theo `docs/aws-rollout-plan`, gồm bucket tài liệu và bucket hồ sơ; chạy Deploy Staging với seed | `deploy.md` mục 5 của các UC đã xong | T3 (24/11) xong | – | TV1 |
| `infra/llm-secrets-cost` | TV3 Bảo | Khóa LLM trong Secrets Manager, budget alarm chi phí LLM | NFR-7.1 | T4 (25/11), 21:00 | T5 (26/11) | TV1 |

TV1 review các PR đang mở của TV3 (#68 MinIO local, #69 kế hoạch lên AWS, #70 Terraform tài liệu và email) trước T2 (16/11);
TV3 sửa theo góp ý trên cùng PR. Bước 1 (file hồ sơ) và bước 4 (tài liệu) cần các PR này.

### 7.4 Bước 1 – UC1 (CN 15/11 → T2 23/11)

> **Rà soát 14/11:** [UC1 – Rà soát hiện trạng và kế hoạch `feat/profile-layout`](../features/UC1-employee-profile/ra-soat.md).
> Quyết định cùng ngày: nhánh `feat/profile-self-service` đổi tên thành `feat/profile-change-requests` để khỏi nhầm với UC6;
> ô tìm kiếm trên nav bar chỉ tìm đồng nghiệp, tìm tài liệu và trợ lý AI ở trang riêng "Tra cứu tài liệu"; biểu tượng dùng
> `lucide-react`.

| Nhánh | Người | Việc | Tiêu chí | Mở PR | Merge | Review |
|---|---|---|---|---|---|---|
| `feat/profile-layout` | TV1 Duong | Không có migration. Backend: danh mục mục và quyền theo mục, `GET /employees/{id}/summary`, `GET /employees/{id}/profile/{section}` (cá nhân, lương, tài khoản), thu gọn `GET /me`. Frontend: màu cyan, nav bar (logo, ô tìm **chỉ đồng nghiệp**, chuông, menu ảnh), trang chủ có ô chức năng, popup hồ sơ có URL, mục chưa có tiêu đề đỏ, thẻ xem nhanh, `lucide-react`. Sáu bước ở [rà soát UC1](../features/UC1-employee-profile/ra-soat.md#6-kế-hoạch-featprofile-layout); chậm thì tách PR backend merge trước | AC-1.8.x, AC-1.3.5, AC-0.1.1, AC-0.1.2, AC-0.2.1, AC-0.3.x, AC-0.4.1, AC-6.1.x | **CN (15/11)** | T3 (17/11) | TV2, TV4 |
| `docs/org-integrity-rules` | TV2 Thanh | Chốt: chấm dứt nhân viên còn cấp dưới; ý nghĩa `headEmployeeId`; audit có ghi giá trị trường cá nhân không; thời gian lưu audit (BR-13 5 năm hay NFR-6.3 2 năm); danh sách mục nhân viên được gửi yêu cầu sửa, thời hạn HR xử lý | AC-1.7.1, AC-1.4.3, FR-1.9, FR-1.14 | T2 (16/11), 21:00 | T3 (17/11) | TV1, TV4 |
| `docs/test-cases-uc1` | TV4 Duy | Ca còn thiếu ở mục 7 `test.md` của UC1, gồm ca bảo mật file và giới hạn tần suất | Mọi AC-1.x | T3 (17/11), 21:00 | T4 (18/11) | TV2, TV1 |
| `fix/employee-org-integrity` | TV1 Duong | Bắt buộc `version`; audit theo nhóm trường; HR sửa `hireDate`, `workEmail`; chặn nghỉ việc khi còn cấp dưới, chặn người đã nghỉ; chỉ tải trường nhạy cảm khi bấm hiện; UC2: chặn gốc thứ hai, kiểm `headEmployeeId` | AC-1.3.4, AC-1.4.3, AC-1.4.4, AC-1.6.2, AC-1.6.3, AC-1.7.1, AC-1.7.2, AC-2.4.6, AC-2.4.7 | T4 (18/11) | T5 (19/11) | TV2, TV4 |
| `infra/profile-files` | TV3 Bảo | Bucket `hr-profile-files-staging`, lifecycle 30 ngày, quyền App Runner, alarm 429; biến `PROFILE_STORAGE_BUCKET` cho local (MinIO) và staging. Chỉ `validate`, `plan` | AC-1.10.7, AC-1.10.9, AC-1.14.4, AC-1.14.5 | T4 (18/11), 21:00 | T5 (19/11) | TV1 |
| `feat/profile-change-requests` | TV1 Duong | Bảng `profile_item`, yêu cầu cập nhật hồ sơ và màn hình duyệt của HR, email khi đổi tài khoản ngân hàng, nhật ký thay đổi | AC-1.2.1, AC-1.9.x, AC-1.6.4, AC-1.11.x | T5 (19/11) | T6 (20/11) | TV2, TV4 |
| `feat/profile-files` | TV1 Duong | Tải file hồ sơ, ảnh đại diện, hạn mức, xóa mềm | AC-1.10.x | T6 (20/11) | T7 (21/11) | TV3, TV4 |
| `docs/test-report-uc1` | TV4 Duy | Chạy mọi ca UC1 trên `dev` (local), ghi ngày, commit | `test.md` UC1 | CN (22/11), 12:00 | T2 (23/11), 9:00 | TV1 |

Chuẩn bị cho bước 2 trong lúc TV1 làm UC1:

| Nhánh | Người | Việc | Tiêu chí | Mở PR | Merge | Review |
|---|---|---|---|---|---|---|
| `docs/leave-rules-week11` | TV2 Thanh | Bổ sung `leave-rules.md`: cách tính phép năm (tỉ lệ khi chưa đủ 12 tháng, thâm niên), nghỉ theo sự kiện, đơn qua hai năm, hủy đơn đã duyệt, hoàn tất sau ngày kết thúc, nhắc đơn chờ lâu | AC-3.1.3, AC-3.1.4, AC-3.2.4, AC-4.5.3 | T5 (19/11), 21:00 | T6 (20/11) | TV1, TV4 |
| `docs/test-cases-uc3-uc4` | TV4 Duy | Ca còn thiếu của UC3, UC4: đổi quản lý khi đơn đang chờ, người duyệt thay, tạo đơn hộ, riêng tư, HR duyệt thêm | AC-3.7.x, AC-4.2.6, AC-4.3.x, AC-4.6.3, AC-4.7.3, AC-4.8.x | T7 (21/11), 21:00 | CN (22/11) | TV2, TV1 |

### 7.5 Bước 2 – UC3, UC4 (T2 23/11 → CN 29/11)

Làm phần mức M (riêng tư) trước, phần mức S sau.

| Nhánh | Người | Việc | Tiêu chí | Mở PR | Merge | Review |
|---|---|---|---|---|---|---|
| `feat/leave-privacy` | TV1 Duong | Ẩn lý do nghỉ ốm với quản lý (chi tiết, danh sách, lịch sử); audit HR đọc lý do; bỏ `comment` khỏi audit; email và payload outbox chỉ báo chung; email đơn CEO tới HR | AC-4.6.3, AC-4.6.5, AC-4.7.3, AC-4.7.4 | T2 (23/11) | T3 (24/11) | TV2, TV4 |
| `fix/leave-balance-rules` | TV1 Duong | Cấp số dư theo luật, đơn qua hai năm, 403 khi chưa gắn hồ sơ, chỉ hoàn tất sau ngày kết thúc, hủy đơn đã duyệt | AC-3.1.3, AC-3.1.4, AC-3.2.4, AC-3.2.5, AC-4.5.3 | T3 (24/11) | T4 (25/11) | TV2, TV4 |
| `feat/leave-delegation` | TV1 Duong | Người duyệt thay (BR-06), tạo đơn hộ (BR-12) | AC-3.7.1 → 3.7.4, AC-4.3.1 → 4.3.4 | T4 (25/11) | T5 (26/11) | TV2, TV4 |
| `feat/leave-hr-approval` | TV1 Duong | Trạng thái `PENDING_HR`, cấu hình "Cần HR duyệt thêm" của loại phép, API `pending-hr`, `hr-approve`, `hr-reject` (BR-16) | AC-4.8.1 → 4.8.8 | T5 (26/11) | T6 (27/11) | TV2, TV4 |
| `docs/test-report-uc3-uc4` | TV4 Duy | Chạy ca UC3, UC4 trên staging; chạy lại `deploy.md` mục 5 của UC1 trên staging | `test.md` UC3, UC4 | T7 (28/11), 21:00 | CN (29/11) | TV1 |

Chuẩn bị cho bước 3 → 5 trong lúc TV1 làm UC3, UC4:

| Nhánh | Người | Việc | Tiêu chí | Mở PR | Merge | Review |
|---|---|---|---|---|---|---|
| `docs/adr-14-policy-assistant` | TV1 Duong | ADR-14: cách truy hồi đoạn văn bản (full-text hay `pgvector`), nhà cung cấp LLM, ngưỡng đánh giá | AC-6.3.5 | T2 (23/11) | T3 (24/11) | TV2, TV3 |
| `docs/assistant-eval-set` | TV2 Thanh | Bộ ≥ 30 câu hỏi có đáp án, tài liệu nguồn; có câu ngoài tài liệu, câu prompt injection; độ dài câu hỏi tối đa | AC-6.3.1 → 6.3.3 | T3 (24/11), 21:00 | T4 (25/11) | TV1, TV4 |
| `docs/test-cases-uc5-uc6-uc7` | TV4 Duy | Ca còn thiếu của UC5, UC6 (tìm tài liệu, trợ lý), UC7 (lọc theo `actor`, thời gian; audit không chứa giá trị nhạy cảm; thao tác lỗi không sinh audit) | AC-5.x, AC-6.2.x, AC-6.3.x, AC-7.1.2, AC-7.1.3, AC-7.3.1 | T4 (25/11), 21:00 | T5 (26/11) | TV2, TV1 |

### 7.6 Bước 3, 4 – UC7, UC5 (T6 27/11 → CN 29/11)

| Nhánh | Người | Việc | Tiêu chí | Mở PR | Merge | Review |
|---|---|---|---|---|---|---|
| `feat/audit-ui` | TV1 Duong | UC7: màn hình tra cứu audit cho HR, ADMIN; `to` tính cả ngày kết thúc | AC-7.3.4, AC-7.3.5 | T6 (27/11) | T7 (28/11) | TV2, TV4 |
| `feat/document-ui` | TV1 Duong | UC5: giao diện kho tài liệu cho HR (tải lên, phạm vi, phiên bản) và nhân viên (xem, tải) | AC-5.1.8, AC-5.2.7 | T7 (28/11) | CN (29/11) | TV2, TV4 |

### 7.7 Bước 5 – UC6 (CN 29/11 → T4 2/12)

| Nhánh | Người | Việc | Tiêu chí | Mở PR | Merge | Review |
|---|---|---|---|---|---|---|
| `feat/document-search` | TV1 Duong | Worker trích văn bản PDF/DOCX, full-text PostgreSQL, tìm theo quyền (lọc trong truy vấn), ô tìm trên trang "Tra cứu tài liệu" `/documents` (không trên nav bar) | AC-6.2.1 → 6.2.6 | CN (29/11) | T2 (30/11) | TV2, TV4 |
| `feat/policy-assistant` | TV1 Duong | API và khung hỏi đáp trên trang "Tra cứu tài liệu"; lọc phạm vi trước khi gửi LLM; trích dẫn; timeout 10 s, lùi về danh sách tài liệu. Mức C: nếu `feat/document-search` chưa merge T2 (30/11) thì cắt | AC-6.3.1 → 6.3.4 | T2 (30/11) | T3 (1/12) | TV2, TV4 |
| `docs/test-report-uc5-uc6-uc7` | TV4 Duy | Chạy ca UC5, UC6, UC7 trên staging, nhất là UC5 (S3, CORS, bucket không public) | `test.md` UC5 → UC7 | T3 (1/12), 21:00 | T4 (2/12) | TV1 |
| `docs/assistant-eval-report` | TV4 Duy | Chạy bộ đánh giá: tỉ lệ đúng, có trích dẫn, độ trễ, chi phí mỗi câu (chỉ khi trợ lý đã merge) | AC-6.3.5 | T4 (2/12), 21:00 | T5 (3/12) | TV1, TV2 |

### 7.8 Danh sách cắt và tuần 13

Các việc dưới đây chỉ làm khi bước 1 → 5 xong trước T3 (1/12). Hết thời gian thì cắt theo thứ tự từ trên xuống:

| Thứ tự cắt | Nhánh | Người | Việc |
|---|---|---|---|
| 1 | `feat/department-admin-ui` | TV1 Duong | UC2 AC-2.4.5, trưởng/phó phòng AC-2.9.x, chức danh AC-2.6.x |
| 2 | `feat/employee-transfer` | TV1 Duong | UC2 quá trình công tác AC-2.8.x, điều chuyển có ngày hiệu lực AC-2.7.x |
| 3 | `infra/idp-auth-events` | TV3 Bảo | UC7 AC-7.4.1: ghi đăng nhập, cấp và thu hồi vai trò từ Keycloak, Cognito |
| 4 | `feat/approvals-inbox` | TV1 Duong | Trang "Việc cần duyệt" `/approvals` có tab, chuyển tiếp `/leave/approvals`, `/leave/hr` (AC-0.6.1 → 0.6.4) |

| Việc | Người | Hạn |
|---|---|---|
| **Đóng băng tính năng.** Sau đó chỉ merge sửa lỗi | Cả nhóm | T4 (2/12) |
| `docs/feature-status-final`: trạng thái mọi AC trong `requirements.md`, mục 12 `spec.md`, cột trạng thái FR trong SRS; báo cáo MT-2 từ `leave_request_history` | TV2 Thanh | T5 (3/12) |
| `docs/test-report-final`: chạy lại toàn bộ ca kiểm thử trên staging, bảng phủ AC cuối cùng | TV4 Duy | T6 (4/12) |
| Báo cáo cuối, slide, video demo, Architecture Defense; tắt staging sau buổi bảo vệ | TV1, cả nhóm | T2 (7/12) |

### 7.9 Phần TV1 đã làm thay: thành viên đọc, review và góp ý

Từ tuần 9 một số tài liệu thuộc vai trò của thành viên khác do TV1 viết để kịp tiến độ. **Người viết vẫn là TV1**; báo cáo tuần
không ghi các tài liệu này là của thành viên. Việc của thành viên là đọc, đối chiếu và góp ý bằng **review trên PR** (Comment hoặc
Request changes, chỉ rõ dòng sai và cách sửa). PR đã merge thì góp ý bằng comment trên PR đó hoặc mở issue; TV1 sửa ở PR mới.
Báo cáo tuần ghi đúng việc đã làm, ví dụ "TV2 review `requirements.md` UC1 trên #76", không ghi "TV2 viết".

| Tài liệu do TV1 viết | PR | Thuộc vai trò | Người review | Việc khi review | Hạn |
|---|---|---|---|---|---|
| `requirements.md`, `spec.md` của UC1, UC2 | #76 | TV2 (nghiệp vụ) | TV2 Thanh | Đối chiếu AC với SRS, `leave-rules.md`, ma trận phân quyền; ghi AC nào sai, thiếu, *chưa chốt* | T2 (16/11), 21:00 |
| `requirements.md`, `spec.md` của UC3, UC4 | #76 | TV2 | TV2 Thanh | Như trên, đối chiếu BR-01 → BR-16 | T6 (20/11) |
| `requirements.md`, `spec.md` của UC5, UC6, UC7 | #76 | TV2 | TV2 Thanh | Như trên, đối chiếu DR-nn | T4 (25/11) |
| Bảng FR, NFR trong SRS; `access-control-matrix.md` | #71, #76 | TV2 | TV2 Thanh | Kiểm cột trạng thái FR khớp code trên `dev`, quyền khớp `@Roles`. Phần đã làm thay được bỏ khỏi `docs/matrix-week10`; TV2 chỉ làm nốt phần còn lại (threat model, API tài liệu nếu còn thiếu) | T2 (16/11), 21:00 |
| `deploy.md` của UC1 | #76 | TV3 (hạ tầng) | TV3 Bảo | Biến môi trường, migration, tài nguyên staging, rollback có đúng với `infra/` không | T3 (17/11) |
| `deploy.md` của UC2 → UC7; [`configuration.md`](../development/configuration.md) | #76, #74 | TV3 | TV3 Bảo | Như trên; biến nào trong Terraform chưa có trong `configuration.md` | T6 (20/11) |
| `test.md` của UC1 | #76 | TV4 (kiểm thử) | TV4 Duy | Bảng phủ AC có đúng với test đang có không; ca nào thiếu. Sau đó tự viết ca thiếu ở `docs/test-cases-uc1` | T2 (16/11), 21:00 |
| `test.md` của UC2 → UC7 | #76 | TV4 | TV4 Duy | Như trên, trước khi viết ca kiểm thử của bước tương ứng | Trước hạn mở PR ca kiểm thử của bước đó |

TV1 xử lý mọi góp ý "cần sửa" trước khi merge #76, hoặc ở PR sau nếu #76 đã merge.
