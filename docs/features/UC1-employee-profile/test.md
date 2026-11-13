# UC1 – Hồ sơ nhân viên: kiểm thử

> Tiêu chí: [requirements.md](requirements.md). Cách chạy chung, tài khoản mẫu: [README](../README.md#kiểm-thử).

## 1. Chiến lược

Rủi ro chính của UC1 là **lộ dữ liệu**: người không đủ quyền thấy trường cá nhân, trường nhạy cảm, hoặc giá trị nhạy cảm lọt vào
audit. Vì vậy:

- Unit test kiểm hàm quyết định mức xem và trường được sửa, chạy trong CI.
- e2e kiểm từng vai trò trên API thật, kể cả audit.
- Ca kiểm thử bảo mật SEC đi hết các ô của ma trận phân quyền.
- Kiểm tay trên giao diện HR: lỗi hiện đúng ô, 409 khi sửa đồng thời.

## 2. Test tự động đã có

| Mức | File | Nội dung |
|---|---|---|
| Unit | `backend/src/modules/employee/employee-access.spec.ts` | Mức xem theo vai trò và quan hệ; trường được sửa |
| Unit | `backend/src/modules/employee/employee-fields.spec.ts` | Bộ mô tả trường: trường nhân viên tự sửa, trường nào có trong DTO tạo, sửa |
| Unit | `backend/src/common/field-crypto.spec.ts` | Mã hóa, giải mã AES-256-GCM |
| e2e | `backend/test/app.e2e-spec.ts` | Các test hồ sơ, trường nhạy cảm, nhóm "ma trận phân quyền" (liệt kê ở mục 3) |

## 3. Bảng phủ tiêu chí

| Tiêu chí | Test tự động (e2e, tên test) | Ca tay | Trạng thái |
|---|---|---|---|
| AC-1.1.1 | "nhân viên xem hồ sơ người khác chỉ thấy thông tin danh bạ" | SEC-17 → SEC-34 | Có |
| AC-1.1.2 | "quản lý trực tiếp thấy thông tin cá nhân, không thấy trường nhạy cảm" | SEC | Có |
| AC-1.1.3 | "xem hồ sơ: chủ hồ sơ PERSONAL, HR mức HR, ADMIN chỉ mức danh bạ…" | SEC | Có |
| AC-1.2.1, AC-1.2.2 | "nhân viên tự sửa số điện thoại; không sửa được lương hay hồ sơ người khác" | SEC | Có |
| AC-1.2.3 | "dữ liệu sai → 400", "lỗi validation trả thêm fields theo từng trường" | – | Có |
| AC-1.3.1 | "HR xem trường nhạy cảm (đã giải mã) và lượt xem được audit" | SEC | Có |
| AC-1.3.2 | "xem hồ sơ: … nhân viên không xem trường nhạy cảm" | SEC | Có |
| AC-1.3.3 | – | Cần thêm | Chưa |
| AC-1.3.4 | – | – | Chưa đạt (form sửa tự tải trường nhạy cảm) |
| AC-1.4.1 | "HR cập nhật lương: audit chỉ ghi tên trường, không ghi giá trị" | – | Có |
| AC-1.4.3 | – | – | Chưa đạt (audit ghi giá trị địa chỉ, ngày sinh; không ghi giá trị cũ) |
| AC-1.4.4 | – | – | Chưa đạt (API không nhận `hireDate`, `workEmail`) |
| AC-1.4.2 | – (giao diện) | Kiểm tay trên `/employees/:id/edit` | Chưa ghi biên bản |
| AC-1.5.1 | "HR tạo nhân viên kèm quản lý và trường nhạy cảm: 201, audit chỉ ghi tên trường nhạy cảm (FR-1.5)" | – | Có |
| AC-1.5.2 | "HR không gán được quản lý tạo vòng lặp", "tạo nhân viên không phải CEO mà thiếu quản lý → 400…" | – | Có |
| AC-1.5.3 | – | Cần thêm | Chưa |
| AC-1.5.4 | "tạo nhân viên: chỉ HR…" | SEC | Có |
| AC-1.6.1 | "version cũ → 409 (optimistic locking)" | – | Có |
| AC-1.6.2 | – | – | Chưa đạt (code chưa bắt buộc `version`) |
| AC-1.6.3 | – | – | Chưa đạt (sửa chỉ lương không tăng `version`) |
| AC-1.7.1, AC-1.7.2 | – | – | Chưa đạt |

## 4. Dữ liệu và tài khoản

- `employee@hr.local` có quản lý trực tiếp là `manager@hr.local`; `hr@hr.local`, `admin@hr.local`.
- Seed sinh ~2.000 hồ sơ có trường nhạy cảm đã mã hóa. Test tạo hồ sơ dùng mã `E99xxx` để không trùng seed.

## 5. Cách chạy

```bash
cd backend
npm test -- employee           # unit test của UC1
npm run test:e2e               # cần docker compose (db, keycloak) đã chạy, đã migrate và seed
```

## 6. Kiểm thử phi chức năng

- NFR-1.1: `GET /employees/{id}` trong load test tuần 11, p95 < 300 ms.
- NFR-5.18: tìm giá trị CCCD, lương mẫu trong log API và bảng audit sau khi chạy e2e: không được có.

## 7. Ca còn thiếu (TV4)

- AC-1.3.3: HR mở hồ sơ không kèm `include=sensitive` thì không có `VIEW_SENSITIVE`.
- AC-1.5.3: tạo trùng mã hoặc email trả 409.
- AC-1.4.2: biên bản kiểm tay giao diện HR (ngày, môi trường, commit).
- AC-1.3.4, AC-1.4.3, AC-1.4.4, AC-1.6.2, AC-1.6.3, AC-1.7.1, AC-1.7.2: viết khi `fix/employee-org-integrity` xong.
