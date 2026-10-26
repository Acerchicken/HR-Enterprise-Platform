# Quy ước code và quy trình làm việc

Áp dụng cho cả nhóm từ tuần 7. Ai muốn đổi quy ước thì mở PR sửa file này.

## 1. Ranh giới module (quan trọng nhất)

Hệ thống là **modular monolith** (ADR-01). Để sau này tách được module thành service riêng:

1. Mỗi module nằm trong `backend/src/modules/<tên>/` và sở hữu một schema DB (`org`, `employee`, `iam`, `leave`, `audit`).
2. **Không** inject repository của module khác. Muốn lấy dữ liệu module khác thì gọi service mà module đó `exports`.
   Ví dụ: Employee lấy tên phòng ban qua `OrganizationService.lookups()`, không JOIN sang `org.department`.
3. **Không** tạo foreign key chéo schema. Foreign key trong cùng schema thì được.
4. Thao tác nghiệp vụ và audit log ghi trong **cùng một transaction**: truyền `EntityManager` vào `AuditService.record(entry, manager)`.

| Module | Người code | Schema | Business rule (TV3 Thanh) / ca kiểm thử (TV2 Duy) |
|---|---|---|---|
| identity | TV1 | `iam` | TV3 / TV2 |
| organization | TV1 | `org` | TV3 / TV2 |
| employee | TV1 | `employee` | TV3 / TV2 |
| audit | TV1 | `audit` | TV3 / TV2 |
| leave | TV1 | `leave` | TV3 / TV2 |
| document, worker (tuần 8–10) | TV1 | `document` | TV3 / TV2 |

Hạ tầng (`docker-compose.yml`, `.github/workflows/`, IaC) do TV4 (Bảo) phụ trách. Business rule do TV3 (Thanh), ca kiểm thử và kiểm thử chức năng do TV2 (Duy) phụ trách. TV1 (Duong) code toàn bộ module
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
- Không sửa migration đã merge vào `main`; muốn đổi thì viết migration mới.
- Trường nhạy cảm (CCCD, tài khoản ngân hàng, lương…) lưu qua `FieldCrypto`, không bao giờ ghi giá trị vào log hay audit.

## 6. Git và review

- Nhánh chính: `main` (luôn chạy được). Không push thẳng vào `main`.
- Nhánh làm việc: `feat/<module>-<mo-ta>`, `fix/<mo-ta>`, `docs/<mo-ta>`. Ví dụ `feat/leave-approve-api`.
- Commit theo Conventional Commits: `feat(leave): add approve endpoint`, `fix(employee): ...`, `docs: ...`, `test: ...`.
- Mỗi PR:
  - nhỏ, một mục đích, mô tả theo template `.github/pull_request_template.md`;
  - `npm run lint` và `npm test` qua ở máy mình trước khi mở;
  - **ít nhất 1 người review**; PR của TV1 do TV2/TV3 (nghiệp vụ) hoặc TV4 (hạ tầng) review, PR của người khác do TV1 review;
  - người mở PR tự merge sau khi được approve (squash merge).
- Review trong vòng 24 giờ. Góp ý bắt buộc sửa ghi rõ "cần sửa"; góp ý tùy chọn ghi "nit:".

## 7. Test

- Logic nghiệp vụ viết thành hàm thuần và có unit test (`*.spec.ts` cạnh file).
- Mỗi endpoint mới có ít nhất một ca e2e cho trường hợp đúng và một ca bị từ chối quyền (`test/app.e2e-spec.ts`).
