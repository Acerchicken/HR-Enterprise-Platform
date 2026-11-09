# Tuần 10 – TV3 (Bảo): staging chạy thật, lưu trữ tài liệu, vận hành

Vai trò: đưa hệ thống lên AWS và giữ cho nó chạy, chi phí trong hạn mức.

## Hạn chót

| Hạn | Việc |
|---|---|
| **T3 (10/11), 21:00** | Gửi kết quả `terraform plan` thật; sau khi TV1 duyệt thì `apply` và deploy lần đầu; gửi URL + tài khoản cho TV4 |
| **T4 (11/11), 21:00** | Mở PR `chore/minio-local`. Staging chưa lên thì báo TV1 trước giờ này để cắt phạm vi |
| T5 (12/11) | Sửa theo góp ý, được merge |
| **T5 (12/11), 21:00** | Mở PR `infra/documents-email` |
| **T6 (13/11), 21:00** | Mở PR `infra/observability` |
| Trong 24 giờ kể từ khi PR mở | Review phần cấu hình trong PR của TV1 (`feat/documents-api`) |
| **T2 (16/11), 9:00** | Điền mục "Việc đã làm" |

## Việc cần làm

### 1. Staging chạy thật (việc đầu tiên, tồn từ tuần 9)

1. Chạy `terraform plan -out plan.tfplan` trên tài khoản AWS. Comment **dòng nguyên văn** `Plan: N to add, 0 to change, 0 to
   destroy` lên PR #53 hoặc gửi vào nhóm chat, kèm xác nhận không có secret. Đặt `alert_emails` trong `terraform.tfvars` (biến này
   giờ bắt buộc, không có giá trị mặc định).
2. **Chỉ `apply` sau khi TV1 duyệt.** Làm theo thứ tự trong `infra/README.md`.
3. Tạo GitHub vars/secrets từ `terraform output`. Workflow deploy hiện lỗi trên `dev` vì chưa có hạ tầng; sau bước này phải xanh.
4. Chạy workflow với `run_seed=true` để seed. Lấy mật khẩu demo trong Secrets Manager, **gửi riêng** cho nhóm.
5. Kiểm tra API `/api/v1/health`, đăng nhập Cognito, worker nhận SQS, tạo một đơn thử.

Xong khi: có URL web, URL API, deploy qua pipeline thành công.

### 2. `chore/minio-local`

MinIO trong `docker-compose.yml`, tạo sẵn bucket `hr-documents`, biến môi trường trong `.env.example` thống nhất với TV1.

### 3. `infra/documents-email`

1. Bucket tài liệu: chặn public, mã hóa, CORS cho domain CloudFront (upload presigned), quyền IAM tối thiểu cho App Runner và worker.
2. Email trên staging: dùng SES (sandbox cần xác minh người nhận), đặt `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` cho worker. Lưu ý
   code hiện gửi SMTP không TLS: cần thống nhất với TV1 cấu hình TLS. Cập nhật `docs/cloud/mapping.md` và chi phí.
3. Nếu SES không dùng được, ghi lý do và phương án thay thế.

### 4. `infra/observability`

1. Log API (App Runner) và worker (ECS) về CloudWatch, giữ 14 ngày; tìm được theo `traceId`.
2. Metrics và alarm: API 5xx, độ trễ p95, RDS CPU/kết nối, DLQ có message, chi phí Budgets.
3. Diễn tập rollback: deploy lại image SHA cũ bằng workflow, ghi thời gian và kết quả vào `infra/README.md`.
4. Ghi cách tắt/bật staging; ghi chi phí thực tế sau một tuần so với dự toán 56,80 USD.

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
