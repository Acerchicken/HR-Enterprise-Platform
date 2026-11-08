# Tuần 9 (2/11 – 9/11) – P3: Security & DevOps

Mục tiêu tuần:
1. **Bảo mật:** có ma trận phân quyền (RBAC/ABAC) và threat model cho luồng hồ sơ và nghỉ phép; mỗi dòng của ma trận có e2e
   test và ca kiểm thử; production không chạy được nếu thiếu secret.
2. **DevOps:** CI build và quét lỗ hổng image Docker; hạ tầng staging trên AWS dựng bằng Terraform; deploy staging lần đầu
   bằng pipeline, không thao tác tay trên console.
3. **Việc tồn từ tuần 8:** chốt ADR-12, kiểm thử màn hình nghỉ phép theo ca kiểm thử, chốt BR-06.

Phân vai theo ADR-11: TV1 Duong code, TV2 Thanh nghiệp vụ + bảo mật nghiệp vụ, TV3 Bảo cloud, IaC, CI/CD, TV4 Duy kiểm thử.

> File này là kế hoạch đầu tuần. Thứ 2 (9/11) nhóm điền mục 1–3 để làm báo cáo.

## Quy trình tuần này (mới)

Áp dụng [`CONVENTIONS.md` mục 6](../../CONVENTIONS.md#quy-trình-cho-một-việc):

1. Tách nhánh từ `dev`, làm xong thì push nhánh và **mở PR** vào `dev` (chưa xong mà muốn xem sớm thì mở Draft PR).
2. Người review góp ý **trên PR** ("Request changes" nếu có góp ý "cần sửa").
3. Người làm sửa trên cùng nhánh, `git push` là PR tự cập nhật, rồi bấm "Re-request review". Lặp tới khi được approve,
   Duong squash merge.
4. Mỗi việc một PR. Không đóng PR chưa đạt để mở PR mới; chỉ đóng khi việc bị hủy, làm sai hướng hoàn toàn hoặc PR trùng.

> Đổi ngày 7/11: từ 2/11 tới 7/11 nhóm thử review trên nhánh và ghi góp ý vào file cá nhân trước khi mở PR. Từ 7/11 quay lại
> review trên PR như trên. Góp ý cũ trong mục "Góp ý review" của file cá nhân giữ làm lịch sử.

Trong bảng dưới, **"Gửi review"** là hạn mở PR, **"Merge"** là hạn PR được approve và merge (có 1 ngày để sửa theo góp ý).

## Kế hoạch tuần 9 theo nhánh

| Nhánh | Người | Việc | Output | Gửi review | Merge | Review |
|---|---|---|---|---|---|---|
| `docs/week8-tv2-report` (nhánh cũ) | TV2 Thanh | Sửa mục "Việc đã làm" tuần 8 (bỏ dòng review không có dấu vết) | `tuan-08/TV2_Thanh.md` | T3 (3/11), 21:00 | T4 (4/11) | TV1 |
| `docs/test-report-leave` | TV4 Duy | Kiểm thử chức năng 5 màn hình nghỉ phép trên `dev` theo TC-01 → TC-22, ghi kết quả thực tế | Mục 2 `docs/business/test-report-tuan-08.md`, issue cho từng lỗi | **T3 (3/11), 21:00** | T4 (4/11) | TV1 |
| `docs/adr-12-cloud-provider` (nhánh cũ) | TV3 Bảo | Sửa 2 điểm review của ADR-12 (mạng App Runner, Cognito) | ADR-12 trong mục 3 file này, `docs/cloud/mapping.md` | **T4 (4/11), 21:00** | T5 (5/11) | TV1 |
| `docs/access-control-matrix` | TV2 Thanh | Ma trận phân quyền: vai trò × tài nguyên × thao tác, điều kiện theo dữ liệu | `docs/security/access-control-matrix.md` | **T4 (4/11), 21:00** | T5 (5/11) | TV1, TV4 |
| `feat/secret-config` | TV1 Duong | Production thiếu hoặc dùng secret mặc định thì không khởi động; tách cấu hình secret | PR code | T4 (4/11) | T5 (5/11) | TV3 |
| `ci/docker-images` | TV3 Bảo | CI build image api, worker, web và quét lỗ hổng (Trivy) trên mọi PR | `.github/workflows/` | T5 (5/11), 21:00 | T6 (6/11) | TV1 |
| `docs/leave-rules-br06` | TV2 Thanh | Chốt issue #21, #22 và BR-06 (người duyệt thay) | Cập nhật `docs/business/leave-rules.md`, đóng issue | T5 (5/11), 21:00 | T6 (6/11) | TV1, TV4 |
| `feat/auth-cognito` | TV1 Duong | Xác thực được token của Cognito (staging) lẫn Keycloak (local) | PR code | T5 (5/11) | T6 (6/11) | TV3 |
| `docs/security-test-cases` | TV4 Duy | Ca kiểm thử phân quyền theo ma trận, chạy thử trên local | `docs/business/security-test-cases.md`, `docs/business/test-report-tuan-09.md` | T6 (6/11), 21:00 | T7 (7/11) | TV2, TV1 |
| `docs/threat-model` | TV2 Thanh | Threat model STRIDE | `docs/security/threat-model.md` | T6 (6/11), 21:00 | T7 (7/11) | TV1 |
| `feat/queue-adapter` | TV1 Duong | Tách queue: RabbitMQ khi chạy local, SQS trên AWS | PR code | T6 (6/11) | T7 (7/11) | TV3 |
| `test/access-control-e2e` | TV1 Duong | e2e test cho mọi dòng của ma trận còn thiếu test; sửa chỗ code lệch ma trận | PR code + test | T6 (6/11) | T7 (7/11) | TV2, TV4 |
| `infra/terraform-staging` | TV3 Bảo | Terraform dựng staging trên AWS (kèm `terraform plan`) | `infra/` | **T7 (7/11), 12:00** | T7 (7/11) | TV1 |
| `ci/deploy-staging` | TV3 Bảo | Pipeline deploy staging mỗi khi có commit mới trên `dev` (và chạy tay được); deploy lần đầu | `.github/workflows/deploy-staging.yml`, URL staging | **CN (8/11), 12:00** | CN (8/11) | TV1 |
| `docs/test-report-staging` | TV4 Duy | Smoke test staging với 4 tài khoản | Bổ sung `docs/business/test-report-tuan-09.md` | CN (8/11), 21:00 | T2 (9/11), 9:00 | TV1 |

Thứ tự phụ thuộc:

1. T3: TV4 kiểm thử màn hình nghỉ phép (code đã có trên `dev`).
2. T4: TV2 giao ma trận phân quyền → TV1 viết e2e, TV4 viết ca kiểm thử phân quyền. TV3 chốt ADR-12 → mọi người làm theo AWS.
3. T5: TV1 xong secret + Cognito → TV3 đưa secret và Cognito vào Terraform.
4. T6: TV1 xong queue adapter → worker chạy được với SQS trên staging.
5. T7: TV3 có `terraform plan` để TV1 duyệt rồi mới `apply`.
6. CN: TV3 deploy staging lần đầu trước 12:00 → TV4 smoke test chiều CN.
7. T2 (9/11), 9:00: mọi người điền "Việc đã làm" trong file cá nhân. TV1 viết báo cáo, mở PR `dev` → `main`, gắn tag `week-09`.

**Nếu staging không kịp:** TV3 báo TV1 trước T7 (7/11) 21:00 để cắt phạm vi: staging tối thiểu gồm RDS + API trên App Runner +
web trên S3/CloudFront + Cognito; worker và SQS chuyển sang tuần 10.

## Chi tiết từng người

| Thành viên | File |
|---|---|
| TV1 (Duong, nhóm trưởng) | [TV1_Duong.md](TV1_Duong.md) |
| TV2 (Thanh) | [TV2_Thanh.md](TV2_Thanh.md) |
| TV3 (Bảo) | [TV3_Bao.md](TV3_Bao.md) |
| TV4 (Duy) | [TV4_Duy.md](TV4_Duy.md) |

## 1. Các công việc đã hoàn thành

_Điền cuối tuần._

| Thành viên | Công việc đã hoàn thành | Output | Chi tiết |
|---|---|---|---|
| TV1 (Duong, nhóm trưởng) | | | [TV1_Duong.md](TV1_Duong.md) |
| TV2 (Thanh) | | | [TV2_Thanh.md](TV2_Thanh.md) |
| TV3 (Bảo) | | | [TV3_Bao.md](TV3_Bao.md) |
| TV4 (Duy) | | | [TV4_Duy.md](TV4_Duy.md) |

## 2. Tóm tắt kế hoạch tuần tiếp theo (tuần 10: 9/11 – 16/11)

_Điền cuối tuần. Dự kiến theo kế hoạch tổng: hoàn thiện chức năng (kho tài liệu HR, self-service search, chặn truy cập trái
phép, deploy/rollback, logging/metrics cơ bản)._

Đã chốt thêm trong tuần 9 (đưa vào kế hoạch tuần 10):
- TV1: màn hình HR tạo và sửa hồ sơ nhân viên (`feat/hr-employee-form`, chi tiết trong [TV1_Duong.md](TV1_Duong.md#chuẩn-bị-cho-tuần-10-đã-chốt-511-đưa-vào-kế-hoạch-tuần-10));
  code BR-06 (người duyệt thay), BR-12 (HR, quản lý tạo đơn hộ) và quyết định issue #22.

## 3. Quyết định quan trọng

### ADR-12 – Chọn cloud provider

**Bối cảnh:**
Nhóm cần chọn cloud provider để triển khai hệ thống Enterprise HR Platform (~2,000 nhân viên, workload peak ≈ 10 RPS, thiết kế cho 50 RPS theo NFR tuần 5). Hệ thống tuân theo các quyết định kiến trúc đã chốt: modular monolith (ADR-01), PostgreSQL (ADR-02), managed services cho database, storage và identity (ADR-00), không dùng Kubernetes (ADR-06). Ngân sách hạ tầng theo NFR là < 100 USD/tháng (với mục tiêu tối ưu nội bộ ban đầu là ~50 USD/tháng). Cần chốt provider ở tuần 8/9 để viết IaC (Terraform) và deploy staging lần đầu.

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | Amazon Web Services (AWS) | Hệ sinh thái cloud enterprise toàn diện nhất; App Runner (API), ECS Fargate (Worker), RDS PostgreSQL, S3, Cognito, SQS, CloudWatch, Secrets Manager |
| B | Microsoft Azure | Tích hợp tốt với OIDC enterprise; hỗ trợ gói Azure for Students ($100 credit không cần thẻ tín dụng); Azure Container Apps, PostgreSQL Flexible Server, Blob Storage, Service Bus |
| C | Google Cloud Platform (GCP) | Cloud Run serverless container nhẹ, tự có HTTPS; Cloud SQL for PostgreSQL; Cloud Storage; Cloud Pub/Sub; gói credit dùng thử $300 |

**Tiêu chí lựa chọn:**

| Tiêu chí | A (AWS) | B (Azure) | C (GCP) |
|---|---|---|---|
| Hỗ trợ đầy đủ 7 capability managed (DB, Storage, Auth, Queue, Container, Monitor, KMS) | 5 | 4 | 4 |
| Phù hợp chuẩn môn học và mô hình tham chiếu Cloud (Well-Architected Framework) | 5 | 4 | 4 |
| Mức độ phổ biến của hệ sinh thái, tài liệu và công cụ IaC (Terraform) | 5 | 4 | 4 |
| Khả năng tiếp cận credit sinh viên và độ ổn định tài khoản | 3 | 5 | 4 |
| Chi phí hàng tháng trong ngân sách (< 100 USD/tháng) | 4 | 4 | 5 |
| Hỗ trợ mở rộng cho AI/RAG (pgvector, LLM API) ở tuần 12 | 5 | 4 | 5 |
| **Tổng điểm** | **27** | **25** | **26** |

_Nguyên tắc phân định khi điểm số tiệm cận:_ Khi các phương án đều đáp ứng yêu cầu kỹ thuật và chi phí, ưu tiên nền tảng là chuẩn tham chiếu chính thức của môn học Cloud Application Development (AWS) để hỗ trợ tốt nhất cho tài liệu kiến trúc và phần phản biện (Architecture Defense).

**Giải pháp được chọn:** **A (Amazon Web Services)**.

Lý do:
1. **Chuẩn môn học & Kiến trúc:** AWS là nền tảng tham chiếu chuẩn của môn học và đồ án, mô hình Well-Architected Framework hỗ trợ đắc lực cho việc chấm điểm kiến trúc và bảo vệ đồ án.
2. **Compute tối ưu theo vai trò:**
   - Backend API chạy trên **AWS App Runner** (tự scale theo HTTP traffic, có sẵn HTTPS và Load Balancer).
   - Notification Worker chạy trên **Amazon ECS Fargate** (task độc lập, liên tục polling queue SQS mà không bị throttle CPU như App Runner).
3. **Database & AI:** Amazon RDS for PostgreSQL 16 hỗ trợ sẵn extension `pgvector` phục vụ tính năng RAG ở tuần 12, cùng cơ chế backup tự động và khôi phục point-in-time đáp ứng RPO ≤ 1 giờ, RTO ≤ 4 giờ (ADR-00).
4. **Identity & Storage managed:** Sử dụng **Amazon Cognito User Pool** (chuẩn OIDC, miễn phí vĩnh viễn cho 50,000 MAU) và **Amazon S3** (presigned URL cho tải tài liệu trực tiếp). *Lưu ý kỹ thuật:* Token của Cognito dùng `client_id` thay vì `azp`, vai trò nằm trong `cognito:groups`. TV1 cập nhật module identity ở nhánh `feat/auth-cognito` tuần 9 để hỗ trợ cả Keycloak (local) và Cognito (staging).
5. **Message Queue:** Sử dụng **Amazon SQS** (serverless, miễn phí 1 triệu requests/tháng). Module outbox/worker của backend sử dụng interface trừu tượng `EventBus` (publish) và `EventConsumer` (consume) trong `src/messaging/` (chọn driver qua biến `QUEUE_DRIVER=rabbitmq|sqs`), giúp đổi môi trường mà không ảnh hưởng tới business logic.
6. **Mạng ra (Egress) của App Runner & Worker:** Khi gắn VPC Connector vào Private Subnet, toàn bộ outbound traffic của API đi qua VPC. Do Cognito JWKS là public endpoint không hỗ trợ Interface VPC Endpoint (PrivateLink), nhóm triển khai **NAT Instance `t4g.nano`** (~$8.30/tháng, đã gồm public IPv4 của NAT instance) tại Public Subnet, tắt ngoài giờ demo, để API và Worker gọi được Cognito JWKS, Secrets Manager, SQS và SMTP mà vẫn giữ chi phí thấp.
7. **Chi phí:** Dự toán khi chạy 24/7 là **~$56.80 USD/tháng** (dao động 54–59 USD), dưới hạn mức thẻ 1.500.000 VNĐ (~60 USD) của TV3 Bảo và trần môn học (< 100 USD/tháng). Biên an toàn chỉ ~3 USD nên tắt NAT, worker, API và RDS ngoài giờ demo (`infra/README.md` mục 5.3). Worker chạy trong Private Subnet qua NAT, không gán public IP cho task.

**Trade-off & Kế hoạch quản trị rủi ro:**
1. **Tài khoản và thẻ thanh toán:** AWS yêu cầu thẻ thanh toán quốc tế. Nhóm sử dụng tài khoản AWS cá nhân của TV3 (Bảo) liên kết thẻ Debit đã cài hạn mức chi tiêu tối đa 1.500.000 VNĐ (~60 USD), kết hợp đăng ký gói credit sinh viên qua AWS Educate / GitHub Student Developer Pack.
2. **Kiểm soát chi phí:** Thiết lập AWS Budgets gửi email cảnh báo tự động về nhóm ở 3 mốc (ngân sách 50 USD/tháng):
   - **25 USD (50% ngân sách)**: Cảnh báo sớm để rà soát log và lưu lượng.
   - **40 USD (80% ngân sách)**: Cảnh báo khẩn cấp để kiểm tra các tài nguyên nhàn rỗi hoặc lưu lượng NAT.
   - **50 USD (100% ngân sách)**: Kích hoạt quy trình hạ cấu hình hoặc tạm tắt container ngoài giờ demo.
3. **Phương án dự phòng (Fallback Plan):**
   - Đã trao đổi và được **TV2 (Thanh) xác nhận đồng ý** cung cấp tài khoản **Azure for Students ($100 credit miễn phí không cần thẻ tín dụng)** làm phương án dự phòng chính thức.
   - Nếu tài khoản AWS gặp sự cố hạn mức hoặc thẻ thanh toán trong tuần 9, nhóm chuyển ngay sang **Microsoft Azure** (Azure Container Apps + Azure Database for PostgreSQL Flexible Server) theo phương án B mà không phải sửa code ứng dụng nhờ tính tương thích của container OCI và PostgreSQL.

**Tiêu chí nghiệm thu:**
- Tài khoản AWS được kích hoạt và cài đặt AWS Budget cảnh báo ở 25 USD, 40 USD, 50 USD.
- Bảng mapping 7 capability sang dịch vụ AWS cụ thể được phê duyệt trong `docs/cloud/mapping.md`.
- Dự toán chi phí chi tiết đồng bộ ở mức ~56,80 USD/tháng khi chạy 24/7 (dưới hạn mức thẻ 60 USD; tắt ngoài giờ demo để giữ dưới ngân sách 50 USD/tháng), khớp với Terraform (`network.tf`, `budgets.tf`, `sqs_worker.tf`).
- Viết được mã Terraform (IaC) dựng lại toàn bộ hạ tầng staging trên AWS trong tuần 9.

**Khi nào xem lại:**
Nếu tài khoản AWS bị giới hạn quota hoặc chi phí thực tế tuần 9 vượt quá 50 USD/tháng (ngân sách AWS Budgets) hoặc chạm ngưỡng 60 USD (hạn mức thẻ thanh toán 1.500.000 VNĐ của TV3 Bảo), nhóm sẽ chuyển đổi hạ tầng sang Microsoft Azure theo phương án dự phòng B.
