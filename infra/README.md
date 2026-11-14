# Hạ tầng Cloud AWS Staging bằng Terraform

Thư mục này chứa mã nguồn Infrastructure as Code (IaC) bằng **Terraform** để thiết lập toàn bộ môi trường Staging trên **Amazon Web Services (AWS)** cho dự án Enterprise HR Platform, tuân thủ quyết định kiến trúc [ADR-12](../docs/cloud/mapping.md).

---

## 1. Cấu trúc thư mục

```
infra/
├── .gitignore               # Loại trừ *.tfstate, *.tfvars nhạy cảm, .terraform/
├── README.md                # Tài liệu hướng dẫn vận hành hạ tầng
├── bootstrap/               # Khởi tạo S3 Bucket & DynamoDB Table lưu remote state & lock
│   ├── main.tf
│   ├── outputs.tf
│   └── variables.tf
└── staging/                 # Toàn bộ tài nguyên môi trường Staging
    ├── main.tf              # Terraform block, provider AWS, random suffix, tags
    ├── variables.tf         # Khai báo biến đầu vào
    ├── terraform.tfvars.example # File mẫu cấu hình biến
    ├── outputs.tf           # Các đầu ra (URLs, IDs, ARNs - không lộ secret)
    ├── network.tf           # VPC, 2 Public Subnets, 2 Private Subnets, IGW, NAT instance t4g.nano
    ├── security_groups.tf   # Security Groups cho App Runner, RDS, ECS Worker
    ├── kms_secrets.tf       # KMS Key, random DB password, random FIELD_ENCRYPTION_KEY, Secrets Manager
    ├── rds.tf               # RDS PostgreSQL 16 db.t4g.micro, automated backup 7 ngày
    ├── ecr.tf               # ECR Repositories (hr-api, hr-web) & lifecycle policies
    ├── app_runner.tf        # AWS App Runner API (VPC Connector, IAM roles, env & secrets)
    ├── sqs_worker.tf        # SQS Queue + DLQ, ECS Cluster & Fargate Service cho Worker
    ├── s3_cloudfront.tf     # S3 Bucket Frontend SPA & Docs, CloudFront Distribution (OAC)
    ├── cognito.tf           # Cognito User Pool, Web Client PKCE, 4 Groups & 4 Demo Users
    ├── budgets.tf           # AWS Budgets cảnh báo chi phí tại 25 / 40 / 50 USD
    └── iam_oidc.tf          # GitHub Actions OIDC Provider & IAM Deploy Role
```

---

## 2. Hướng dẫn khởi tạo Remote State (Bootstrap)

Trước khi chạy hạ tầng staging lần đầu, cần tạo S3 bucket và DynamoDB table để lưu trữ file trạng thái (`terraform.tfstate`) và khóa trạng thái (state locking):

### Bước 1: Khởi tạo bootstrap
```bash
cd infra/bootstrap
terraform init
terraform plan -out bootstrap.tfplan
terraform apply bootstrap.tfplan
```

### Bước 2: Kích hoạt S3 backend trong `staging/main.tf`
Lấy thông tin `backend_config_snippet` từ output của bước bootstrap, mở file `infra/staging/main.tf` và bỏ comment khối `backend "s3"`:

```hcl
terraform {
  backend "s3" {
    bucket         = "<tên-bucket-tfstate-vừa-tạo>"
    key            = "staging/terraform.tfstate"
    region         = "ap-southeast-1"
    dynamodb_table = "<tên-bảng-tflocks-vừa-tạo>"
    encrypt        = true
  }
}
```

---

## 3. Quy trình triển khai Staging (`terraform plan` & `apply`)

> [!IMPORTANT]
> **Quy ước nhóm:** Chỉ chạy `terraform apply` sau khi Trưởng nhóm (TV1) duyệt kết quả `terraform plan`. Không tự ý apply trực tiếp.

### 3.1. Lưu ý quan trọng cho lần triển khai đầu tiên (Bootstrap Deployment)
Do **AWS App Runner** và **ECS Fargate Task Definition** yêu cầu image container đã tồn tại trong ECR (`hr-api:latest`), trong khi ECR repository mới được tạo lần đầu còn rỗng, quy trình triển khai lần đầu cần thực hiện theo 3 bước:

