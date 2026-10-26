# Tuần 7 – TV1 (nhóm trưởng): Tech stack, khung dự án, quy ước code, module Leave

## Việc đã làm

| Việc | Output | Trạng thái |
|---|---|---|
| Chốt tech stack | [ADR-04](README.md#adr-04--tech-stack-nestjs--react--postgresql--keycloak) | Xong |
| Dựng khung modular monolith | `backend/src/app.module.ts`, `backend/src/common/` | Xong |
| Viết quy ước code, quy trình branch/PR/review | `docs/CONVENTIONS.md`, `.github/pull_request_template.md` | Xong |
| Module Leave: entity + state machine | `backend/src/modules/leave/` | Xong (API ở tuần 8) |

## 1. Khung dự án

```
backend/src/
├── main.ts, bootstrap.ts     khởi động API, prefix /api/v1, validation, Swagger
├── app.module.ts             ghép các module
├── health.controller.ts      GET /health cho load balancer
├── common/                   dùng chung cho mọi module
│   ├── api-error.filter.ts   mọi lỗi trả về {code, message, traceId}
│   ├── trace-id.middleware.ts gắn traceId cho mỗi request (header X-Trace-Id)
│   ├── pagination.ts         ?page=&size=, trả về {items, page, size, total}
│   ├── ttl-cache.ts          cache in-memory TTL (QĐ-03)
│   └── field-crypto.ts       mã hóa AES-256-GCM (QĐ-04)
├── config/                   đọc biến môi trường
├── database/                 data-source, migrations/, seed.ts
└── modules/                  identity, organization, employee, audit, leave
```

Quy tắc ranh giới module (chi tiết trong `docs/CONVENTIONS.md`):
1. Mỗi module một thư mục, một schema DB.
2. Không inject repository của module khác; chỉ gọi service mà module đó export.
3. Không foreign key chéo schema.
4. Thao tác nghiệp vụ và audit ghi trong cùng transaction.

Validation: mọi body và query đều có DTO kiểm tra bằng class-validator; trường lạ trong body bị từ chối (400).

## 2. Quy trình làm việc

- Nhánh `main` luôn chạy được, không push thẳng.
- Nhánh làm việc: `feat/<module>-<mo-ta>`, `fix/<mo-ta>`, `docs/<mo-ta>`.
- Commit theo Conventional Commits: `feat(leave): add approve endpoint`.
- Mỗi PR ít nhất 1 người review; PR đụng tới phân quyền, migration, kiến trúc thì TV1 review. Review trong 24 giờ.
- PR template có checklist: lint, test, e2e, cập nhật openapi, thử migration up/down, ảnh hưởng phân quyền.

## 3. Module Leave: state machine

File `leave-state-machine.ts` là hàm thuần (không đụng database) để dễ test. Tuần 8 gọi nó trong transaction rồi cập nhật bảng.

| Trạng thái hiện tại | Hành động | Ai được làm | Trạng thái mới | Thay đổi số dư |
|---|---|---|---|---|
| (tạo đơn) | submit | Nhân viên | SUBMITTED | pending + số ngày |
| SUBMITTED | approve | Quản lý trực tiếp | APPROVED | không đổi |
| SUBMITTED | reject | Quản lý trực tiếp | REJECTED | pending − số ngày |
| SUBMITTED | cancel | Người tạo đơn | CANCELLED | pending − số ngày |
| APPROVED | complete | HR | COMPLETED | pending − số ngày, used + số ngày |

Kết quả của mỗi lần gọi là một trong bốn loại:
- `changed`: chuyển trạng thái hợp lệ, kèm thay đổi số dư.
- `unchanged`: gửi lại cùng quyết định (bấm Duyệt hai lần) → trả kết quả cũ, không trừ phép lần nữa.
- `conflict` (409): quyết định ngược trạng thái hiện tại, ví dụ duyệt đơn đã bị từ chối.
- `forbidden` (403): người không đúng vai trò.

Số ngày nghỉ tính theo ngày làm việc, bỏ thứ 7 và chủ nhật (`workingDays`).

Entity đã có: `leave_type`, `leave_balance` (database chặn `used + pending > entitled`), `leave_request` (có `version`,
unique `employee_id + idempotency_key`), `leave_request_history`. Hai API đọc đã chạy: `GET /leave-types`, `GET /leave-balances/me`.

## 4. Test

9 unit test trong `leave-state-machine.spec.ts`: duyệt, từ chối, hủy, hoàn tất, duyệt lần hai, duyệt đơn đã từ chối,
sai người duyệt, hủy đơn đã duyệt, đếm ngày làm việc.

## Việc mang sang tuần 8

API workflow `/leave-requests` dựa trên state machine này.
