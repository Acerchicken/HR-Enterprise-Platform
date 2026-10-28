# Quy ước code và quy trình làm việc

Áp dụng cho cả nhóm từ tuần 7. Ai muốn đổi quy ước thì mở PR sửa file này.

## 1. Ranh giới module (quan trọng nhất)

Hệ thống là **modular monolith** (ADR-01). Để sau này tách được module thành service riêng:

1. Mỗi module nằm trong `backend/src/modules/<tên>/` và sở hữu một schema DB (`org`, `employee`, `iam`, `leave`, `audit`).
2. **Không** inject repository của module khác. Muốn lấy dữ liệu module khác thì gọi service mà module đó `exports`.
   Ví dụ: Employee lấy tên phòng ban qua `OrganizationService.lookups()`, không JOIN sang `org.department`.
3. **Không** tạo foreign key chéo schema. Foreign key trong cùng schema thì được.
4. Thao tác nghiệp vụ và audit log ghi trong **cùng một transaction**: truyền `EntityManager` vào `AuditService.record(entry, manager)`.

| Module | Người code | Schema | Business rule (TV2 Thanh) / ca kiểm thử (TV4 Duy) |
|---|---|---|---|
| identity | TV1 | `iam` | TV2 / TV4 |
| organization | TV1 | `org` | TV2 / TV4 |
| employee | TV1 | `employee` | TV2 / TV4 |
| audit | TV1 | `audit` | TV2 / TV4 |
| leave | TV1 | `leave` | TV2 / TV4 |
| document, worker (tuần 8–10) | TV1 | `document` | TV2 / TV4 |

Hạ tầng (`docker-compose.yml`, `.github/workflows/`, IaC) do TV3 (Bảo) phụ trách. Business rule do TV2 (Thanh), ca kiểm thử và kiểm thử chức năng do TV4 (Duy) phụ trách. TV1 (Duong) code toàn bộ module
(xem ADR-11 trong `docs/progress/tuan-07/README.md`).

## 2. Cấu trúc một module

```
modules/employee/
├── employee.entity.ts        TypeORM entity (1 file / bảng)
├── employee.dto.ts           DTO request/response + class-validator
├── employee-access.ts        quy tắc nghiệp vụ dạng hàm thuần (dễ unit test)
├── employee-access.spec.ts   unit test cạnh file được test
├── employee.service.ts       logic, transaction, gọi audit
├── employee.controller.ts    chỉ nhận request, gọi service, không chứa logic
└── employee.module.ts
```

## 3. Đặt tên

- File: `kebab-case.ts`. Class: `PascalCase`. Biến, hàm: `camelCase`.
- Bảng, cột DB: `snake_case`. Entity map sang camelCase bằng `@Column({ name: 'snake_case' })`.
- API: danh từ số nhiều, kebab-case: `/leave-requests`, `/audit-logs`. Hành động đặc biệt dùng POST: `/leave-requests/{id}/approve`.
- Role: `EMPLOYEE`, `MANAGER`, `HR`, `ADMIN` (trong Keycloak viết thường).

## 4. API

- Tiền tố `/api/v1`. Đổi không tương thích thì lên `/v2`.
- Lỗi luôn có dạng `{ code, message, traceId }` (do `ApiErrorFilter` xử lý). Ném exception của NestJS:
  `BadRequestException` (400), `ForbiddenException` (403), `NotFoundException` (404), `ConflictException` (409).
- Phân quyền hai lớp: `@Roles(...)` ở controller để chặn sớm theo role; kiểm tra theo dữ liệu ("chỉ hồ sơ của mình",
  "chỉ manager trực tiếp") đặt trong service.
- Danh sách luôn phân trang: `?page=&size=` (size tối đa 100), trả về `{ items, page, size, total }`.
- Cập nhật bản ghi quan trọng dùng `version` (optimistic locking), lệch trả 409.
- Sau khi thêm/sửa endpoint: chạy `npm run openapi` để cập nhật `docs/openapi.yaml` và commit cùng PR.

## 5. Database và migration

- `synchronize` luôn tắt. Mọi thay đổi schema phải qua migration trong `backend/src/database/migrations/`.
- Tên file: `<timestamp>-<MoTa>.ts`, ví dụ `1730500000000-AddLeaveOutbox.ts`. Có cả `up` và `down`.
- Không sửa migration đã merge vào `dev` hoặc `main`; muốn đổi thì viết migration mới.
- Trường nhạy cảm (CCCD, tài khoản ngân hàng, lương…) lưu qua `FieldCrypto`, không bao giờ ghi giá trị vào log hay audit.

