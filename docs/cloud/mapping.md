# Ánh xạ năng lực hệ thống sang dịch vụ Cloud & Ước tính chi phí (AWS)

Tài liệu này hiện thực hóa quyết định kiến trúc [ADR-12](../progress/tuan-08/README.md#adr-12--chọn-cloud-provider), ánh xạ 7 năng lực cốt lõi (capabilities) từ kiến trúc v1 sang các dịch vụ cụ thể trên **Amazon Web Services (AWS)** và lập bảng dự toán chi phí chi tiết hàng tháng cho môi trường Staging/Production.

---

## 1. Bảng ánh xạ 7 Năng lực cốt lõi (Capability Mapping)

Hệ thống tuân thủ nguyên tắc không bị khóa chặt vào nhà cung cấp (vendor lock-in) bằng cách sử dụng các chuẩn công nghệ mở: container OCI, cơ sở dữ liệu quan hệ PostgreSQL chuẩn, giao thức xác thực OIDC, và API lưu trữ S3-compatible.

| # | Năng lực (Capability) | Thành phần hệ thống | Dịch vụ Local (Docker) | Dịch vụ Cloud (AWS) | Lý do lựa chọn & Cấu hình |
|---|---|---|---|---|---|
| **1a** | **API Hosting & Compute** | Backend API (Modular Monolith) | Node.js container (`Dockerfile`) | **AWS App Runner** | Fully-managed container service cho HTTP workloads, tự động tích hợp Load Balancer và HTTPS certificate miễn phí; tự động scale theo số lượng HTTP request. Cấu hình: 0.5 vCPU, 1 GB RAM, auto-scaling 1–2 instances (ADR-06). |
| **1b** | **Worker Compute** | Notification & Outbox Worker | Node.js worker (`worker/`) | **Amazon ECS Fargate** | Worker cần chạy ngầm liên tục để polling message từ queue SQS. App Runner sẽ tự động giảm (throttle) CPU khi không có request HTTP đến, nên không phù hợp cho worker. ECS Fargate chạy 1 Task độc lập 24/7 với chi phí cố định thấp. Cấu hình: 0.25 vCPU, 0.5 GB RAM. |
| **2** | **Relational Database** | Dữ liệu nhân sự, tổ chức, đơn nghỉ phép, số dư, audit | PostgreSQL 16 container (`postgres:16-alpine`) | **Amazon RDS for PostgreSQL 16** | Dịch vụ CSDL quan hệ managed hoàn toàn; hỗ trợ extension `pgvector` cho RAG ở tuần 12; tự động sao lưu hàng ngày (Automated Backup) và khôi phục về điểm thời gian bất kỳ (PITR) đáp ứng RPO ≤ 1 giờ, RTO ≤ 4 giờ (ADR-00). Cấu hình: `db.t4g.micro`, 20 GB SSD gp3, Single-AZ đặt trong Private Subnet. |
| **3** | **Object Storage** | Kho tài liệu chính sách HR & hồ sơ nhân viên | MinIO / Local disk mô phỏng | **Amazon Simple Storage Service (S3)** | Độ bền 99.999999999% (11 9's), mã hóa at-rest SSE-S3 mặc định. Frontend sử dụng Presigned URL để tải và xem tài liệu trực tiếp, giảm tải cho API backend. Cấu hình: Bucket `hr-documents-storage`, Private access, Block Public Access bật 100%. |
| **4** | **Identity & Access Management (OIDC)** | Xác thực người dùng, cấp phát JWT, vai trò người dùng | Keycloak container (`quay.io/keycloak/keycloak:26.0.7`) | **Amazon Cognito User Pool** | Tuân thủ chuẩn OpenID Connect (OIDC) với Authorization Code Grant + PKCE. Miễn phí vĩnh viễn cho 50,000 người dùng hàng tháng (MAU). Backend chuyển từ Keycloak local sang Cognito chỉ qua cấu hình biến môi trường `OIDC_ISSUER` và `OIDC_JWKS_URI` (theo ADR-04). Phân quyền vai trò sử dụng Cognito Groups (`employee`, `manager`, `hr`, `admin`). |
| **5** | **Asynchronous Messaging & Queue** | Outbox pattern, hàng đợi gửi email & trích xuất văn bản | RabbitMQ container (`rabbitmq:3-management-alpine`) | **Amazon Simple Queue Service (SQS)** | Dịch vụ hàng đợi tin nhắn serverless, độ trễ thấp, tích hợp sẵn Dead-Letter Queue (DLQ). Miễn phí 1,000,000 requests/tháng. Backend xây dựng interface trừu tượng `QueueService` (local dev bind với RabbitMQ adapter qua AMQP, cloud bind với SQS adapter qua AWS SDK), đảm bảo không làm thay đổi business logic hay schema của module Leave/Worker. Cấu hình: Standard Queue `hr-leave-notifications` + DLQ. |
| **6** | **Observability & Logging** | Thu thập log ứng dụng, audit trail, giám sát chỉ số (RPS, latency p95) | Console logs / Container logs | **Amazon CloudWatch** (Logs & Metrics) | Thu thập tập trung log của backend và worker; thiết lập CloudWatch Alarms giám sát tỷ lệ lỗi (5xx > 1%), latency p95 > 500ms, và cảnh báo chi phí (Billing Alarms). Đặt log retention 14 ngày cho môi trường staging để tối ưu chi phí. |
| **7** | **Secrets & Key Management** | Khóa mã hóa cột nhạy cảm (CCCD, lương) & thông tin kết nối DB | Biến môi trường local (`.env`) | **AWS Secrets Manager** & **AWS Key Management Service (KMS)** | Quản lý vòng đời khóa bí mật tập trung. Khóa AES-256 mã hóa trường nhạy cảm theo [ADR-08](../progress/tuan-07/README.md#adr-08--mã-hóa-trường-nhạy-cảm-ở-tầng-ứng-dụng) được bảo vệ bằng KMS CMK (Customer Managed Key), tách biệt hoàn toàn khỏi database và log. |
| **+** | **Edge & Static Hosting** | Frontend Web (React SPA) & Phân phối nội dung | Nginx container (`frontend/Dockerfile`) | **Amazon S3** + **Amazon CloudFront** | Lưu trữ mã nguồn tĩnh (HTML/JS/CSS) trên S3 bucket và phân phối qua CDN CloudFront toàn cầu; tích hợp chứng chỉ SSL/TLS miễn phí từ AWS Certificate Manager (ACM). |

---

## 2. Kiến trúc Mạng tối ưu chi phí (Không dùng NAT Gateway đắt tiền)

Để tránh khoản phí cố định đắt đỏ của AWS NAT Gateway (~$32.00/tháng):
1. **Amazon RDS for PostgreSQL:** Được đặt trong **Private Subnet** (không có Public IP), chỉ chấp nhận kết nối cổng 5432 từ Security Group của Backend API (App Runner) và Worker (ECS Fargate).
2. **Backend API (AWS App Runner):** Kết nối tới RDS trong Private Subnet thông qua **App Runner VPC Connector**. Các request gọi ra ngoài AWS Services (Cognito, Secrets Manager, SQS) của App Runner tự động đi qua mạng quản lý mặc định của App Runner, không bị kẹt trong VPC.
3. **Notification Worker (Amazon ECS Fargate):** Được triển khai trong **Public Subnet** với `Assign Public IP = ENABLED`. 
   - **Bảo mật tuyệt đối:** Cấu hình Security Group cho Worker với **Inbound Rules: DENY ALL** (chặn 100% kết nối từ ngoài Internet vào Worker). Chiều ra (Outbound Rules) cho phép cổng 443 để Worker gọi SQS, Secrets Manager và SMTP email provider qua Internet Gateway hoàn toàn **miễn phí ($0.00)**.
4. **Amazon S3:** Được truy cập thông qua **VPC Gateway Endpoint** (dịch vụ có sẵn và hoàn toàn **miễn phí $0.00** của AWS VPC).

---

## 3. Dự toán chi phí hàng tháng (Monthly Cost Breakdown)

Dựa trên phân tích workload tuần 5:
- Quy mô doanh nghiệp: ~2,000 nhân viên, 1,200 người dùng hoạt động hàng ngày (DAU).
- Lưu lượng: trung bình ≈ 0.5 RPS, peak ≈ 10 RPS, thiết kế hệ thống chịu tải 50 RPS.
- Dữ liệu: ~2 GB tài liệu PDF, ~1.25 triệu bản ghi audit/năm.

Bảng dự toán chi phí ước tính tại region **ap-southeast-1 (Singapore)** (đơn vị: USD/tháng):

| Dịch vụ AWS | Cấu hình & Thông số sử dụng | Chi phí dự kiến / tháng | Ghi chú tối ưu |
|---|---|---|---|
| **AWS App Runner** (API Backend) | 0.5 vCPU, 1 GB RAM; active trong giờ hành chính (~176h) + memory provisioned giữ ấm 24/7 | **$13.50** | Đã bao gồm Application Load Balancer và chứng chỉ HTTPS tự động |
| **Amazon ECS Fargate** (Worker) | 1 Task chạy liên tục 24/7 (0.25 vCPU, 0.5 GB RAM) | **$10.50** | Task độc lập chuyên xử lý outbox queue (nếu dùng Fargate Spot giảm còn ~$3.50) |
| **Amazon RDS for PostgreSQL** | Instance `db.t4g.micro`, 20 GB Storage gp3, backup lưu 7 ngày | **$18.00** | CSDL quan hệ chính; nằm trong Free Tier 12 tháng nếu dùng tài khoản mới |
| **Amazon Cognito User Pool** | Quản lý định danh OIDC cho ~1,200 active users | **$0.00** | Miễn phí trong gói Always Free cho tối đa 50,000 MAU |
| **Amazon S3** (Kho tài liệu HR & Web SPA) | ~5 GB lưu trữ tài liệu + 20,000 requests PUT/GET | **$0.00** | Miễn phí 5 GB trong 12 tháng đầu (sau Free Tier là ~$0.25/tháng) |
| **Amazon CloudFront** | 10 GB Data Transfer Out cho frontend SPA | **$0.00** | Miễn phí trong gói Always Free 1 TB/tháng của AWS |
| **Amazon SQS** | ~100,000 requests / tháng (Outbox events + notifications) | **$0.00** | Miễn phí trong gói Always Free 1,000,000 requests/tháng |
| **Amazon CloudWatch** | 5 GB Logs ingestion + 5 CloudWatch Alarms (retention 14 ngày) | **$3.50** | 5 GB log đầu tiên được miễn phí |
| **AWS Secrets Manager & KMS** | 2 secrets (DB credentials, Encryption key) + 1 KMS Customer Managed Key | **$2.00** | $0.40/secret/tháng + $1.00/KMS key + $0.20 API calls |
| **Chi phí truyền dữ liệu (Data Transfer)** | Data Transfer Out ra ngoài Internet (~10 GB) | **$1.00** | – |
| **TỔNG CỘNG DỰ TOÁN** | | **~$48.50 / tháng** *(dao động 46–52 USD)* | **Đạt mục tiêu kiểm soát (≤ 50 USD/tháng) và dưới ngân sách (< 100 USD/tháng)** |

---

## 4. Quản trị rủi ro & Chiến lược kiểm soát chi phí

Để đảm bảo an toàn tuyệt đối cho tài chính của nhóm và tránh rủi ro nghẽn tiến độ ở Tuần 9:

1. **Quản trị tài khoản và thanh toán:**
   * Hệ thống staging sử dụng tài khoản AWS của **TV3 (Bảo)**, liên kết thẻ thanh toán quốc tế Debit đã được cài đặt hạn mức chi tiêu tối đa 1.500.000 VNĐ (~60 USD).
   * Nhóm đăng ký gói **AWS Educate / GitHub Student Developer Pack** (tài khoản `bao1022004`) để bổ sung credit hỗ trợ.

2. **Thiết lập cảnh báo ngân sách tự động (AWS Budgets):**
   * Ngưỡng 1 (**$25.00 USD - 50% mục tiêu**): Gửi email cảnh báo sớm cho TV3 (Bảo) và TV1 (Dương) để kiểm tra dung lượng log và traffic.
   * Ngưỡng 2 (**$40.00 USD - 80% mục tiêu**): Cảnh báo khẩn cấp để rà soát các tài nguyên nhàn rỗi hoặc task chạy thừa.
   * Ngưỡng 3 (**$50.00 USD - 100% mục tiêu**): Chạm trần ngân sách mục tiêu; kích hoạt quy trình hạ cấu hình hoặc tạm dừng container ngoài giờ demo.

3. **Phương án dự phòng kỹ thuật (Fallback Plan):**
   * Nếu tài khoản AWS gặp sự cố thẻ thanh toán hoặc bị giới hạn hạn mức trong tuần 9, nhóm kích hoạt ngay tài khoản **Azure for Students ($100 credit miễn phí không cần thẻ tín dụng)** của TV2 (Thanh - email `@vnu.edu.vn`) theo phương án B của ADR-12.
   * Nhờ kiến trúc sử dụng container OCI chuẩn, PostgreSQL chuẩn và giao thức OIDC, toàn bộ hệ thống có thể chuyển sang chạy trên **Azure Container Apps + Azure Database for PostgreSQL Flexible Server** mà không cần thay đổi cấu trúc mã nguồn.
