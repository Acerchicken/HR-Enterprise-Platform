# ADR-12 – Chọn cloud provider

| Mục | Nội dung |
|---|---|
| Trạng thái | **Đã chấp nhận** |
| Ngày quyết định | 8/11/2026 (PR #52) |
| Thời điểm | Tuần 8 – 9 (26/10 – 9/11/2026) |
| Người viết | TV3 (Bảo) |
| Góc nhìn | Hệ thống |
| ADR liên quan | ADR-00, ADR-03, ADR-06 |
| Nguồn gốc | Mục quyết định trong [tuần 9](../../progress/tuan-09/README.md) |

## Lịch sử thay đổi

- Tuần 8: bản đề xuất đầu tiên (PR #12) bị đóng vì còn 2 điểm cần sửa; ADR chưa chốt trong tuần 8.
- 8/11/2026: bản sửa được merge (PR #52) và được chấp nhận. Nội dung dưới đây là bản này.
- 10/11/2026: chỉ tạo tài nguyên AWS ở tuần 12–13 để giảm chi phí ([tuần 10, mục 3](../../progress/tuan-10/README.md#lùi-thời-điểm-chạy-staging-trên-aws-sang-tuần-1213-10112026)). Lựa chọn AWS không đổi.

## Nội dung quyết định

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