```bash
cd infra/staging
terraform init

# Bước 1 (chỉ làm sau khi TV1 đã duyệt plan): tạo trước ECR Repositories bằng -target
terraform apply -target=aws_ecr_repository.api -target=aws_ecr_repository.web -auto-approve

# Bước 2: Đăng nhập ECR và push image ban đầu (:latest)
aws ecr get-login-password --region ap-southeast-1 | docker login --username AWS --password-stdin <aws_account_id>.dkr.ecr.ap-southeast-1.amazonaws.com
docker build -t <aws_account_id>.dkr.ecr.ap-southeast-1.amazonaws.com/hr-api:latest ./backend
docker push <aws_account_id>.dkr.ecr.ap-southeast-1.amazonaws.com/hr-api:latest

# Bước 3: Tạo plan toàn bộ tài nguyên còn lại và gửi TV1 duyệt
terraform plan -out plan.tfplan

# Bước 4: Áp dụng toàn bộ sau khi TV1 phê duyệt
terraform apply plan.tfplan
```

---

## 4. Danh sách tài nguyên triển khai

| Tài nguyên | Dịch vụ AWS | Cấu hình & Ghi chú |
|---|---|---|
| **Mạng (Network)** | VPC, Subnets, IGW, NAT | 1 VPC (`10.0.0.0/16`), 2 Public Subnets, 2 Private Subnets. 1 NAT instance `t4g.nano` (Amazon Linux 2023 ARM, IMDSv2, không SSH key) tại Public Subnet 1 thay cho NAT Gateway để giữ chi phí dưới hạn mức (ADR-12, phương án B2); cho App Runner VPC Connector gọi Cognito JWKS, Secrets Manager, SQS và Fargate worker ra ngoài. |
| **Cơ sở dữ liệu** | RDS PostgreSQL 16 | Instance `db.t4g.micro`, 20 GB gp3 SSD, Single-AZ trong Private Subnet, Backup tự động lưu 7 ngày. |
| **Quản lý khóa & bí mật** | Secrets Manager & KMS | 1 Customer Managed KMS Key. Mật khẩu DB và khóa `FIELD_ENCRYPTION_KEY` (32 bytes base64) sinh ngẫu nhiên bảo mật, lưu trực tiếp vào Secrets Manager. |
| **Container Registry** | Amazon ECR | 2 Repositories: `hr-api` và `hr-web`, bật scan lỗ hổng khi push image, giữ tối đa 10 tags mới nhất. |
| **Backend API Compute** | AWS App Runner | Cấu hình 0.5 vCPU, 1 GB RAM, gắn VPC Connector nối trực tiếp RDS trong Private Subnet; nạp secrets từ Secrets Manager. |
| **Async Worker Compute** | ECS Fargate & SQS | SQS Standard Queue + DLQ (maxReceiveCount = 5). ECS Cluster chạy 1 Task Fargate 24/7 (0.25 vCPU, 0.5 GB RAM, lệnh `node dist/worker/main.js`). |
| **Frontend Web & Docs** | S3 & CloudFront | 2 S3 Buckets (Web SPA và Docs) chặn 100% public access. CloudFront OAC phân phối HTTPS toàn cầu, định tuyến SPA (rewrite 403/404 về `/index.html`). |
| **Định danh & Phân quyền** | Cognito User Pool | User Pool OIDC với Authorization Code + PKCE. 4 nhóm: `employee`, `manager`, `hr`, `admin` và 4 tài khoản demo sẵn sàng kiểm thử. |
| **Giám sát ngân sách** | AWS Budgets | Cảnh báo tự động gửi email tới ban quản trị khi chi phí chạm mốc **25 USD (50%)**, **40 USD (80%)**, và **50 USD (100%)**. |
| **CI/CD Deployment** | IAM OIDC Provider | Xác thực GitHub Actions qua OIDC Federation (không tạo static access keys lâu dài), cấp quyền tối thiểu để push ECR, update App Runner, ECS, và S3. |

---

## 5. Hướng dẫn Deploy, Rollback và Tắt Staging để tiết kiệm chi phí

### 5.1. Triển khai ứng dụng (Deploy)
Pipeline CI/CD `.github/workflows/deploy-staging.yml` sẽ tự động thực thi khi có commit trên nhánh `dev`:
1. Build và gắn tag image backend/frontend theo commit SHA (`${{ github.sha }}`).
2. Push images lên ECR `hr-api` và `hr-web`.
3. Chạy database migration một lần bằng task ECS Fargate (`npx typeorm migration:run -d dist/database/data-source.js`).
4. Cập nhật App Runner API và ECS Worker trỏ sang image SHA mới.
5. Build Web SPA với các biến môi trường của staging, đồng bộ file lên S3 và tạo invalidation trên CloudFront.
6. Kiểm tra probe `GET /api/v1/health` để đảm bảo hệ thống phản hồi HTTP 200 OK.

### 5.2. Khôi phục phiên bản trước (Rollback)
Khi phiên bản mới gặp sự cố:
1. Xác định commit SHA hoạt động ổn định trước đó (ví dụ: `abc1234`).
2. Vào GitHub Actions -> chọn workflow **Deploy Staging** -> bấm **Run workflow**, nhập tham số `IMAGE_TAG = abc1234`.
3. Pipeline sẽ trỏ lại App Runner và ECS sang image SHA cũ mà không cần build lại.
4. Nếu có migration lỗi, chạy ECS task revert: `npx typeorm migration:revert -d dist/database/data-source.js`.

