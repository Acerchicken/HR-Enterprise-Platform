# UC2 – Thông tin tổ chức: kiểm thử

> Tiêu chí: [requirements.md](requirements.md). Cách chạy chung, tài khoản mẫu: [README](../README.md#kiểm-thử).

## 1. Chiến lược

Rủi ro chính: cây tổ chức sai (vòng, nhiều gốc) làm sai người duyệt đơn ở UC4, và danh bạ lộ người đã nghỉ việc. Unit test kiểm
thuật toán chặn vòng; e2e kiểm cây, quy tắc một quản lý; ca SEC kiểm quyền tạo, sửa phòng ban.

## 2. Test tự động đã có

| Mức | File | Nội dung |
|---|---|---|
| Unit | `backend/src/modules/organization/organization.service.spec.ts` | Chặn vòng khi đổi phòng ban cha |
| Unit | `backend/src/common/ttl-cache.spec.ts` | Cache danh sách phòng ban |
| e2e | `backend/test/app.e2e-spec.ts` | Danh bạ, cây, nhóm "quản lý trực tiếp và CEO", "ma trận phân quyền" |

## 3. Bảng phủ tiêu chí

| Tiêu chí | Test tự động (e2e, tên test) | Ca tay | Trạng thái |
|---|---|---|---|
| AC-2.1.1 | "danh bạ tìm kiếm và phân trang" (theo tên) | Cần thêm theo mã, email | Một phần |
| AC-2.1.2 | – | Cần thêm | Chưa |
| AC-2.1.3 | – | Cần thêm | Chưa |
| AC-2.1.4 | – | Cần thêm (`size = 101`) | Chưa |
| AC-2.2.1 | "cây tổ chức có 1 gốc (Ban Giám đốc) và đủ 25 phòng ban" | – | Có |
| AC-2.2.2, AC-2.3.1 | "thành viên phòng ban và nhân viên trực thuộc" | – | Có |
| AC-2.4.1, AC-2.4.4 | "nhân viên không tạo được phòng ban; HR tạo được", "tạo, sửa phòng ban: HR và ADMIN…" | SEC-05 → SEC-16 | Có |
| AC-2.4.2 | "tạo, sửa phòng ban: … không tạo được vòng lặp" | – | Có |
| AC-2.4.3 | – | Cần thêm | Chưa |
| AC-2.4.5 | – | – | Chưa có giao diện |
| AC-2.4.6, AC-2.4.7 | – | – | Chưa đạt (API chấp nhận gốc thứ hai, `headEmployeeId` bất kỳ) |
| AC-2.5.1 | "tạo nhân viên không phải CEO mà thiếu quản lý → 400; tạo CEO thứ hai → 400" | – | Có |
| AC-2.5.2 | "HR không gán được quản lý tạo vòng lặp" | – | Có |
| AC-2.6.x → AC-2.9.x | – | Cần thêm (TV4, khi có tính năng) | Chưa có tính năng |
| AC-2.5.3 | "gán quản lý đã nghỉ việc → 400; gán quản lý cho CEO → 400; bỏ quản lý của nhân viên → 400" | – | Có |

## 4. Dữ liệu và tài khoản

Seed tạo 25 phòng ban, gốc `BOD`, một CEO. Test tạo phòng ban, nhân viên dùng mã riêng để không trùng seed.

## 5. Cách chạy

```bash
cd backend
npm test -- organization
npm run test:e2e
```

## 6. Kiểm thử phi chức năng

- NFR-1.3: tìm đồng nghiệp p95 < 1 s với 2.000 nhân viên, trong load test tuần 11.
- NFR-1.6: mọi danh sách tối đa 100 dòng (AC-2.1.4).

## 7. Ca còn thiếu (TV4)

AC-2.1.1 (theo mã, email), AC-2.1.2, AC-2.1.3, AC-2.1.4, AC-2.4.3; AC-2.4.6, AC-2.4.7 khi `fix/employee-org-integrity` xong.
