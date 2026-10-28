# Ánh xạ năng lực hệ thống sang dịch vụ Cloud & Ước tính chi phí (AWS)

Tài liệu này hiện thực hóa quyết định kiến trúc [ADR-12](../progress/tuan-08/README.md#adr-12--chọn-cloud-provider), ánh xạ 7 năng lực cốt lõi (capabilities) từ kiến trúc v1 sang các dịch vụ cụ thể trên **Amazon Web Services (AWS)** và lập bảng dự toán chi phí hàng tháng cho môi trường Staging/Production.

---

## 1. Bảng ánh xạ 7 Năng lực cốt lõi (Capability Mapping)

Hệ thống tuân thủ nguyên tắc không bị khóa chặt vào nhà cung cấp (vendor lock-in) bằng cách sử dụng các chuẩn công nghệ mở: container OCI, cơ sở dữ liệu quan hệ PostgreSQL chuẩn, giao thức xác thực OIDC, và API lưu trữ S3-compatible.

| # | Năng lực (Capability) | Thành phần hệ thống | Dịch vụ Local (Docker) | Dịch vụ Cloud (AWS) | Lý do lựa chọn & Cấu hình |
|---|---|---|---|---|---|
| **1** | **Application Hosting & Compute** | Backend API (Modular Monolith) & Notification Worker | Node.js container (`Dockerfile`) | **AWS App Runner** (hoặc **Amazon ECS Fargate**) | Fully-managed container, tự động mở rộng theo tải, tích hợp TLS và load balancing; không cần quản lý cụm máy chủ hay Kubernetes (ADR-06). Cấu hình: 0.5 vCPU, 1 GB RAM, 2 instances sau Load Balancer. |
| **2** | **Relational Database** | Dữ liệu nhân sự, tổ chức, đơn nghỉ phép, số dư, audit | PostgreSQL 16 container (`postgres:16-alpine`) | **Amazon RDS for PostgreSQL 16** | Dịch vụ CSDL quan hệ managed hoàn toàn; hỗ trợ extension `pgvector` cho RAG ở tuần 12; tự động sao lưu hàng ngày (Automated Backup) và khôi phục về điểm thời gian bất kỳ (PITR) đáp ứng RPO ≤ 1 giờ, RTO ≤ 4 giờ (ADR-00). Cấu hình: `db.t4g.micro`, 20 GB SSD gp3, Single-AZ. |
| **3** | **Object Storage** | Kho tài liệu chính sách HR & hồ sơ nhân viên | MinIO / Local disk mô phỏng | **Amazon Simple Storage Service (S3)** | Độ bền 99.999999999% (11 9's), mã hóa at-rest SSE-S3 mặc định. Frontend sử dụng Presigned URL để tải và xem tài liệu trực tiếp, giảm tải cho API backend. Cấu hình: Bucket `hr-documents-storage`, Private access, Block Public Access bật 100%. |
| **4** | **Identity & Access Management (OIDC)** | Xác thực người dùng, cấp phát JWT, vai trò người dùng | Keycloak container (`quay.io/keycloak/keycloak:26.0.7`) | **Amazon ECS Fargate (Keycloak)** hoặc **Amazon Cognito User Pool** | Tuân thủ chuẩn OpenID Connect (OIDC) với Authorization Code Grant + PKCE. API backend xác thực chữ ký token bằng JWKS URI qua mạng. Cấu hình: Keycloak container kết nối RDS hoặc Cognito User Pool với 4 nhóm vai trò chuẩn (`employee`, `manager`, `hr`, `admin`). |
| **5** | **Asynchronous Messaging & Queue** | Outbox pattern, hàng đợi gửi email & trích xuất văn bản | RabbitMQ container (`rabbitmq:3-management-alpine`) | **Amazon Simple Queue Service (SQS)** (hoặc **Amazon MQ / RabbitMQ on Fargate**) | Hàng đợi tin nhắn phân tán, có sẵn cơ chế Dead-Letter Queue (DLQ) để giữ tin nhắn lỗi sau 5 lần thử lại; đảm bảo độ tin cậy của luồng Outbox tuần 8. Cấu hình: SQS Standard Queue `hr-notification-events` kèm DLQ. |
| **6** | **Observability & Logging** | Thu thập log ứng dụng, audit trail, giám sát chỉ số (RPS, latency p95) | Console logs / Container logs | **Amazon CloudWatch** (Logs & Metrics) | Thu thập tập trung log của backend và worker; thiết lập CloudWatch Alarms giám sát tỷ lệ lỗi (5xx > 1%), latency p95 > 500ms, và cảnh báo chi phí (Billing Alarms). |
| **7** | **Secrets & Key Management** | Khóa mã hóa cột nhạy cảm (CCCD, lương) & thông tin kết nối DB | Biến môi trường local (`.env`) | **AWS Secrets Manager** & **AWS Key Management Service (KMS)** | Quản lý vòng đời khóa bí mật tập trung. Khóa AES-256 mã hóa trường nhạy cảm theo [ADR-08](../progress/tuan-07/README.md#adr-08--mã-hóa-trường-nhạy-cảm-ở-tầng-ứng-dụng) được bảo vệ bằng KMS CMK (Customer Managed Key), tách biệt hoàn toàn khỏi database và log. |
| **+** | **Edge & Static Hosting** | Frontend Web (React SPA) & Phân phối nội dung | Nginx container (`frontend/Dockerfile`) | **Amazon S3** + **Amazon CloudFront** | Lưu trữ mã nguồn tĩnh (HTML/JS/CSS) trên S3 bucket và phân phối qua CDN CloudFront toàn cầu; tích hợp chứng chỉ SSL/TLS miễn phí từ AWS Certificate Manager (ACM). |

---

## 2. Dự toán chi phí hàng tháng (Monthly Cost Breakdown)

Dựa trên phân tích workload tuần 5:
- Quy mô doanh nghiệp: ~2,000 nhân viên, 1,200 người dùng hoạt động hàng ngày (DAU).
- Lưu lượng: trung bình ≈ 0.5 RPS, peak ≈ 10 RPS, thiết kế hệ thống chịu tải 50 RPS.
- Dữ liệu: ~2 GB tài liệu PDF, ~1.25 triệu bản ghi audit/năm.

Bảng dự toán chi phí ước tính tại region **ap-southeast-1 (Singapore)** (đơn vị: USD/tháng):

| Dịch vụ AWS | Cấu hình & Thông số sử dụng | Chi phí dự kiến / tháng | Ghi chú tối ưu |
|---|---|---|---|
| **AWS App Runner** (Backend + Worker) | 2 instance × (0.5 vCPU, 1 GB RAM), hoạt động liên tục | **$18.50** | Đã bao gồm load balancer và tự động quản lý chứng chỉ HTTPS |
| **Amazon RDS for PostgreSQL** | Instance `db.t4g.micro`, 20 GB Storage gp3, backup lưu 7 ngày | **$18.00** | Nằm trong AWS Free Tier 12 tháng (750 giờ/tháng) nếu dùng tài khoản mới |
| **Amazon S3** | 5 GB lưu trữ tài liệu + 20,000 requests PUT/GET | **$0.25** | Miễn phí 5 GB trong 12 tháng đầu |
| **Amazon CloudFront** | 10 GB Data Transfer Out cho frontend SPA | **$0.85** | Nằm trong gói Always Free 1 TB/tháng của AWS |
| **Amazon SQS** | ~100,000 requests / tháng (Outbox events + notifications) | **$0.05** | Miễn phí 1,000,000 requests/tháng (Always Free) |
| **Amazon CloudWatch** | 5 GB Logs ingestion + 5 CloudWatch Alarms | **$3.50** | 5 GB đầu tiên được miễn phí |
| **AWS Secrets Manager & KMS** | 2 secrets (DB credentials, Encryption key) + 1 KMS Key | **$2.00** | $0.40/secret/tháng + $1.00/KMS key |
| **Chi phí truyền dữ liệu (Data Transfer)** | Data Transfer Out nội bộ và ra ngoài Internet (~15 GB) | **$1.50** | – |
| **TỔNG CỘNG ƯỚC TÍNH** | | **~$44.65 / tháng** | **Dưới ngân sách quy định (< $100 / tháng)** |

---

## 3. Chiến lược kiểm soát & Tối ưu hóa chi phí (Cost Optimization)

Để đảm bảo an toàn tuyệt đối cho ngân sách của nhóm trong suốt 6 tuần còn lại của đồ án:

1. **Thiết lập cảnh báo ngân sách tự động (AWS Budgets):**
   * Ngưỡng 1 (50% ngân sách - $25): Gửi email cảnh báo sớm cho TV3 (Bảo) và TV1 (Dương).
   * Ngưỡng 2 (80% ngân sách - $40): Cảnh báo khẩn cấp để rà soát các tài nguyên nhàn rỗi.
   * Ngưỡng 3 (100% ngân sách - $50): Kích hoạt quy trình xem xét hạ cấu hình hoặc tạm dừng dịch vụ ngoài giờ demo.

2. **Tối ưu kiến trúc mạng (Networking):**
   * Không triển khai **NAT Gateway** riêng biệt (tiết kiệm ~$32/tháng chi phí cố định). Sử dụng AWS App Runner kết nối trực tiếp hoặc cấu hình VPC endpoints tối giản khi cần.

3. **Chính sách dọn dẹp và vòng đời dữ liệu (Lifecycle Rules):**
   * Log CloudWatch: Thiết lập thời gian lưu trữ (retention) tối đa 14 ngày cho môi trường dev/staging thay vì để vô hạn.
   * Bản ghi tạm / file rác: Cấu hình S3 Lifecycle xóa các tệp upload chưa hoàn thành (incomplete multipart uploads) sau 3 ngày.

4. **Phương án dự phòng (Fallback Plan):**
   * Nếu có phát sinh chi phí bất thường hoặc gặp khó khăn về hạn mức trên AWS, nhóm kích hoạt gói **Azure for Students ($100 credit miễn phí không cần thẻ tín dụng)** của Microsoft Azure theo phương án B của ADR-12. Nhờ kiến trúc sử dụng container và PostgreSQL chuẩn, toàn bộ hệ thống có thể chuyển sang Azure Container Apps + Azure Database for PostgreSQL trong vòng 2 ngày mà không phải thay đổi mã nguồn.
