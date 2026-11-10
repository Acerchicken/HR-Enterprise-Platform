# Tuần 10 – TV3 (Bảo): chuẩn bị lên AWS, lưu trữ tài liệu, vận hành

Vai trò: chuẩn bị hạ tầng để lên AWS gọn trong tuần 12–13, giữ chi phí trong hạn mức.

> **Thay đổi ngày 10/11:** theo quyết định của nhóm trưởng, staging chỉ chạy trên AWS ở **tuần 12 và 13** để tránh phát sinh chi
> phí khi chưa cần. Tuần 10 **không `terraform apply`**, không tạo tài nguyên tính tiền. Mọi việc chạy local hoặc chỉ dừng ở mức
> code Terraform đã `validate` và `plan`.

## Hạn chót

| Hạn | Việc |
|---|---|
| **T4 (11/11), 21:00** | Mở PR `chore/minio-local` |
| T5 (12/11) | Sửa theo góp ý, được merge |
| **T5 (12/11), 21:00** | Gửi kết quả `terraform plan` thật (không `apply`) |
| **T6 (13/11), 21:00** | Mở PR `infra/documents-email` |
| **T7 (14/11), 21:00** | Mở PR `docs/aws-rollout-plan` |
| Trong 24 giờ kể từ khi PR mở | Review phần cấu hình trong PR của TV1 (`feat/documents-api`) |
| **T2 (16/11), 9:00** | Điền mục "Việc đã làm" |

## Việc cần làm

### 1. `chore/minio-local` – lưu trữ tài liệu khi chạy local

MinIO trong `docker-compose.yml`, tạo sẵn bucket `hr-documents`, biến môi trường trong `.env.example` thống nhất với TV1 (endpoint,
bucket, access key dev). Đây là chỗ TV1 chạy thử upload tài liệu trong tuần.

### 2. `terraform plan` thật, không `apply`

`plan` chỉ đọc tài khoản AWS, không tạo tài nguyên nên không tốn tiền. Làm sớm để tuần 12 không bị vướng.

1. Đặt `alert_emails` trong `terraform.tfvars` (biến bắt buộc, không commit file này).
2. Chạy `terraform plan -out plan.tfplan` ở `infra/staging/` (cần state bucket từ `infra/bootstrap/`; nếu chưa muốn tạo bucket state
   thì chạy plan với backend local và ghi rõ).
3. Gửi **dòng nguyên văn** `Plan: N to add, 0 to change, 0 to destroy` và danh sách lỗi (nếu có) cho TV1. **Không chạy `apply`.**
4. Xóa `plan.tfplan` sau khi gửi (file chứa giá trị nhạy cảm, đã nằm trong `.gitignore`).

### 3. `infra/documents-email` – code Terraform cho tài liệu và email

Chỉ viết code, chạy `terraform fmt`, `validate`, `plan`; **không `apply`**.

1. Bucket tài liệu: chặn public, mã hóa, CORS cho domain CloudFront (upload presigned), quyền IAM tối thiểu cho App Runner và worker.
2. Email: SES (sandbox cần xác minh người nhận), biến `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` cho worker; thống nhất với TV1 cấu
   hình TLS. Nếu SES không dùng được, ghi lý do và phương án thay thế.
3. Alarm CloudWatch: API 5xx, độ trễ p95, RDS CPU/kết nối, DLQ có message.
4. Cập nhật `docs/cloud/mapping.md`.

### 4. `docs/aws-rollout-plan` – kế hoạch lên AWS tuần 12–13

Thêm mục mới trong `infra/README.md`:

1. **Thứ tự triển khai** đầu tuần 12: bootstrap → ECR → push image → `apply` → GitHub vars → deploy → seed → smoke test. Ước tính
   thời gian từng bước và ai làm.
2. **Chi phí cho 2 tuần**, dựa trên dự toán 56,80 USD/tháng. Ghi giờ bật, giờ tắt NAT, worker, RDS ngoài giờ demo.
3. **Diễn tập rollback** trong tuần 12 (deploy lại image SHA cũ bằng workflow).
4. **Dọn dẹp sau tuần 13:** `terraform destroy`, xóa ECR image, kiểm tra Budgets về 0, thời điểm làm (sau buổi bảo vệ).
5. Workflow deploy tạm chỉ chạy tay (`workflow_dispatch`) cho tới tuần 12; ghi bước bật lại tự động deploy khi push vào `dev`.

## Cách làm trên git

```bash
git checkout dev && git pull
git checkout -b chore/minio-local
# sửa, commit, rồi:
git push -u origin chore/minio-local
```

Mở PR vào **`dev`** (kiểm tra base trước khi bấm Create, tuần 9 có 3 PR mở nhầm vào `main`). Điền đủ mô tả PR. Sửa trên cùng nhánh,
không đóng PR để mở PR mới.

## Góp ý review

_Góp ý ghi trực tiếp trên PR._

## Việc đã làm

_Điền T2 (16/11), 9:00._
