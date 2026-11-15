# UC2 – Thông tin tổ chức: triển khai

> Cách chạy chung, staging, rollback chung: [README](../README.md#môi-trường). File này chỉ ghi phần riêng của UC2.

## 1. Thành phần

| Thành phần | Phần của UC2 |
|---|---|
| API | `backend/src/modules/organization` (phòng ban, chức danh, cây); danh bạ ở `modules/employee` |
| Web | `/directory` (`DirectoryPage.tsx`), `/org` (`OrgPage.tsx`) |
| Database | Schema `org` (`department`, `position`); chỉ mục `ix_employee_search` dùng `pg_trgm`; migration `1729900000000-InitSchemas` |
| Cache | `organization.service.ts` cache danh sách phòng ban, chức danh trong bộ nhớ 10 phút (`common/ttl-cache.ts`), không dùng Redis (ADR-07) |

## 2. Biến môi trường

Không có biến riêng. Dùng `DB_*` và `OIDC_*` như UC1.

## 3. Hạ tầng

| Môi trường | Tài nguyên | File |
|---|---|---|
| Local | PostgreSQL có extension `pg_trgm` (migration tự tạo) | `docker-compose.yml` |
| Staging | RDS PostgreSQL; tài khoản database cần quyền `CREATE EXTENSION` khi chạy migration lần đầu | `infra/staging/rds.tf` |

## 4. Các bước

- Seed tạo 25 phòng ban, một gốc "Ban Giám đốc" (mã `BOD`) và CEO. Staging chạy seed một lần qua Deploy Staging (`run_seed`).
- Cache nằm trong từng instance và được xóa khi tạo, sửa phòng ban trên chính instance đó. Có nhiều instance thì instance khác
  có thể trả danh sách cũ tối đa 10 phút.

## 5. Kiểm tra sau deploy

1. Mở `/org`: cây có một gốc và đủ phòng ban.
2. Mở `/directory`, tìm theo một phần tên: có kết quả, có phân trang.
3. HR tạo một phòng ban thử dưới `BOD`: trả 201, xuất hiện trong cây.

## 6. Rollback và sự cố

Không có migration riêng. Rollback image không ảnh hưởng dữ liệu tổ chức.

## 7. Còn thiếu

- Giao diện quản lý phòng ban (FR-2.4) chưa có, tuần 13 nếu còn thời gian.
