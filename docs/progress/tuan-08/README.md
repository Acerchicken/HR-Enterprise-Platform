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

Số liệu chốt ngày 2/11/2026. Tình trạng PR theo GitHub; "chờ merge" là PR đã đạt nhưng chưa được merge lúc viết báo cáo.

| Thành viên | Công việc đã hoàn thành | Output | Chi tiết |
|---|---|---|---|
| TV1 (Duong, nhóm trưởng) | API workflow nghỉ phép (tạo, duyệt/từ chối, hủy, HR hoàn tất) trong một transaction, có idempotency, optimistic locking, trừ ngày lễ, nghỉ nửa ngày; outbox + publisher RabbitMQ + worker gửi email; 5 màn hình nghỉ phép; sửa BR-03 (trừ ngày lễ), sửa lỗi Mailpit; làm lại ca kiểm thử và biên bản kiểm thử tuần 7 thay TV4; ruleset bảo vệ `dev`/`main`; review toàn bộ PR | PR #9, #8, #15, #14 (đã merge); #24, #25 (chờ merge). Luồng nghỉ phép chạy end-to-end ở local, email tới Mailpit | [TV1_Duong.md](TV1_Duong.md) |
| TV2 (Thanh) | Business rule BR-01 → BR-11 và sơ đồ quy trình nghỉ phép; đối chiếu UC1/UC2 với code tuần 7, mở 2 issue | PR #1 (đã merge); PR #23 (chờ merge, trễ ~2 ngày); issue #21, #22 | [TV2_Thanh.md](TV2_Thanh.md) |
| TV3 (Bảo) | RabbitMQ + Mailpit trong docker-compose; CI GitHub Actions (lint, unit test, build); ADR-12 + bảng mapping + chi phí | PR #10, #11 (đã merge, trễ ~1 ngày do lần đầu mở nhầm vào `main`); PR #12 (còn 2 điểm cần sửa) | [TV3_Bao.md](TV3_Bao.md) |
| TV4 (Duy) | Danh mục loại phép và ngày lễ 2026 (bản cuối do TV1 sửa theo review) | PR #5 (đã merge) | [TV4_Duy.md](TV4_Duy.md) |

**Chưa làm được theo kế hoạch:**
- **Ca kiểm thử và kiểm thử chức năng của TV4:** PR #13 trễ hạn và không đạt nên được đóng; TV1 làm lại ở PR #14. Các PR nộp lại
  sau đó (#17, #20) không đạt: #17 ghi đè bản danh mục đã merge; #20 báo kết quả kiểm thử màn hình nghỉ phép trong khi các màn
  hình này chưa có trên `dev`, issue #18 và #19 không tái hiện được trên API. Kiểm thử màn hình nghỉ phép theo ca kiểm thử
  chuyển sang đầu tuần 9.
- **ADR-12 (TV3):** chưa sửa 2 điểm review (mạng của App Runner, Cognito) trước hạn 31/10; PR #12 đã đóng ngày 2/11, chuyển
  thành việc đầu tiên của TV3 tuần 9 (hạn 4/11).
- **BR-06 (người duyệt thay khi quản lý vắng mặt):** chưa có mô hình dữ liệu, chưa code; phụ thuộc issue #22.
- **Review chéo:** TV2, TV3, TV4 chưa để lại review nào trên GitHub cho PR của TV1 (#9, #24, #25).
- **Tiến độ TV1:** `feat/leave-outbox-worker` và `feat/leave-ui` trễ 2–3 ngày so với hạn 30/10 và 1/11.

## 2. Tóm tắt kế hoạch tuần tiếp theo (tuần 9: 2/11 – 9/11)

Theo kế hoạch tổng: P3 – Security & DevOps. Bảng dưới là dự kiến, TV1 chốt khi tạo file kế hoạch tuần 9. Từ tuần 9 áp dụng quy trình mới: review trên nhánh, góp ý ghi trong file cá nhân,
chỉ mở PR khi đạt điều kiện merge ([`CONVENTIONS.md`](../../CONVENTIONS.md#quy-trình-cho-một-việc-từ-tuần-9)).

| Thành viên | Công việc | Output |
|---|---|---|
| TV1 (Duong, nhóm trưởng) | Ma trận phân quyền RBAC/ABAC đối chiếu code; quản lý secret (bỏ khóa mã hóa mặc định khỏi code, đọc từ biến môi trường/secret manager); Dockerfile production cho API, worker, web; sửa module identity nếu chốt Cognito | Access-control matrix, Dockerfile, PR code |
| TV2 (Thanh) | Threat model (STRIDE) cho luồng hồ sơ và nghỉ phép; chốt issue #21, #22 và BR-06 | `docs/security/threat-model.md`, cập nhật `leave-rules.md` |
| TV3 (Bảo) | **Việc đầu tiên, hạn thứ 4 (4/11) 21:00:** sửa ADR-12 trên nhánh `docs/adr-12-cloud-provider` theo 2 điểm review (mạng ra của App Runner khi gắn VPC Connector + chi phí NAT/VPC endpoint; Cognito cần sửa module identity), gửi link nhánh cho TV1 review, đạt mới mở PR (PR #12 đã đóng). Sau đó: Terraform dựng staging trên AWS; pipeline CD deploy staging lần đầu | ADR-12 trong mục 3, `docs/cloud/mapping.md`; `infra/`, workflow CD, staging chạy được |
| TV4 (Duy) | Kiểm thử màn hình nghỉ phép theo TC-01 → TC-22 trên `dev` (chạy thật, ghi kết quả từng bước); kiểm thử phân quyền theo ma trận của TV1 | Mục 2 `test-report-tuan-08.md`, biên bản kiểm thử tuần 9, issue |

## 3. Quyết định quan trọng

### ADR-12 – Chọn cloud provider

_TV3 viết theo khung: bối cảnh, các giải pháp, tiêu chí lựa chọn, giải pháp được chọn, trade-off, tiêu chí nghiệm thu,
khi nào xem lại._
