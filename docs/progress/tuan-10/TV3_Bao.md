# Tuần 10 – TV3 (Bảo): chuẩn bị lên AWS, lưu trữ tài liệu, vận hành

Vai trò: chuẩn bị hạ tầng để lên AWS gọn trong tuần 12–13, giữ chi phí trong hạn mức.

## Cập nhật 14/11

Nhóm chuyển sang làm xong từng chức năng một, bắt đầu UC1 ([kế hoạch tổng mục 7](../ke-hoach-tong.md#7-kế-hoạch-hoàn-thành-từng-chức-năng-tuần-10--13)). Mỗi chức năng chỉ "xong" khi sẵn sàng
lên cloud: tài nguyên của nó đã có trong Terraform, `validate` và `plan` không lỗi.

TV1 đã viết `deploy.md` của UC1 → UC7 (PR #76) và [`configuration.md`](../../development/configuration.md) (#74), là phần thuộc
vai trò hạ tầng. Người viết là TV1. Việc của TV3 là đọc, đối chiếu với `infra/` và góp ý bằng review trên PR (#74 đã merge thì
comment trên #74 hoặc mở issue).

| Hạn | Việc |
|---|---|
| **CN (15/11), 12:00** | Vẫn giữ: mở PR `infra/idp-hardening` (mục 5) |
| CN (15/11) – T2 (16/11) | Sửa #68, #69, #70 theo góp ý của TV1 trên PR |
| **T3 (17/11)** | Review `deploy.md` của UC1 trên #76: biến môi trường, migration, tài nguyên staging, rollback |
| **T4 (18/11), 21:00** | Mở PR `infra/profile-files` (bước 1, UC1; chỉ `validate`, `plan`) |
| T6 (20/11) | Review `deploy.md` của UC2 → UC7 trên #76 và `configuration.md`: biến nào trong Terraform chưa có |

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
| **CN (15/11), 12:00** | Mở PR `infra/idp-hardening` (thêm 13/11) |
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

### 5. `infra/idp-hardening` – siết cấu hình đăng nhập (thêm 13/11)

Khi viết lại NFR bảo mật trong [SRS mục 6.6](../../requirements/SRS.md#66-nfr-5--bảo-mật), nhóm thấy cấu hình đăng nhập chưa
đạt. Việc này chỉ sửa cấu hình, không sửa code ứng dụng. Phía Cognito chỉ `validate` và `plan`, không `apply`.

| Yêu cầu | Cognito (`infra/staging/cognito.tf`) | Keycloak local (`keycloak/realm-hr.json`) |
|---|---|---|
| NFR-5.9: không cho tự đăng ký | `allow_admin_create_user_only = true` | Đã tắt (`registrationAllowed: false`), giữ nguyên |
| NFR-5.2: mật khẩu ≥ 8 ký tự, có chữ hoa, chữ thường, số | `require_uppercase = true` | `passwordPolicy`: `length(8) and upperCase(1) and lowerCase(1) and digits(1) and notEmail` |
| NFR-5.3: sai 5 lần thì khóa 15 phút | Cognito tự chặn khi sai nhiều lần, không chỉnh ngưỡng được: ghi rõ điểm khác này trong PR | `failureFactor: 5`, `waitIncrementSeconds: 900`, `maxFailureWaitSeconds: 900` |
| NFR-5.5: token 15 phút, phiên tối đa 10 giờ | `access_token_validity = 15`, `id_token_validity = 15` (phút), `refresh_token_validity = 10` (giờ), khai báo `token_validity_units` | Giữ `accessTokenLifespan: 900`, `ssoSessionIdleTimeout: 1800`; thêm `ssoSessionMaxLifespan: 36000` |

Kiểm tra trước khi mở PR:

- Mật khẩu demo `Passw0rd!` vẫn đạt chính sách mới.
- `docker compose up` đăng nhập được bằng 4 tài khoản demo.
- Sai mật khẩu 5 lần thì tài khoản bị khóa.

Ghi kết quả vào mô tả PR. Review: TV1, TV4 (đối chiếu [ca kiểm thử bảo mật](../../business/security-test-cases.md)).
Merge trước T2 (16/11), 9:00.

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
