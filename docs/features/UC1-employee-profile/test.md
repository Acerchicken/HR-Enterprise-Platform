# UC1 – Hồ sơ nhân viên: kiểm thử

> Tiêu chí: [requirements.md](requirements.md). Cách chạy chung, tài khoản mẫu: [README](../README.md#kiểm-thử).

## 1. Chiến lược

Rủi ro chính của UC1 là **lộ dữ liệu**: người không đủ quyền thấy trường cá nhân, trường nhạy cảm, file hồ sơ, hoặc giá trị nhạy
cảm lọt vào audit. Rủi ro thứ hai là **dữ liệu chưa kiểm lọt vào hồ sơ**: thay đổi của nhân viên phải qua HR duyệt, kể cả khi gọi API trực
tiếp. Rủi ro thứ ba là **lạm dụng**: tải file độc hại, spam yêu cầu, cào dữ liệu. Vì vậy:

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
| AC-1.2.2 | "nhân viên tự sửa số điện thoại; không sửa được lương hay hồ sơ người khác" | SEC | Có |
| AC-1.2.3 | "dữ liệu sai → 400", "lỗi validation trả thêm fields theo từng trường" | – | Có |
| AC-1.3.1 | "HR xem trường nhạy cảm (đã giải mã) và lượt xem được audit" | SEC | Có |
| AC-1.3.2 | "xem hồ sơ: … nhân viên không xem trường nhạy cảm" | SEC | Có |
| AC-1.3.3 | – | Cần thêm | Chưa |
| AC-1.3.4 | – (giao diện) | Mở form sửa của HR: tab Network không có `include=sensitive` tới khi bấm "Hiện giá trị hiện tại" | Đã có (#84), chờ ca tay |
| AC-1.4.1 | "HR cập nhật lương: audit chỉ ghi tên trường, không ghi giá trị" | – | Có |
| AC-1.4.3 | e2e "audit theo nhóm trường…" | – | Đã có (#84) |
| AC-1.4.4 | e2e "HR sửa email công ty…", "audit theo nhóm trường…" | – | Đã có (#84) |
| AC-1.4.2 | – (giao diện) | Kiểm tay trên `/employees/:id/edit` | Chưa ghi biên bản |
| AC-1.5.1 | "HR tạo nhân viên kèm quản lý và trường nhạy cảm: 201, audit chỉ ghi tên trường nhạy cảm (FR-1.5)" | – | Có |
| AC-1.5.2 | "HR không gán được quản lý tạo vòng lặp", "tạo nhân viên không phải CEO mà thiếu quản lý → 400…" | – | Có |
| AC-1.5.3 | – | Cần thêm | Chưa |
| AC-1.5.4 | "tạo nhân viên: chỉ HR…" | SEC | Có |
| AC-1.6.1 | "version cũ → 409 (optimistic locking)" | – | Có |
| AC-1.6.2 | e2e "sửa hồ sơ không kèm version → 400" | – | Đã có (#84) |
| AC-1.6.3 | e2e "chỉ đổi lương cũng tăng version…" | – | Đã có (#84) |
| AC-1.7.1, AC-1.7.2 | e2e "không cho nghỉ việc khi còn cấp dưới", "người đã nghỉ việc gọi API… 403" | – | Đã có (#84) |
| AC-1.3.5 | e2e `chủ hồ sơ bấm mắt xem lương của mình`, `mục cá nhân: … chỉ HR có CCCD đã che` | Chủ hồ sơ bấm mắt ở Lương mục tiêu, tài khoản ngân hàng | Đã có (`feat/profile-layout`) |
| AC-1.6.4 | e2e "duyệt khi dòng đã đổi sau khi gửi → 409…" | – | Đã có (#86) |
| AC-1.8.1 → AC-1.8.5 | e2e `summary` theo quan hệ (AC-1.8.4); giao diện kiểm tay | Kiểm tay bằng 4 tài khoản mẫu, trên màn hình 375 px và 1280 px | Đã có (`feat/profile-layout`), chờ TV4 chạy ca tay |
| AC-1.8.6 | e2e `mục không được xem, chưa làm hoặc không tồn tại đều trả 404` | – | Đã có |
| AC-1.8.7, AC-1.8.8 | e2e `/me chỉ có tài khoản…`, `summary mức danh bạ…` | Kiểm tay bằng tab Network: mở trang chỉ có `summary`, bấm mục nào mới có request mục đó, bấm mắt mới có `reveal=true` | Đã có |
| AC-1.2.1 | e2e "sửa điện thoại qua yêu cầu: 202…", "nhân viên không ghi thẳng hồ sơ… 403" | – | Đã có (#86) |
| AC-1.9.1 → AC-1.9.13 | e2e nhóm "UC1 yêu cầu cập nhật hồ sơ và nhật ký" (gửi, hủy, duyệt, từ chối, 409 khi `baseVersion` cũ, 403, quá số dòng, Idempotency-Key, người phụ thuộc mã hóa) | Email (Mailpit): báo HR gộp 1 giờ, kết quả xử lý, đổi tài khoản ngân hàng; nhãn "Quá hạn" sau 2 ngày làm việc | Đã có (#86); AC-1.9.11 mục thuế TNCN ở #89 |
| AC-1.10.1 → AC-1.10.9 | e2e nhóm "UC1 file hồ sơ" với bucket giả trong bộ nhớ (`test/fake-storage.ts`) | Chạy lại với MinIO hoặc S3 thật: PUT bằng URL ký, lifecycle 30 ngày (TV3) | Đã có (#87); AC-1.10.7 phần lifecycle chờ `infra/profile-files` |
| AC-1.11.1 → AC-1.11.4 | e2e "lịch sử thay đổi…", kiểm audit không chứa giá trị, lý do từ chối, tên file | Quét log API, worker tìm giá trị mẫu | Đã có (#86, #87) |
| AC-1.12.1 → AC-1.12.5, AC-1.9.11 | e2e nhóm "UC1 mục HR quản lý và thuế TNCN" (hợp đồng trùng ngày 409, diện đối tượng, sắp hết hạn, lịch sử lương, mã hóa, thuế TNCN, BHYT một lần mỗi quý) | Kiểm tay trang "Hợp đồng sắp hết hạn" | Đã có (#89) |
| AC-1.13.1 → AC-1.13.3 | Unit test `profile-computed.spec.ts`; e2e nhóm "UC1 thông tin tự tính" | Kiểm tay dòng thời gian với nhân viên có đơn nghỉ dài | Đã có (#90) |
| AC-1.14.1 → AC-1.14.7 | Unit test `rate-limit.spec.ts`; e2e "lệnh ghi hồ sơ thứ 31… 429", "body quá 64 KiB → 413" | 11 lệnh xin URL trong 1 giờ, 101 lượt xem nhạy cảm; cảnh báo dashboard (AC-1.14.5, TV3) | Đã có (#85), trừ AC-1.14.5 |

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
- NFR-5.18: tìm giá trị CCCD, lương, số tài khoản, mã số thuế người phụ thuộc và tên file mẫu trong log API và bảng audit sau
  khi chạy e2e: không được có.
- NFR-5.21: đo giới hạn tần suất (AC-1.14.x) trên staging, kể cả khi App Runner chạy 2 instance.

## 7. Ca còn thiếu (TV4)

- AC-1.3.3: HR mở hồ sơ không kèm `include=sensitive` thì không có `VIEW_SENSITIVE`.
- AC-1.5.3: tạo trùng mã hoặc email trả 409.
- AC-1.4.2: biên bản kiểm tay giao diện HR (ngày, môi trường, commit).
- AC-1.8.x, AC-1.3.5: viết khi `feat/profile-layout` xong.
- AC-1.9.x, AC-1.6.4, AC-1.11.x: viết khi `feat/profile-change-requests` xong.
- AC-1.10.x: ca bảo mật file trong `docs/security-test-cases-week11` (TV4), chạy khi `feat/profile-files` xong.
- AC-1.14.x: ca rate limit trong `docs/security-test-cases-week11`.
- AC-1.3.4, AC-1.4.3, AC-1.4.4, AC-1.6.2, AC-1.6.3, AC-1.7.1, AC-1.7.2: viết khi `fix/employee-org-integrity` xong.