### 5.3. Quy trình tắt tạm thời Staging (Tiết kiệm ngân sách)
Khi không có lịch demo hoặc ngoài giờ làm việc, thực hiện các thao tác sau để giảm chi phí về mức tối thiểu:
1. **Tạm dừng ECS Worker:**
   ```bash
   aws ecs update-service --cluster hr-platform-staging-cluster --service hr-platform-staging-worker --desired-count 0
   ```
2. **Tạm dừng App Runner API:**
   Vào App Runner Console hoặc dùng AWS CLI bấm **Pause Service**.
3. **Tạm dừng RDS PostgreSQL:**
   ```bash
   aws rds stop-db-instance --db-instance-identifier hr-platform-staging-db
   ```
4. **Tạm dừng NAT instance** (sau khi đã dừng API và worker; public IP tự cấp được giải phóng nên không tính phí IPv4 khi dừng):
   ```bash
   aws ec2 stop-instances --instance-ids $(terraform output -raw nat_instance_id)
   ```
5. **Xóa toàn bộ hạ tầng (khi hoàn thành môn học):**
   ```bash
   cd infra/staging
   terraform destroy
   ```

---

## 6. Danh sách GitHub Secrets & Variables phục vụ CI/CD Staging

Sau khi chạy `terraform apply`, lấy các giá trị từ `terraform output` để cấu hình trong repository Settings (mục **Secrets and variables -> Actions**):

| Tên biến / Secret | Loại | Giá trị lấy từ Terraform Output | Mục đích sử dụng |
|---|---|---|---|
| `AWS_DEPLOY_ROLE_ARN` | Secret | `github_actions_role_arn` | IAM Role ARN để GitHub Actions assume qua OIDC |
| `AWS_REGION` | Variable | `ap-southeast-1` (hoặc biến cấu hình) | AWS Region của staging |
| `STAGING_API_BASE_URL` | Variable | `app_runner_service_url` (bỏ path `/api/v1`) | Base URL của App Runner API phục vụ health check |
| `STAGING_API_URL` | Variable | `app_runner_service_url` + `/api/v1` | Endpoint API REST cung cấp cho Web bundle (`VITE_API_URL`) |
| `STAGING_OIDC_AUTHORITY` | Variable | `cognito_user_pool_endpoint` | URL OIDC Issuer của Cognito cung cấp cho Web (`VITE_OIDC_AUTHORITY`) |
| `STAGING_OIDC_CLIENT_ID` | Variable | `cognito_client_id` | Cognito Web Client ID (`VITE_OIDC_CLIENT_ID`) |
| `VITE_OIDC_LOGOUT_URL` | Variable | `oidc_logout_url` | URL đăng xuất Cognito Hosted UI |
| `S3_WEB_BUCKET` | Variable | `s3_web_bucket` | Tên S3 Bucket lưu trữ mã tĩnh frontend Web SPA |
| `CLOUDFRONT_DISTRIBUTION_ID` | Variable | ID từ `aws_cloudfront_distribution.web` | ID CDN CloudFront cần xóa cache (invalidation) khi deploy |

---

## 7. Kế hoạch triển khai AWS Staging Tuần 12–13 (Rollout Plan)

Căn cứ quyết định của Nhóm trưởng (10/11/2026), hạ tầng AWS Staging được lùi thời điểm khởi tạo sang **Tuần 12 và 13** nhằm tối ưu chi phí thẻ Debit (~60 USD). Dưới đây là kế hoạch chi tiết cho giai đoạn này:

### 7.1. Thứ tự các bước triển khai (Đầu tuần 12)

