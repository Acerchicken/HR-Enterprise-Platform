# Tuần 8 (26/10 – 2/11) – Implementation 2: Workflow nghỉ phép

Mục tiêu tuần: luồng nghỉ phép chạy end-to-end ở local (nhân viên tạo đơn → quản lý duyệt/từ chối → HR hoàn tất, có
thông báo email qua queue), có business rule và ca kiểm thử đi kèm, có CI chạy trên mọi PR và chốt cloud provider (ADR-12).

Phân vai theo ADR-11: TV1 Duong code, TV2 Thanh nghiệp vụ, TV3 Duy ca kiểm thử + một phần nghiệp vụ, TV4 Bảo cloud, IaC, CI/CD.

> File này là kế hoạch đầu tuần. Cuối tuần (thứ 2, 2/11) nhóm điền mục 1–3 để làm báo cáo.

## Kế hoạch tuần 8 theo nhánh

Mỗi việc là một nhánh tách từ `dev`, xong thì mở PR vào `dev`. Quy tắc nhánh chi tiết ở
[`docs/CONVENTIONS.md`](../../CONVENTIONS.md#6-git-nhánh-và-review).

| Nhánh | Người | Việc | Output | Hạn mở PR vào `dev` | Review |
|---|---|---|---|---|---|
| `docs/leave-rules` | TV2 Thanh | Business rule luồng nghỉ phép; sơ đồ quy trình; đối chiếu UC1, UC2 với requirements | `docs/business/leave-rules.md`, sơ đồ, issue | Thứ 3 (27/10) | TV1, TV3 |
| `chore/rabbitmq-mailpit` | TV4 Bảo | Thêm RabbitMQ và Mailpit vào docker-compose | `docker-compose.yml`, `.env.example` | Thứ 4 (28/10) | TV1 |
| `ci/github-actions` | TV4 Bảo | CI chạy lint, unit test, build cho mọi PR vào `dev` và `main` | `.github/workflows/ci.yml` | Thứ 4 (28/10) | TV1 |
| `docs/leave-test-cases` | TV3 Duy | Loại phép, ngày lễ 2026; ca kiểm thử cho 5 bước workflow; kiểm thử chức năng màn hình tuần 7 | `docs/business/leave-types-holidays.md`, `docs/business/leave-test-cases.md`, `docs/business/test-report-tuan-08.md`, issue | Thứ 5 (29/10) | TV2, TV1 |
| `feat/leave-workflow-api` | TV1 Duong | API tạo, duyệt/từ chối, hủy, HR hoàn tất đơn trong một transaction | `backend/src/modules/leave/` | Thứ 5 (29/10) | TV2 (nghiệp vụ), TV3 (ca kiểm thử) |
| `feat/leave-outbox-worker` | TV1 Duong | Outbox, publisher, worker gửi email | `backend/src/modules/leave/outbox/`, `backend/src/worker/` | Thứ 6 (30/10), sau khi `chore/rabbitmq-mailpit` vào `dev` | TV4 (hạ tầng), TV2 |
| `docs/adr-12-cloud-provider` | TV4 Bảo | So sánh cloud provider, ADR-12, map capability, ước tính chi phí | ADR-12 trong mục 3 của file này, `docs/cloud/mapping.md` | Thứ 6 (30/10) | TV1 |
| `feat/leave-ui` | TV1 Duong | 5 màn hình nghỉ phép | `frontend/src/pages/leave/` | Chủ nhật (1/11), 12:00 | TV2, TV3 |
| `docs/test-report-leave` | TV3 Duy | Kiểm thử chức năng các màn hình nghỉ phép theo ca kiểm thử | Bổ sung `docs/business/test-report-tuan-08.md`, issue | Chủ nhật (1/11), 21:00 | TV1 |

Thứ tự phụ thuộc:

1. Thứ 3: TV2 merge `docs/leave-rules` → TV3 viết ca kiểm thử, TV1 code API theo đó.
2. Thứ 4: TV4 merge `chore/rabbitmq-mailpit` → TV1 viết worker.
3. Thứ 5: TV3 merge ca kiểm thử → TV1 đối chiếu API với từng ca.
4. Chủ nhật: TV1 merge `feat/leave-ui` trước 12:00 → TV3 kiểm thử chức năng các màn hình nghỉ phép trên `dev`, mở issue nếu lỗi.
5. Thứ 2 (2/11), 9:00: mọi người điền mục "Việc đã làm" trong file cá nhân.
6. Thứ 2 (2/11): TV1 mở PR `dev` → `main` để chốt tuần 8.

## 1. Các công việc đã hoàn thành

_Điền cuối tuần._

| Thành viên | Công việc đã hoàn thành | Output | Chi tiết |
|---|---|---|---|
| TV1 (Duong, nhóm trưởng) | | | [TV1.md](TV1.md) |
| TV2 (Thanh) | | | [TV2.md](TV2.md) |
| TV3 (Duy) | | | [TV3.md](TV3.md) |
| TV4 (Bảo) | | | [TV4.md](TV4.md) |

## 2. Tóm tắt kế hoạch tuần tiếp theo (tuần 9: 2/11 – 9/11)

_Điền cuối tuần. Dự kiến theo kế hoạch tổng: P3 – Security & DevOps (threat model, ma trận phân quyền, quản lý secret,
container, CI/CD, IaC, deploy staging lần đầu)._

## 3. Quyết định quan trọng

### ADR-12 – Chọn cloud provider

_TV4 viết theo khung: bối cảnh, các giải pháp, tiêu chí lựa chọn, giải pháp được chọn, trade-off, tiêu chí nghiệm thu,
khi nào xem lại._
