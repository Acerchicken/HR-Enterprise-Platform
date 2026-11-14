# Tài liệu theo tính năng (UC1 → UC7)

> Bộ tài liệu: [`docs/README.md`](../README.md). Yêu cầu gốc: [SRS](../requirements/SRS.md) mục 4 (FR) và mục 6 (NFR).

Mỗi tính năng (use case) có một thư mục, gồm 4 file trả lời 4 câu hỏi người làm cần biết trước khi code:

| File | Trả lời câu hỏi | Ai viết, ai giữ | Ai đọc |
|---|---|---|---|
| `requirements.md` | **Làm gì, thế nào là xong?** User story, tiêu chí chấp nhận `AC-x.y.z` dạng Giả sử / Khi / Thì, NFR liên quan, việc còn lại | TV2 (nghiệp vụ) | Mọi người, trước khi mở nhánh |
| `spec.md` | **Diễn ra thế nào?** Tác nhân, điều kiện, luồng chính, luồng thay thế, ngoại lệ, dữ liệu vào, màn hình, API | TV2, TV1 | TV1 khi code, TV4 khi viết ca kiểm thử |
| `deploy.md` | **Đưa lên môi trường thế nào?** Thành phần, migration, biến môi trường, hạ tầng local và staging, kiểm tra sau deploy, rollback | TV3 (hạ tầng), TV1 | TV3, người deploy |
| `test.md` | **Kiểm thử ra sao?** Mức kiểm thử, test tự động đã có, bảng phủ tiêu chí AC, dữ liệu và tài khoản, cách chạy, ca còn thiếu | TV4 | TV4, người review PR |

Cách làm theo spec-driven (giống spec-kit, Kiro): requirements → spec → code → test, mỗi bước dẫn chiếu mã của bước trước
(`FR-x.y` → `AC-x.y.z` → ca kiểm thử). Business rule **không chép lại** ở đây mà link tới
[`leave-rules.md`](../business/leave-rules.md) (`BR-nn`), [`document-rules.md`](../business/document-rules.md) (`DR-nn`),
[ma trận phân quyền](../security/access-control-matrix.md) và [ADR](../architecture/adr/README.md).

## Danh sách

| Tính năng | Yêu cầu | Đặc tả | Deploy | Kiểm thử | FR | Trạng thái (13/11) |
|---|---|---|---|---|---|---|
| UC1 – Hồ sơ nhân viên | [requirements](UC1-employee-profile/requirements.md) | [spec](UC1-employee-profile/spec.md) | [deploy](UC1-employee-profile/deploy.md) | [test](UC1-employee-profile/test.md) | FR-1.1 → 1.6 | Đã có API và giao diện |
| UC2 – Thông tin tổ chức | [requirements](UC2-organization/requirements.md) | [spec](UC2-organization/spec.md) | [deploy](UC2-organization/deploy.md) | [test](UC2-organization/test.md) | FR-2.1 → 2.5 | Đã có; quản lý phòng ban chưa có giao diện |
| UC3 – Tạo đơn nghỉ | [requirements](UC3-create-leave-request/requirements.md) | [spec](UC3-create-leave-request/spec.md) | [deploy](UC3-create-leave-request/deploy.md) | [test](UC3-create-leave-request/test.md) | FR-3.1 → 3.7 | Đã có; tạo đơn hộ chưa có |
| UC4 – Duyệt đơn nghỉ | [requirements](UC4-approve-leave-request/requirements.md) | [spec](UC4-approve-leave-request/spec.md) | [deploy](UC4-approve-leave-request/deploy.md) | [test](UC4-approve-leave-request/test.md) | FR-4.1 → 4.7 | Đã có; người duyệt thay, email chung, ẩn lý do ốm chưa có |
| UC5 – Kho tài liệu | [requirements](UC5-document-repository/requirements.md) | [spec](UC5-document-repository/spec.md) | [deploy](UC5-document-repository/deploy.md) | [test](UC5-document-repository/test.md) | FR-5.1 → 5.3 | Đã có API; chưa có giao diện; staging chưa có bucket |
| UC6 – Tự tra cứu | [requirements](UC6-self-service-search/requirements.md) | [spec](UC6-self-service-search/spec.md) | [deploy](UC6-self-service-search/deploy.md) | [test](UC6-self-service-search/test.md) | FR-6.1 → 6.3 | Tìm đồng nghiệp đã có; tìm tài liệu, trợ lý chưa có |
| UC7 – Lịch sử thao tác | [requirements](UC7-audit-log/requirements.md) | [spec](UC7-audit-log/spec.md) | [deploy](UC7-audit-log/deploy.md) | [test](UC7-audit-log/test.md) | FR-7.1 → 7.3 | Ghi audit, API có; màn hình tra cứu chưa có |

