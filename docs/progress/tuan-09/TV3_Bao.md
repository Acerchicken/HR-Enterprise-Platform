# Tuần 9 – TV3 (Bảo): ADR-12, image Docker, Terraform staging, deploy staging

Vai trò: hạ tầng cloud bằng code, CI/CD. Mục tiêu cuối tuần: **staging trên AWS dựng bằng Terraform và được deploy bằng
pipeline**, không bấm tay trên AWS console (trừ bước tạo tài khoản và bucket chứa Terraform state lần đầu).

## Hạn chót

| Hạn | Việc |
|---|---|
| **T4 (4/11), 21:00** | Gửi link nhánh `docs/adr-12-cloud-provider` đã sửa 2 điểm review (việc đầu tiên, tồn từ tuần 8) |
| T5 (5/11) | Sửa theo góp ý, mở PR ADR-12, được merge |
| **T5 (5/11), 21:00** | Gửi link nhánh `ci/docker-images` |
| T6 (6/11) | Sửa theo góp ý, mở PR, được merge |
| **T7 (7/11), 12:00** | Gửi link nhánh `infra/terraform-staging` kèm kết quả `terraform plan` |
| T7 (7/11) | TV1 duyệt plan → `terraform apply` → mở PR, được merge |
| **T7 (7/11), 21:00** | Nếu thấy không kịp deploy CN: báo TV1 để cắt phạm vi (xem cuối file) |
| **CN (8/11), 12:00** | Staging chạy được qua pipeline, gửi URL + tài khoản staging cho TV4; gửi link nhánh `ci/deploy-staging` |
| Trong 24 giờ kể từ khi nhận link | Review nhánh `feat/secret-config`, `feat/auth-cognito`, `feat/queue-adapter` của TV1 (phần cấu hình, hạ tầng) |
| **T2 (9/11), 9:00** | Điền mục "Việc đã làm" ở cuối file này |

## Việc cần làm

### 1. `docs/adr-12-cloud-provider` – sửa ADR-12 (làm ngay)

PR #12 đã đóng; **dùng lại nhánh cũ**, giữ nguyên các commit đã có.

```bash
git fetch origin
git checkout docs/adr-12-cloud-provider
git pull origin dev        # sẽ xung đột ở docs/progress/tuan-08/README.md
```

1. **Chuyển nội dung ADR-12 sang `docs/progress/tuan-09/README.md` mục 3** (thay dòng "_TV3 viết theo khung…_"). Với
   `docs/progress/tuan-08/README.md`, giữ bản của `dev` (`git checkout origin/dev -- docs/progress/tuan-08/README.md`).
2. **Mạng ra của App Runner:** khi gắn VPC Connector, *toàn bộ* lưu lượng ra của API đi qua VPC. API cần gọi Cognito (JWKS),
   Secrets Manager, SQS → chọn một trong hai và ghi trade-off:
   - NAT Gateway (~32 USD/tháng + phí dữ liệu), hoặc
   - Interface VPC Endpoint cho từng dịch vụ (~7–8 USD/tháng mỗi endpoint mỗi AZ; Cognito JWKS là endpoint public nên cần
     kiểm tra có endpoint riêng không, nếu không thì vẫn cần NAT).
   Cập nhật mục 2 của `docs/cloud/mapping.md`, bảng chi phí và tổng; nếu vượt mục tiêu 50 USD thì ghi rõ.
3. **Cognito:** sửa câu "chỉ qua cấu hình biến môi trường". Ghi rõ: access token của Cognito không có claim `azp` mà dùng
   `client_id`, nhóm người dùng nằm ở `cognito:groups`; TV1 sửa module identity ở nhánh `feat/auth-cognito` tuần này.
4. Thêm public IPv4 cho task Fargate (~3,6 USD/tháng) vào bảng chi phí.
5. Hỏi TV2 (Thanh) xác nhận đồng ý dùng tài khoản Azure for Students của Thanh cho phương án dự phòng; ghi kết quả vào ADR.

### 2. `ci/docker-images` – build và quét image trên CI

