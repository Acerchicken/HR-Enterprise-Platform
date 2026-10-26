# Tuần 4 (28/9 – 5/10) – Khởi động và kế hoạch tổng 10 tuần

Nhóm chọn đề tài số 3 – **Enterprise HR Platform**. MVP tập trung vào một luồng nghiệp vụ end-to-end:
nhân viên tạo đơn nghỉ phép → quản lý duyệt → HR xử lý → hoàn tất, có phân quyền theo vai trò, audit và kho tài liệu
chính sách HR. AI assistant hỏi đáp chính sách là phần mở rộng ở tuần 12.

Thread trên Discussions: **[Tên nhóm]_Enterprise HR Platform**. Mỗi báo cáo thứ 2 hàng tuần là một reply trong thread này.

## 1. Các công việc đã hoàn thành

| Thành viên | Công việc đã hoàn thành |
|---|---|
| TV1 (nhóm trưởng) | Chọn đề tài, xác định phạm vi MVP; lập kế hoạch 10 tuần; phân vai trong nhóm; tạo thread trên Discussions |
| TV2 (Thanh) | Đọc yêu cầu đề tài, đề xuất danh sách use case và entity ban đầu |
| TV3 (Bảo) | Tìm hiểu quy trình HR (hồ sơ nhân viên, nghỉ phép) làm cơ sở viết requirements |
| TV4 (Duy) | Tạo repo GitHub và board quản lý công việc; tìm hiểu các cloud provider và chương trình credit cho sinh viên |

## 2. Phân công vai trò (4 người)

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

## 5. Quyết định quan trọng

### ADR-05 – Phạm vi MVP: một luồng nghiệp vụ nghỉ phép end-to-end

**Bối cảnh:** đề tài có 7 use case bắt buộc cộng phần AI mở rộng; nhóm 4 người, 10 tuần; môn học chấm nặng phần kiến trúc,
bảo mật, vận hành trên cloud chứ không chỉ số lượng chức năng.

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | Làm rộng | Làm cả 7 use case + tính lương, chấm công ở mức cơ bản |
| B | Một luồng end-to-end sâu | Làm đủ 7 use case, trong đó luồng nghỉ phép làm kỹ (workflow, phân quyền, audit, thông báo); bỏ lương, chấm công, tuyển dụng |
| C | Chỉ phần lõi | Chỉ Employee profile + Leave, bỏ document, search |

**Tiêu chí lựa chọn:**

| Tiêu chí | A | B | C |
|---|---|---|---|
| Đáp ứng yêu cầu bắt buộc của đề tài | 5 | 5 | 2 |
| Khả năng hoàn thành trong 10 tuần với 4 người | 1 | 4 | 5 |
| Đủ "chiều sâu" để thể hiện kiến trúc (transaction, async, security) | 2 | 5 | 3 |
| Còn thời gian cho deploy, load test, AI | 1 | 4 | 5 |

**Giải pháp được chọn:** B.

**Trade-off:** bỏ tính lương, chấm công, tuyển dụng; Payroll chỉ là file export mô phỏng. Một số use case (search, document)
chỉ làm ở mức đủ dùng.

**Tiêu chí nghiệm thu:** cuối tuần 10, demo được luồng nghỉ phép từ tạo đơn đến hoàn tất trên môi trường cloud, có audit
từng bước và có ca bị từ chối quyền; 7 use case đều có ít nhất một màn hình hoặc API chạy được.

**Khi nào xem lại:** cuối tuần 8 nếu luồng nghỉ phép chưa chạy end-to-end ở local thì cắt AI assistant (tuần 12) để dồn sức.

## 6. Kế hoạch tuần tiếp theo (tuần 5: 5/10 – 12/10)

| Thành viên | Công việc | Output |
|---|---|---|
| TV1 (nhóm trưởng) | Business problem statement, users và stakeholders; Architecture Canvas; ADR đầu tiên | Problem statement, Architecture Canvas, ADR-00 |
| TV2 (Thanh) | Functional requirements cho 7 use case theo actor–action–input–output–business rule | Bảng functional requirements |
| TV3 (Bảo) | User journey đơn nghỉ phép; NFR có target cụ thể | User journey, bảng NFR |
| TV4 (Duy) | Workload analysis, ước lượng average RPS và peak RPS; kiến trúc cloud ban đầu | Bảng workload, sơ đồ kiến trúc v1 |