Phần giao diện dùng chung cho mọi tính năng (thanh trên, trang chủ, tìm kiếm, popup xem nhanh hồ sơ): [UI.md](UI.md).
Màn hình riêng của từng tính năng ở mục 9 của `spec.md`.

Lịch làm phần còn lại: [kế hoạch theo chức năng tuần 11–13](../progress/tuan-04-ke-hoach-tong.md#7-kế-hoạch-theo-chức-năng-tuần-11--13).

## Làm một tính năng theo tài liệu này

1. **Trước khi mở nhánh:** đọc `requirements.md`, chọn các `AC` sẽ làm. Tiêu chí còn ghi *(chưa chốt)* thì TV2 chốt trước.
2. **Khi code:** theo luồng và ngoại lệ trong `spec.md`. Thấy đặc tả sai hoặc thiếu thì sửa đặc tả trong cùng PR.
3. **Mô tả PR:** ghi tính năng và mã AC đã làm, ví dụ "UC4: AC-4.3.1 → AC-4.3.4" (mục "Mục đích" của PR template).
4. **Trong cùng PR:**
   - bỏ dấu *(chưa có)* ở các AC đã đạt, cập nhật dòng ở mục "Việc còn lại";
   - cập nhật mục 12 "Hiện trạng" của `spec.md`, cột trạng thái FR trong SRS;
   - thêm migration, biến môi trường, hạ tầng mới vào `deploy.md` (và [`configuration.md`](../development/configuration.md));
   - thêm test tự động vào bảng phủ tiêu chí của `test.md`.
5. **Xong khi:** mọi AC trong phạm vi PR có test tự động hoặc ca kiểm thử tay đã chạy (ghi ngày, môi trường, commit), CI xanh,
   chạy được theo `deploy.md` ở local.

## Chung cho mọi tính năng

### Môi trường

| Môi trường | Cách chạy | Ghi chú |
|---|---|---|
| Local | `docker compose up -d --build` ở gốc repo: PostgreSQL, Keycloak (8080), RabbitMQ, Mailpit (8025), API (3000), worker, seed, web (5173) | Image API tự chạy migration trước khi khởi động (`backend/Dockerfile`). Seed sinh ~2.000 nhân viên |
| Staging (AWS, tuần 12–13) | Workflow **Deploy Staging** (chạy tay): build image theo commit SHA, chạy migration bằng task ECS, cập nhật App Runner và worker, đồng bộ web lên S3 + CloudFront, kiểm `GET /api/v1/health` | Chi tiết, rollback, tắt staging: [`infra/README.md`](../../infra/README.md) mục 5 |

Biến môi trường đầy đủ: [`configuration.md`](../development/configuration.md). Rollback chung: chạy lại Deploy Staging với
`IMAGE_TAG` của commit trước; migration lỗi thì chạy task `migration:revert`.

### Kiểm thử

| Mức | Chạy ở đâu | Lệnh |
|---|---|---|
| Unit test | CI trên mọi PR vào `dev`, `main` | `cd backend && npm test` |
| e2e (API với DB thật) | Local, **chưa chạy trong CI** | `cd backend && npm run test:e2e` sau khi đã migrate và seed |
| Ca kiểm thử tay | Local, staging | Theo `test.md` của từng tính năng; kết quả ghi vào `test-report-tuan-NN.md` |

Tài khoản mẫu (Keycloak, realm `hr`): `employee@hr.local`, `manager@hr.local`, `hr@hr.local`, `admin@hr.local`. Chế độ không
cần Keycloak: `AUTH_MODE=dev` và token `Bearer dev:<email>` (bị chặn khi `NODE_ENV=production`).

## Quy ước

- **Mẫu:** [spec-template.md](spec-template.md), [requirements-template.md](requirements-template.md),
  [deploy-template.md](deploy-template.md), [test-template.md](test-template.md).
- **Mã:**
  - `US-x.n` user story; `AC-x.y.z` tiêu chí chấp nhận của `FR-x.y`.
  - Trong `spec.md`: luồng chính `1, 2, 3…`; luồng thay thế `A1, A2…` (ghi rẽ ra từ bước nào); ngoại lệ `E1, E2…` kèm mã HTTP
    và `code` theo [`error-codes.md`](../development/error-codes.md).
- **Đường dẫn API** lược tiền tố `/api/v1`.
- **Trạng thái** phản ánh nhánh `dev` ngày 13/11/2026. Ai merge code làm đổi hành vi thì cập nhật trong cùng PR.