| Bước | Nội dung công việc | Người thực hiện | Thời gian ước tính | Tiêu chí nghiệm thu |
|---|---|---|---|---|
| **1** | Khởi tạo Remote State Bootstrap (`infra/bootstrap/`) | TV3 (Bảo) | 15 phút | S3 bucket & DynamoDB table khóa trạng thái hoạt động |
| **2** | Kích hoạt S3 backend và tạo trước ECR Repositories | TV3 (Bảo) | 15 phút | `terraform apply -target=aws_ecr_repository.api -target=aws_ecr_repository.web` thành công |
| **3** | Build và push image khởi tạo (`:latest`) lên ECR | TV3 (Bảo) | 20 phút | ECR `hr-api` và `hr-web` có ít nhất 1 image tag `:latest` |
| **4** | Chạy `terraform plan` toàn bộ staging và gửi review | TV3 (Bảo) | 10 phút | File plan sạch, không lộ secret, TV1 phê duyệt |
| **5** | Áp dụng hạ tầng staging (`terraform apply`) | TV3 (Bảo) | 25 phút | Toàn bộ 40+ tài nguyên AWS tạo thành công |
| **6** | Cấu hình GitHub Actions Secrets & Variables | TV3 (Bảo) | 10 phút | Đủ 9 biến theo bảng mục 6 trong repo settings |
| **7** | Kích hoạt tự động deploy hoặc chạy tay pipeline | TV3 & TV1 | 15 phút | Workflow `deploy-staging.yml` chạy qua và API health check 200 |
| **8** | Chạy seed dữ liệu mẫu 2,000 nhân viên trên AWS RDS | TV1 (Dương) | 10 phút | DB RDS có đủ 2,000 nhân viên và 4 tài khoản demo |
| **9** | Smoke test staging với 4 tài khoản | TV4 (Duy) | 45 phút | Đăng nhập 4 vai trò, thử luồng nghỉ phép và xem tài liệu |

### 7.2. Dự toán chi phí và lịch trình bật/tắt (2 tuần: Tuần 12 & 13)

- **Dự toán tổng 2 tuần:** Dựa trên chi phí 24/7 (~$56.80 USD/tháng), khi chạy 2 tuần (14 ngày), chi phí danh định là **~$28.40 USD**.
- **Chiến lược tiết kiệm tối đa:** Tắt NAT instance, ECS worker và RDS ngoài giờ demo/kiểm thử để chi phí thực tế xuống dưới **$15–20 USD**, đảm bảo cách xa hạn mức thẻ thanh toán (1.500.000 VNĐ ~ 60 USD).
- **Lịch trình bật/tắt cụ thể:**
  - *Giờ bật (Active hours):* 08:30 – 18:00 các ngày kiểm thử và buổi báo cáo/bảo vệ đồ án.
  - *Quy trình tắt cuối ngày (18:00):* Thực hiện tuần tự theo mục 5.3:
    1. Dừng ECS Worker (`desired-count = 0`).
    2. Pause service AWS App Runner.
    3. Stop RDS PostgreSQL (`aws rds stop-db-instance`).
    4. Stop NAT instance (`aws ec2 stop-instances`).
  - *Quy trình bật lại đầu ngày:* Khởi động theo thứ tự: NAT instance -> RDS instance (chờ available) -> Resume App Runner -> Bật lại ECS Worker (`desired-count = 1`).

### 7.3. Kịch bản diễn tập Rollback (Tuần 12)

Nhóm sẽ thực hiện một lượt diễn tập rollback có kiểm soát trong Tuần 12:
1. Ghi nhận `IMAGE_TAG` của bản build ổn định trước đó (ví dụ tag commit PR tuần 11).
2. TV1 cố ý tạo một commit gắn nhãn lỗi thử nghiệm trên nhánh test và trigger deploy.
3. TV3 kích hoạt workflow **Deploy Staging** với tham số `IMAGE_TAG` của bản cũ.
4. TV4 kiểm tra lại endpoint `/health` và giao diện web xác nhận hệ thống đã khôi phục về trạng thái ổn định trong vòng < 5 phút.

### 7.4. Kế hoạch dọn dẹp hoàn toàn sau Tuần 13 (Teardown)

Ngay sau buổi bảo vệ đồ án kết thúc (sau ngày 7/12/2026):
1. **Chạy `terraform destroy`:**
   ```bash
   cd infra/staging
   terraform destroy -auto-approve
   ```
2. **Dọn dẹp ECR Images & S3 Buckets:**
   - Xóa các image còn lưu trong ECR Repositories.
   - Xóa S3 bucket bootstrap và DynamoDB lock table trong `infra/bootstrap/` bằng `terraform destroy`.
3. **Kiểm tra AWS Budgets & Billing Console:**
   - Đảm bảo không còn tài nguyên nào chạy ngầm (NAT, Elastic IP, RDS snapshot giữ lại).
   - Xác nhận hóa đơn cuối cùng và đóng tài khoản hoặc hủy liên kết thẻ thanh toán để an toàn 100%.

### 7.5. Quản lý Workflow Deploy trong giai đoạn chuyển tiếp

- Từ Tuần 10 đến hết Tuần 11: Workflow `.github/workflows/deploy-staging.yml` chỉ được kích hoạt thủ công (`workflow_dispatch`), không tự động chạy khi merge vào `dev` để tránh gây báo lỗi đỏ cho các PR code và docs.
- Khi hạ tầng AWS sẵn sàng ở đầu Tuần 12: TV3 sẽ bật lại trigger tự động `push: branches: [dev]` trong workflow.
