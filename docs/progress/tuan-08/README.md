# Tuần 8 (26/10 – 2/11) – Implementation 2: Workflow nghỉ phép

Mục tiêu tuần: luồng nghỉ phép chạy end-to-end ở local (nhân viên tạo đơn → quản lý duyệt/từ chối → HR hoàn tất, có
thông báo email qua queue), có business rule và ca kiểm thử đi kèm, có CI chạy trên mọi PR và chốt cloud provider (ADR-12).

Phân vai theo ADR-11: TV1 Duong code, TV2 Thanh nghiệp vụ, TV3 Bảo cloud, IaC, CI/CD, TV4 Duy ca kiểm thử + một phần nghiệp vụ.

> File này là kế hoạch đầu tuần. Cuối tuần (thứ 2, 2/11) nhóm điền mục 1–3 để làm báo cáo.

## Kế hoạch tuần 8 theo nhánh

Mỗi việc là một nhánh tách từ `dev`, xong thì mở PR vào `dev`. Quy tắc nhánh chi tiết ở
[`docs/CONVENTIONS.md`](../../CONVENTIONS.md#6-git-nhánh-và-review).

| Nhánh | Người | Việc | Output | Hạn mở PR vào `dev` | Review |
|---|---|---|---|---|---|
| `docs/leave-rules` | TV2 Thanh | Business rule luồng nghỉ phép; sơ đồ quy trình; đối chiếu UC1, UC2 với requirements | `docs/business/leave-rules.md`, sơ đồ, issue | Thứ 3 (27/10) | TV1, TV4 |
| `chore/rabbitmq-mailpit` | TV3 Bảo | Thêm RabbitMQ và Mailpit vào docker-compose | `docker-compose.yml`, `.env.example` | Thứ 4 (28/10) | TV1 |
| `ci/github-actions` | TV3 Bảo | CI chạy lint, unit test, build cho mọi PR vào `dev` và `main` | `.github/workflows/ci.yml` | Thứ 4 (28/10) | TV1 |
| `docs/leave-test-cases` | TV4 Duy | Loại phép, ngày lễ 2026; ca kiểm thử cho 5 bước workflow; kiểm thử chức năng màn hình tuần 7 | `docs/business/leave-types-holidays.md`, `docs/business/leave-test-cases.md`, `docs/business/test-report-tuan-08.md`, issue | Thứ 5 (29/10) | TV2, TV1 |
| `feat/leave-workflow-api` | TV1 Duong | API tạo, duyệt/từ chối, hủy, HR hoàn tất đơn trong một transaction | `backend/src/modules/leave/` | Thứ 5 (29/10) | TV2 (nghiệp vụ), TV4 (ca kiểm thử) |
| `feat/leave-outbox-worker` | TV1 Duong | Outbox, publisher, worker gửi email | `backend/src/modules/leave/outbox/`, `backend/src/worker/` | Thứ 6 (30/10), sau khi `chore/rabbitmq-mailpit` vào `dev` | TV3 (hạ tầng), TV2 |
| `docs/adr-12-cloud-provider` | TV3 Bảo | So sánh cloud provider, ADR-12, map capability, ước tính chi phí | ADR-12 trong mục 3 của file này, `docs/cloud/mapping.md` | Thứ 6 (30/10) | TV1 |
| `feat/leave-ui` | TV1 Duong | 5 màn hình nghỉ phép | `frontend/src/pages/leave/` | Chủ nhật (1/11), 12:00 | TV2, TV4 |
| `docs/test-report-leave` | TV4 Duy | Kiểm thử chức năng các màn hình nghỉ phép theo ca kiểm thử | Bổ sung `docs/business/test-report-tuan-08.md`, issue | Chủ nhật (1/11), 21:00 | TV1 |

Thứ tự phụ thuộc:

1. Thứ 3: TV2 merge `docs/leave-rules` → TV4 viết ca kiểm thử, TV1 code API theo đó.
2. Thứ 4: TV3 merge `chore/rabbitmq-mailpit` → TV1 viết worker.
3. Thứ 5: TV4 merge ca kiểm thử → TV1 đối chiếu API với từng ca.
4. Chủ nhật: TV1 merge `feat/leave-ui` trước 12:00 → TV4 kiểm thử chức năng các màn hình nghỉ phép trên `dev`, mở issue nếu lỗi.
5. Thứ 2 (2/11), 9:00: mọi người điền mục "Việc đã làm" trong file cá nhân.
6. Thứ 2 (2/11): TV1 mở PR `dev` → `main` để chốt tuần 8.

## 1. Các công việc đã hoàn thành

_Điền cuối tuần._

| Thành viên | Công việc đã hoàn thành | Output | Chi tiết |
|---|---|---|---|
| TV1 (Duong, nhóm trưởng) | | | [Duong_TV1.md](Duong_TV1.md) |
| TV2 (Thanh) | | | [Thanh_TV2.md](Thanh_TV2.md) |
| TV3 (Bảo) | | | [Bao_TV3.md](Bao_TV3.md) |
| TV4 (Duy) | | | [Duy_TV4.md](Duy_TV4.md) |

## 2. Tóm tắt kế hoạch tuần tiếp theo (tuần 9: 2/11 – 9/11)

_Điền cuối tuần. Dự kiến theo kế hoạch tổng: P3 – Security & DevOps (threat model, ma trận phân quyền, quản lý secret,
container, CI/CD, IaC, deploy staging lần đầu)._

## 3. Quyết định quan trọng

### ADR-12 – Chọn cloud provider

**Bối cảnh:**
Nhóm cần chọn cloud provider để triển khai hệ thống Enterprise HR Platform (~2,000 nhân viên, workload peak ≈ 10 RPS, thiết kế cho 50 RPS theo NFR tuần 5). Hệ thống tuân theo các quyết định kiến trúc đã chốt: modular monolith (ADR-01), PostgreSQL (ADR-02), managed services cho database, storage và identity (ADR-00), không dùng Kubernetes (ADR-06). Ngân sách hạ tầng < 100 USD/tháng, cần chốt provider ở tuần 8 để tuần 9 viết IaC (Terraform) và deploy staging lần đầu.

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | Amazon Web Services (AWS) | Hệ sinh thái cloud enterprise toàn diện nhất; managed container (App Runner / ECS Fargate), RDS PostgreSQL, S3, SQS, CloudWatch, Secrets Manager |
| B | Microsoft Azure | Tích hợp tốt với OIDC enterprise; hỗ trợ gói Azure for Students ($100 credit không cần thẻ tín dụng); Azure Container Apps, PostgreSQL Flexible Server, Blob Storage |
| C | Google Cloud Platform (GCP) | Cloud Run serverless container nhẹ, tự có HTTPS; Cloud SQL for PostgreSQL; Cloud Storage; Cloud Pub/Sub; gói credit dùng thử $300 |

**Tiêu chí lựa chọn:**

| Tiêu chí | A (AWS) | B (Azure) | C (GCP) |
|---|---|---|---|
| Hỗ trợ đầy đủ 7 capability managed (DB, Storage, Auth, Queue, Container, Monitor, KMS) | 5 | 4 | 4 |
| Khả năng tiếp cận credit sinh viên và độ ổn định tài khoản | 3 | 5 | 4 |
| Chi phí hàng tháng trong ngân sách (< 100 USD/tháng cho môi trường staging) | 4 | 4 | 5 |
| Tài liệu chuẩn, công cụ IaC (Terraform) và phù hợp chuẩn môn học | 5 | 4 | 4 |
| Hỗ trợ mở rộng cho AI/RAG (pgvector, LLM API) ở tuần 12 | 5 | 4 | 5 |

**Giải pháp được chọn:** **A (Amazon Web Services)**.

Lý do:
1. AWS là nền tảng tham chiếu chuẩn của môn học Cloud Application Development, tài liệu và mô hình Well-Architected Framework hỗ trợ tốt nhất cho phần phản biện kiến trúc (Architecture Defense).
2. Dịch vụ managed container (AWS App Runner / ECS Fargate) đáp ứng chính xác ADR-06 (chạy 2 instance sau load balancer, không cần vận hành cụm Kubernetes phức tạp).
3. Amazon RDS for PostgreSQL hỗ trợ sẵn extension `pgvector` phục vụ tính năng RAG ở tuần 12, cùng cơ chế backup tự động và khôi phục point-in-time đáp ứng RPO ≤ 1 giờ, RTO ≤ 4 giờ (ADR-00).
4. Amazon S3 là chuẩn lưu trữ tài liệu với presigned URL cho frontend tải file trực tiếp; SQS đáp ứng tốt luồng outbox/worker bất đồng bộ.
5. Dự toán chi phí ở mức cấu hình tối thiểu khoảng 42–65 USD/tháng, hoàn toàn nằm trong ngân sách < 100 USD/tháng.

**Trade-off:**
Đăng ký AWS yêu cầu thẻ thanh toán quốc tế và kiểm soát chi phí chặt chẽ; một số dịch vụ (RDS, NAT Gateway nếu dùng VPC phức tạp) có chi phí cố định. Nhóm giải quyết bằng cách:
- Thiết lập AWS Budgets gửi cảnh báo về email nhóm ở các mốc 20 USD, 50 USD và 80 USD.
- Tối giản kiến trúc mạng ở môi trường Staging (không dùng NAT Gateway riêng đắt đỏ, dùng App Runner hoặc public/private subnet tối giản).
- Phương án dự phòng: nếu tài khoản AWS gặp trục trặc về credit/hạn mức, nhóm chuyển sang Azure dùng gói Azure for Students ($100 credit) mà không phải sửa mã nguồn nhờ tính tương thích của container và PostgreSQL.

**Tiêu chí nghiệm thu:**
- Tài khoản AWS được kích hoạt và cài đặt AWS Budget cảnh báo ở 20 USD, 50 USD, 80 USD.
- Bảng mapping 7 capability sang dịch vụ AWS cụ thể được phê duyệt trong `docs/cloud/mapping.md`.
- Dự toán chi phí hàng tháng chi tiết dưới 100 USD/tháng.
- Viết được mã Terraform (IaC) dựng lại toàn bộ hạ tầng staging trên AWS trong tuần 9.

**Khi nào xem lại:**
Nếu tài khoản AWS bị giới hạn hạn mức hoặc chi phí thực tế tuần 9 vượt dự toán, nhóm sẽ chuyển đổi hạ tầng sang Microsoft Azure theo phương án dự phòng B.