1. Thêm job vào `.github/workflows/ci.yml` (hoặc file mới `docker.yml`) chạy trên mọi PR vào `dev`/`main`:
   - build image `backend/Dockerfile` (dùng cho cả API và worker: worker chạy lệnh `node dist/worker/main.js`) và
     `frontend/Dockerfile`; dùng `docker/build-push-action` với cache GitHub Actions;
   - quét bằng Trivy (`aquasecurity/trivy-action`), **fail khi có lỗ hổng CRITICAL** có bản sửa (`ignore-unfixed: true`).
2. Chưa push image ở bước này (push cần quyền AWS, làm ở việc 4).
3. Kiểm tra `backend/Dockerfile` và `frontend/Dockerfile`: chạy bằng user không phải root, không copy `.env` hay file test vào
   image (thêm `.dockerignore` nếu thiếu). Ghi kết quả vào mô tả PR.

### 3. `infra/terraform-staging` – hạ tầng staging bằng Terraform

Theo ADR-12 sau khi sửa. Thư mục `infra/` (đặt tên theo `CONVENTIONS.md`: nhánh `infra/...`).

1. **State:** S3 bucket + DynamoDB table để lock (tạo một lần bằng tay hoặc thư mục `infra/bootstrap/`), ghi cách tạo vào
   `infra/README.md`.
2. **Tài nguyên** (`infra/staging/`, chia file theo nhóm):
   - mạng: VPC, subnet public/private, security group; NAT hoặc VPC endpoint theo ADR-12;
   - RDS PostgreSQL 16 `db.t4g.micro` trong private subnet, backup 7 ngày;
   - Secrets Manager: mật khẩu DB, `FIELD_ENCRYPTION_KEY` (sinh bằng `random_password`/`random_bytes`, **không ghi giá trị vào
     code hay output**); KMS key;
   - ECR: repo `hr-api`, `hr-web`;
   - App Runner cho API (VPC Connector tới RDS), biến môi trường không bí mật + secret lấy từ Secrets Manager;
   - ECS Fargate 1 task cho worker (cùng image API, lệnh `node dist/worker/main.js`); SQS queue + DLQ;
   - S3 + CloudFront cho web;
   - Cognito user pool, app client cho web, 4 group `employee`, `manager`, `hr`, `admin`, 4 user demo;
   - AWS Budgets cảnh báo 25/40/50 USD;
   - IAM role cho GitHub Actions dùng **OIDC** (không tạo access key lâu dài), chỉ quyền push ECR và deploy.
3. Chạy `terraform fmt`, `terraform validate`, `terraform plan -out plan.tfplan`; dán phần tóm tắt plan (số tài nguyên tạo
   mới, không có secret) vào tin nhắn gửi link review. **Chỉ `apply` sau khi TV1 đồng ý.**
4. Không commit `*.tfstate`, `*.tfvars` có secret, `.terraform/` (thêm `.gitignore`).

### 4. `ci/deploy-staging` – pipeline deploy staging

1. Workflow `.github/workflows/deploy-staging.yml`, chạy khi có commit mới trên `dev` và chạy tay được (`workflow_dispatch`):
   đăng nhập AWS qua OIDC → build + push image lên ECR (tag theo commit SHA) → chạy migration (task ECS chạy một lần lệnh
   `npx typeorm migration:run -d dist/database/data-source.js`) → cập nhật App Runner và ECS service → build web với biến
   `VITE_*` của staging, upload S3, invalidate CloudFront → gọi `/api/v1/health` để kiểm tra.
2. Seed dữ liệu demo cho staging một lần (task chạy `node dist/database/seed.js`), ghi lại cách làm.
3. Deploy lần đầu trước **CN (8/11), 12:00**. Gửi TV4 và cả nhóm: URL web, URL API, 4 tài khoản demo trên Cognito.
4. Ghi vào `infra/README.md`: cách deploy, cách rollback (deploy lại image SHA cũ), cách tắt staging để tiết kiệm chi phí.

### Nếu không kịp

Báo TV1 trước **T7 (7/11), 21:00**. Phạm vi tối thiểu tuần 9: RDS + API trên App Runner + web trên S3/CloudFront + Cognito.
Worker, SQS, CloudWatch alarm chuyển sang tuần 10.

## Cách làm trên git (quy trình mới)

