# UC2 – Thông tin tổ chức: triển khai

> Cách chạy chung, staging, rollback chung: [README](../README.md#môi-trường). File này chỉ ghi phần riêng của UC2.

## 1. Thành phần

| Thành phần | Phần của UC2 |
|---|---|
| API | `backend/src/modules/organization` (phòng ban, chức danh, cây); danh bạ ở `modules/employee` |
| Web | `/directory` (`DirectoryPage.tsx`), `/org` (`OrgPage.tsx`) |
| Database | Schema `org` (`department`, `department_deputy`, `position`), bảng `employee.employment_assignment`; chỉ mục `ix_employee_search` dùng `pg_trgm`; migration `1729900000000-InitSchemas`, `1732000000000-OrgUnitTypes`, `1732100000000-OrgUnitRoles`, `1732200000000-EmploymentAssignment` |
| Worker | `TransferJob` (`backend/src/worker/transfer-job.ts`) chạy trong process worker, 5 phút một lần: áp dụng điều chuyển `SCHEDULED` đã tới ngày (giờ Việt Nam), `FOR UPDATE SKIP LOCKED` nên nhiều instance worker vẫn an toàn |
| Cache | `organization.service.ts` cache danh sách phòng ban, chức danh trong bộ nhớ 10 phút (`common/ttl-cache.ts`), không dùng Redis (ADR-07) |

## 2. Biến môi trường

Không có biến riêng. Dùng `DB_*` và `OIDC_*` như UC1.

## 3. Hạ tầng

| Môi trường | Tài nguyên | File |
|---|---|---|
| Local | PostgreSQL có extension `pg_trgm` (migration tự tạo) | `docker-compose.yml` |
| Staging | RDS PostgreSQL; tài khoản database cần quyền `CREATE EXTENSION` khi chạy migration lần đầu | `infra/staging/rds.tf` |

## 4. Các bước

- Seed tạo 28 đơn vị (ADR-14): gốc Công ty (mã `HQ`) có CEO, 6 Trung tâm, các Phòng (Marketing, Pháp chế thẳng dưới Công
  ty), 3 Nhóm dưới Web Engineering. Staging chạy seed một lần qua Deploy Staging (`run_seed`).
- Migration `OrgUnitTypes` điền loại cho dữ liệu cũ: gốc thành Công ty, đơn vị con trực tiếp của gốc có đơn vị con thành
  Trung tâm, còn lại thành Phòng. Tên cũ ("Ban Giám đốc", "Khối…") giữ nguyên; muốn đúng tên mới thì chạy lại seed
  (`npm run seed -- --reset`, xóa dữ liệu).
- Migration `EmploymentAssignment` tạo một dòng "Tuyển mới" cho mỗi nhân viên đang có (từ ngày vào làm, giá trị hiện tại); người đã nghỉ có dòng đã đóng. Quá trình công tác cũ dựng từ audit không còn hiện.
- Worker phải chạy thì điều chuyển tương lai mới được áp dụng; điều chuyển hôm nay áp dụng ngay ở API.
- Cache nằm trong từng instance và được xóa khi tạo, sửa phòng ban trên chính instance đó. Có nhiều instance thì instance khác
  có thể trả danh sách cũ tối đa 10 phút.

## 5. Kiểm tra sau deploy

1. Mở `/org`: cây có một gốc và đủ phòng ban.
2. Mở `/directory`, tìm theo một phần tên: có kết quả, có phân trang.
3. HR tạo một phòng ban thử dưới `BOD`: trả 201, xuất hiện trong cây.

## 6. Rollback và sự cố

Migration của UC2 chỉ thêm cột, bảng. Rollback image về bản trước nhánh điều chuyển thì `PATCH /employees` lại sửa thẳng phòng ban, quản lý mà không ghi `employment_assignment`; nên `migration:revert` cùng lúc nếu rollback lâu. Điều chuyển `FAILED` xem bằng `GET /employees/{id}/transfers` (`failureReason`), sửa rồi tạo điều chuyển mới.

## 7. Còn thiếu

- Email cho quản lý mới khi điều chuyển (AC-2.7.3) và thông báo HR khi điều chuyển `FAILED` (AC-2.7.8): làm cùng dịch vụ thông báo (ADR-15).
