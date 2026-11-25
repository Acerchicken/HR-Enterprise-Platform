# Tuần 12 bổ sung – TV1 (Duong): code mọi tiêu chí còn thiếu trong một ngày

Vai trò: code chính. **Hạn chung: hết T5 (26/11).** Mỗi việc một nhánh, một PR vào `dev`, có test; sửa tài liệu liên quan trong cùng
PR (SRS, `requirements.md`, `deploy.md`, `configuration.md`, [`staging-readiness.md`](../../cloud/staging-readiness.md)).

TV1 nhận thêm từ TV3: hạ tầng trợ lý (F4) và e2e trong CI (N9), để TV3 chỉ còn hạ tầng lõi và `apply`.

## Việc và hạn

**25/11:** cả 7 việc đã mở PR ([#140](https://github.com/Acerchicken/HR-Enterprise-Platform/pull/140) → [#146](https://github.com/Acerchicken/HR-Enterprise-Platform/pull/146)), trạng thái từng PR ở [README](README.md#trạng-thái-phần-tv1-cập-nhật-2511).

| # | Mã | Nhánh | Việc | Tiêu chí của slide | Review |
|---|---|---|---|---|---|
| 1 | N2 | `feat/document-search` | Nhân viên tìm tài liệu theo từ khóa | Use case 6 "Employee self-service search" | TV2, TV4 |
| 2 | N3 | `feat/mail-ses-trust-proxy` | Email qua SES API (F1), IP thật trong audit (F5), thử lại có giãn cách | Complete workflow trên cloud, audit trail, failure handling | TV3 |
| 3 | N5a | `feat/observability-basics` | Log JSON, phiên bản ở `/health`, metric outbox, timeout database | Observability, failure handling | TV3 |
| 4 | N9 | `ci/e2e` | e2e chạy trong CI; kiểm `openapi.yaml` khớp code | Automated deployment, CI/CD | TV3 |
| 5 | F4 | `infra/assistant-staging` | Terraform và workflow cho assistant service | Real cloud deployment (AI) | TV3 |
| 6 | – | `fix/auth-email-verified` | Chỉ liên kết tài khoản với hồ sơ khi `email_verified` (threat model T-02, tồn từ tuần 11) | Security controls | TV3, TV4 |
| 7 | N12 | `docs/adr-status` | ADR-15 → ADR-18 "Đã chấp nhận" | Meaningful architecture decisions | – |
| 8 | – | cập nhật PR #139 | Cột trạng thái ở [đối chiếu yêu cầu](../../defense/doi-chieu-yeu-cau-mon-hoc.md), kế hoạch tổng mục 8.1, README thư mục này | – | – |

<a id="n2"></a>
## N2 – Tìm tài liệu theo từ khóa

- `DocumentQuery` thêm `q` (1–100 ký tự); `GET /documents` lọc tiêu đề và mô tả, không phân biệt hoa thường và dấu (`unaccent`), vẫn
  lọc phạm vi trong truy vấn như hiện tại.
- Trang `/documents`: ô "Tìm tài liệu", giữ bộ lọc loại.
- e2e: tìm có dấu và không dấu ra cùng kết quả; tài liệu ngoài phạm vi không hiện dù khớp từ khóa.
- Tài liệu: FR-5.4 trong SRS, AC trong UC5 `requirements.md`, `spec.md`, `test.md`; `openapi.yaml`.

<a id="n3"></a>
## N3 – Email trên staging, IP thật, thử lại

- F1: worker đọc `MAIL_DRIVER`: `smtp` (local, Mailpit) hoặc `ses` (`@aws-sdk/client-sesv2`, quyền `ses:SendEmail` đã có).
- F5: `TRUST_PROXY` (số lớp proxy) → `app.set('trust proxy', …)`; staging đặt 1.
- NFR-3.5: thử lại có giãn cách tăng dần trước khi vào DLQ (nếu driver queue cho phép).
- Sửa `configuration.md`, `staging-readiness.md` (đánh dấu F1, F5), Terraform biến `TRUST_PROXY`.

<a id="n5a"></a>
## N5a – Quan sát hệ thống

- Log dạng JSON một dòng, có `traceId`, `level`, `msg` (NFR-8.1).
- `/api/v1/health` trả `version` (commit SHA từ biến `APP_VERSION` do workflow đặt) (NFR-8.5).
- Metric "event outbox chưa gửi" và tuổi event cũ nhất, ghi log định kỳ hoặc đẩy CloudWatch để làm alarm "outbox tồn quá 15 phút"
  (NFR-8.3).
- Database: timeout kết nối và `statement_timeout` 5 s, giới hạn pool (SRS 6.14 "database chậm").

<a id="n9"></a>
## N9 – e2e trong CI

- Job `e2e` trong `ci.yml`: Postgres 16 (pgvector) làm service, chạy migration, `npm run test:e2e`.
- Kiểm `openapi.yaml` khớp code (NFR-9.5): `npm run openapi` rồi `git diff --exit-code docs/openapi.yaml`.

<a id="f4"></a>
## F4 – Hạ tầng trợ lý trên staging

Theo [staging-readiness mục 4](../../cloud/staging-readiness.md#4-trợ-lý-chính-sách-trên-staging-f4-chi-tiết): ECR `hr-assistant`;
SQS `assistant-document` + DLQ; task definition và ECS service `assistant` (0,5 vCPU, 2 GB, `desired_count = 0`); Cloud Map
`assistant.hr.local:3100`; security group; secret `ASSISTANT_INTERNAL_TOKEN`, `ASSISTANT_CONFIG_KEY`, mật khẩu `assistant_svc`; biến
API, IAM App Runner `sqs:SendMessage`; IAM task assistant. Workflow build và push image assistant. Chỉ `fmt`, `validate`; TV3 `plan`,
`apply`.

<a id="n12"></a>
## N12 – Trạng thái ADR

ADR-15 (#92), ADR-16 (#128), ADR-17 (#99), ADR-18 (#100) đã merge: đổi "Đề xuất" thành "Đã chấp nhận" trong file và
[danh sách ADR](../../architecture/adr/README.md), ghi một dòng "Lịch sử thay đổi".

## Việc đã làm

| Ngày | Việc | PR | Kết quả |
|---|---|---|---|
| 25/11 | Đối chiếu yêu cầu môn học, phân việc bổ sung | #139 | Mở |