```bash
git checkout dev && git pull
git checkout -b ci/docker-images
# sửa file, rồi:
git add .github/workflows/
git commit -m "ci: build and scan Docker images on pull requests"
git push -u origin ci/docker-images
```

Sau đó **chưa mở PR**: gửi link `https://github.com/Acerchicken/HR-Enterprise-Platform/compare/dev...ci/docker-images` vào
nhóm chat. Đợi góp ý ở mục "Góp ý review" bên dưới, sửa trên cùng nhánh, hết góp ý "cần sửa" thì `git pull origin dev`, rồi
mới mở PR vào `dev` (base = `dev`, kiểm tra kỹ trước khi bấm Create).

## Góp ý review

_TV1 ghi góp ý vào đây trước khi bạn mở PR. Mỗi dòng: ngày, nhánh, người góp ý, nội dung ("cần sửa" hoặc "nit:"), trạng thái._

| Ngày | Nhánh | Người góp ý | Góp ý | Trạng thái |
|---|---|---|---|---|
| 30/10 | `docs/adr-12-cloud-provider` | TV1 | Cần sửa: mạng ra của App Runner khi gắn VPC Connector phải qua NAT hoặc VPC endpoint; cộng chi phí | Đã sửa |
| 30/10 | `docs/adr-12-cloud-provider` | TV1 | Cần sửa: chuyển sang Cognito cần sửa module identity (`azp` → `client_id`, `cognito:groups`) | Đã sửa |
| 30/10 | `docs/adr-12-cloud-provider` | TV1 | nit: thêm chi phí public IPv4 cho Fargate; xác nhận Thanh đồng ý dùng tài khoản Azure | Đã sửa |
| 5/11 | tất cả nhánh | TV1 | **Sai quy trình:** 4 PR (#30–#33) được mở thẳng, chưa gửi link nhánh để review trước (CONVENTIONS mục 6, bước 4). Từ lần sau gửi link trước, hết "cần sửa" mới mở PR | Ghi nhận |
| 5/11 | `docs/adr-12-cloud-provider` | TV1 | Đã sửa đủ 3 góp ý 30/10, nhưng gửi lúc 5/11 09:46 (trễ ~13 giờ so với hạn 4/11 21:00) | Ghi nhận |
| 5/11 | `docs/adr-12-cloud-provider` | TV1 | Cần sửa: dự toán ~84,65 USD/tháng nhưng thẻ thanh toán giới hạn 1.500.000 VNĐ (~60 USD) → tháng đầu sẽ bị từ chối thanh toán. Chọn: giảm chi phí (NAT instance `t4g.nano` thay NAT Gateway, tắt NAT ngoài giờ demo) để dự toán dưới 60 USD, hoặc nâng hạn mức/credit; cập nhật ADR + `mapping.md` cho khớp | Chưa sửa |
| 5/11 | `docs/adr-12-cloud-provider` | TV1 | Cần sửa: repo đang public, bỏ email cá nhân của Thanh khỏi ADR (chỉ ghi "TV2 (Thanh) đã đồng ý") | Chưa sửa |
| 5/11 | `docs/adr-12-cloud-provider` | TV1 | Cần sửa: số liệu lệch giữa ADR và Terraform: ADR ghi Budgets 40/70/85 USD, `budgets.tf` là 25/40/50 USD; `mapping.md` ghi worker ở public subnet + phí public IPv4, `sqs_worker.tf` đặt worker ở private subnet qua NAT (đúng hơn, bỏ phí IPv4). Chốt một bộ số | Chưa sửa |
| 5/11 | `ci/docker-images` | TV1 | Cần sửa: job backend để `exit-code: '1'`, `severity: CRITICAL`; cấu hình `scanners: 'vuln'` để chặn lỗ hổng CRITICAL có bản sửa | Đã sửa |
| 5/11 | `ci/docker-images` | TV1 | Cần sửa: mô tả PR ghi frontend chạy bằng user nginx, dùng `nginxinc/nginx-unprivileged` (cổng 8080, sửa `nginx.conf` và `docker-compose.yml`) | Đã sửa |
| 5/11 | `ci/docker-images` | TV1 | nit: bỏ `apk upgrade` ở stage build (không vào image cuối); gộp commit khi merge (squash) | Đã sửa |
| 5/11 | `infra/terraform-staging` | TV1 | Cần sửa: biến môi trường App Runner không khớp với app. App đọc `AUTH_MODE`, `OIDC_ISSUER`, `OIDC_JWKS_URI`, `OIDC_ALLOWED_CLIENTS`, `CORS_ORIGIN`, `RABBITMQ_URL`/`SMTP_*` (xem `backend/src/config/config.ts`); Terraform đặt `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `SQS_QUEUE_URL` mà app không đọc → API sẽ xác thực theo Keycloak localhost và chặn CORS từ CloudFront. Đặt `OIDC_ISSUER = https://cognito-idp.<region>.amazonaws.com/<pool>`, `OIDC_ALLOWED_CLIENTS = <web client id>`, `CORS_ORIGIN = https://<cloudfront>`; biến queue thống nhất với TV1 ở `feat/queue-adapter` | Chưa sửa |
| 5/11 | `infra/terraform-staging` | TV1 | Bổ sung cho dòng trên: biến cho Cognito đã có ở nhánh `feat/auth-cognito` của TV1: `OIDC_ISSUER`, `OIDC_JWKS_URI` (`<issuer>/.well-known/jwks.json`), `OIDC_ALLOWED_CLIENTS=<web client id>`, `OIDC_CLIENT_CLAIM=client_id`, `OIDC_ROLES_CLAIM=cognito:groups`, `OIDC_USERINFO_URL=https://<domain>.auth.<region>.amazoncognito.com/oauth2/userInfo` (cần `aws_cognito_user_pool_domain` và scope `openid email` cho app client). Web cần thêm `VITE_OIDC_LOGOUT_URL=https://<domain>.../logout` và đăng ký logout URL trên app client. TLS DB ở nhánh `feat/secret-config`: `DB_SSL=require` | Chưa sửa |
| 5/11 | `infra/terraform-staging` | TV1 | Cần sửa: `rds.force_ssl = 0` tắt bắt buộc TLS tới DB, ngược mục tiêu tuần bảo mật. Đặt `1`; TV1 thêm cấu hình TLS cho kết nối DB ở `feat/secret-config` (`DB_SSL=true`) | Chưa sửa |
| 5/11 | `infra/terraform-staging` | TV1 | Cần sửa: trust policy của role GitHub Actions cho `repo:...:*` (mọi nhánh, mọi PR). Giới hạn `repo:Acerchicken/HR-Enterprise-Platform:ref:refs/heads/dev` (thêm `main` khi có production) | Chưa sửa |
| 5/11 | `infra/terraform-staging` | TV1 | Cần sửa: App Runner tạo với image `:latest` nhưng ECR còn rỗng lúc `apply` lần đầu → tạo service sẽ lỗi. Ghi thứ tự trong `infra/README.md` (tạo ECR → push image đầu tiên → tạo App Runner) hoặc tách bằng `-target` | Chưa sửa |
| 5/11 | `infra/terraform-staging` | TV1 | Cần làm: gửi tóm tắt `terraform plan` (số tài nguyên, không có secret) như kế hoạch, và cho biết đã `apply` chưa. Chưa `apply` khi chưa có góp ý "đạt" | Chưa làm |
| 5/11 | `ci/deploy-staging` | TV1 | Cần sửa: `VITE_API_URL` dùng `vars.STAGING_API_URL` có sẵn `/api/v1`, bước health check lại nối thêm `/api/v1/health` → gọi `/api/v1/api/v1/health`. Tách 2 biến (`STAGING_API_BASE_URL` không có `/api/v1`) | Chưa sửa |
| 5/11 | `ci/deploy-staging` | TV1 | Cần sửa: các biến `VITE_*` có giá trị mặc định localhost → thiếu biến thì vẫn build và deploy bản web hỏng. Thiếu biến thì cho job fail | Chưa sửa |
| 5/11 | `ci/deploy-staging` | TV1 | nit: ghi trong `infra/README.md` danh sách GitHub `vars`/`secrets` cần tạo và lấy từ `terraform output` nào | Chưa sửa |

## Việc đã làm

_Điền T2 (9/11), 9:00._