## 6. Git, nhánh và review

### Các nhánh

| Nhánh | Dùng để | Ai được đưa code vào |
|---|---|---|
| `main` | Bản đã chốt sau mỗi tuần, luôn chạy được | Chỉ qua PR `dev` → `main` (TV1 mở vào thứ 2 hằng tuần). Không ai push thẳng |
| `dev` | Gộp việc trong tuần | Chỉ qua PR từ nhánh việc. Không push thẳng |
| Nhánh việc | Một việc trong kế hoạch tuần | Người được giao việc đó |

Tên nhánh việc theo loại việc:

| Tiền tố | Khi nào | Ví dụ |
|---|---|---|
| `feat/` | Chức năng mới | `feat/leave-workflow-api` |
| `fix/` | Sửa lỗi | `fix/leave-balance-negative` |
| `docs/` | Tài liệu nghiệp vụ, ca kiểm thử, ADR, báo cáo | `docs/leave-rules` |
| `chore/` | Hạ tầng local, cấu hình, dependency | `chore/rabbitmq-mailpit` |
| `ci/` | Pipeline CI/CD | `ci/github-actions` |
| `infra/` | IaC cho cloud (từ tuần 9) | `infra/terraform-staging` |

Danh sách nhánh của từng tuần ghi trong `docs/progress/tuan-NN/README.md`.

### Quy trình cho một việc

1. Tách nhánh từ `dev` mới nhất: `git checkout dev && git pull && git checkout -b <nhánh>`.
2. Mỗi nhánh **chỉ một việc**, sống tối đa vài ngày. Việc lớn thì chia thành nhiều nhánh nối tiếp nhau.
3. Commit theo Conventional Commits: `feat(leave): add approve endpoint`, `fix(employee): ...`, `docs(business): ...`,
   `chore(infra): ...`, `ci: ...`, `test: ...`.
4. Trước khi mở PR: kéo `dev` mới nhất về nhánh của mình (`git pull origin dev`), sửa xung đột nếu có.
5. Mở PR vào `dev`, mô tả theo template `.github/pull_request_template.md`. PR code phải qua `npm run lint` và `npm test` ở máy mình.
6. Sau khi được approve và CI xanh, **Duong merge** bằng **squash merge**, rồi xóa nhánh. Người mở PR không tự merge.
7. Thứ 2 hằng tuần, TV1 mở PR `dev` → `main` và merge bằng **merge commit** (không squash) để giữ commit và tên tác giả của từng người.

### Review

| PR của | Người review |
|---|---|
| TV1 – code | TV2 (Thanh) xem đúng business rule chưa; TV4 (Duy) xem kết quả có khớp ca kiểm thử không. PR đụng hạ tầng thì thêm TV3 (Bảo) |
| TV2 – business rule | TV1 và TV4 |
| TV3 – hạ tầng, CI/CD, IaC, ADR cloud | TV1 |
| TV4 – ca kiểm thử, biên bản kiểm thử | TV2 và TV1 |

- Mỗi PR ít nhất 1 người approve, trong đó bắt buộc có approve của TV1 (Duong, code owner). Review trong vòng 24 giờ.
- Góp ý bắt buộc sửa ghi rõ "cần sửa"; góp ý tùy chọn ghi "nit:".

### Quy tắc chung

- Ai làm việc nào thì tự commit và mở PR bằng **tài khoản GitHub của mình**. Không commit hộ người khác.
- Branch protection (ruleset trên GitHub): `main` và `dev` bắt buộc qua PR, có approve của Duong, cấm force push và xóa nhánh, chỉ Duong merge được. Khi CI chạy được thì thêm điều kiện CI phải xanh.
- Không sửa lịch sử của nhánh người khác (không force push lên nhánh không phải của mình, không bao giờ force push `dev`, `main`).

## 7. Test

- Logic nghiệp vụ viết thành hàm thuần và có unit test (`*.spec.ts` cạnh file).
- Mỗi endpoint mới có ít nhất một ca e2e cho trường hợp đúng và một ca bị từ chối quyền (`test/app.e2e-spec.ts`).
