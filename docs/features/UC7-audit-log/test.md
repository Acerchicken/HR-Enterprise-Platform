# UC7 – Lịch sử thao tác: kiểm thử

> Tiêu chí: [requirements.md](requirements.md). Cách chạy chung, tài khoản mẫu: [README](../README.md#kiểm-thử).

## 1. Chiến lược

Rủi ro chính: **thiếu audit** (thao tác thành công mà không có bản ghi), **audit chứa giá trị nhạy cảm**, và audit bị sửa xóa.
e2e kiểm audit sau từng thao tác của UC1, UC2, UC3, UC4, UC5, UC8; một test chạy UPDATE thẳng vào database để chứng minh trigger chặn;
hiệu năng tra cứu đo với dữ liệu lớn.

## 2. Test tự động đã có

| Mức | File | Nội dung |
|---|---|---|
| e2e | `backend/test/app.e2e-spec.ts` | Audit sau thao tác hồ sơ, đơn vị, điều chuyển, đơn nghỉ, cấp và thu hồi vai trò, lời mời tài khoản; quyền tra cứu; trigger append-only (mục 3) |
| Unit | `backend/src/modules/employee/employee-audit.spec.ts` | Audit theo nhóm trường (giá trị trường tổ chức, `***` cho trường cá nhân) |

## 3. Bảng phủ tiêu chí

| Tiêu chí | Test tự động (e2e, tên test) | Ca tay | Trạng thái |
|---|---|---|---|
| AC-7.1.1 | "HR xem trường nhạy cảm (đã giải mã) và lượt xem được audit", "tạo → quản lý duyệt → HR hoàn tất sau ngày kết thúc; số dư, lịch sử, audit, outbox đúng", "nghỉ việc gỡ vai trò trưởng, phó trong cùng giao dịch, có audit (AC-2.9.8)", "cấp HR: … audit, event (AC-8.7.1)" | – | Có cho UC1, UC2, UC3, UC4, UC8; UC5 (`DOCUMENT_*`), `HOLIDAY_*`, `DELEGATION_*` cần thêm |
| AC-7.1.2 | – | Cần thêm | Chưa |
| AC-7.1.3 | "HR cập nhật lương: audit chỉ ghi tên trường, không ghi giá trị", "từ chối bắt buộc lý do …; lý do không vào audit (BR-14)", "employeeCode chỉ ghi tên, không ghi giá trị (AC-7.1.3)"; unit `employee-audit.spec.ts` | Cần thêm CCCD | Có |
| AC-7.1.4 | "traceId, IP của request có trong audit của module không truyền meta (AC-7.1.4)" | – | Có |
| AC-7.2.1 | "audit_log là append-only ở mức database" | – | Có |
| AC-7.3.1 | Lọc theo `entity`, `entityId` trong test VIEW_SENSITIVE | Cần thêm `actor`, `from`, `to` | Một phần |
| AC-7.3.2 | "nhân viên không xem được audit log", "audit log: HR, ADMIN xem được; MANAGER bị chặn" | SEC-03, SEC-04 | Có |
| AC-7.3.3 | "sai tham số: 400 (AC-7.3.3)" | – | Có |
| AC-7.3.4 | – | Mở `/audit` bằng HR, ADMIN; lọc, mở chi tiết, sao chép `traceId` | Ca tay |
| AC-7.3.5 | "from=to=ngày: lấy đủ ngày theo giờ Việt Nam, kể cả 0–7 giờ sáng (AC-7.3.5)"; unit `audit-period.spec.ts` | – | Có |
| AC-7.3.6 | "tạo → quản lý duyệt → HR hoàn tất …" (lọc `leave_request`) | Cần thêm: lọc `employee` không có bước đơn | Một phần |
| AC-7.3.7 | "ADMIN không thấy audit đơn nghỉ, số dư phép; HR thấy (AC-7.3.7, D1)" | – | Có |
| AC-7.3.8 | "lọc theo hành động, nhiều giá trị; có tên người thực hiện (AC-7.3.8)"; unit `audit-catalog.spec.ts` (mọi hành động trong code có trong danh mục) | – | Có |
| AC-7.4.1 | – | – | Chưa có tính năng |
| AC-7.4.2 | "cấp HR: …(AC-8.7.1)", "thu hồi HR: … audit có lý do (AC-8.7.2)", "HR nghỉ việc mất HR, có audit và event …" | – | Có |

## 4. Dữ liệu và tài khoản

- `hr@hr.local`, `admin@hr.local` tra cứu; `employee@hr.local`, `manager@hr.local` bị chặn.
- Hiệu năng NFR-2.4: sinh ~3,75 triệu bản ghi audit giả bằng `INSERT … SELECT generate_series` trên database riêng cho load test
  (không chạy trên staging đang demo).

## 5. Cách chạy

```bash
cd backend
npm run test:e2e
```

## 6. Kiểm thử phi chức năng

- NFR-2.4: tra cứu theo đối tượng hoặc khoảng thời gian p95 < 1 s với ~3,75 triệu bản ghi (tuần 11).
- NFR-6.4: `traceId` trong audit khớp header `X-Trace-Id` của response.

## 7. Ca còn thiếu (TV4)

- AC-7.1.2: thao tác lỗi (ví dụ duyệt với `version` cũ) không sinh audit.
- AC-7.1.3: audit không chứa CCCD, số tài khoản, lý do nghỉ ốm.
- AC-7.3.1: lọc theo `actor`.
- NFR-2.4: `EXPLAIN` truy vấn chỉ theo `from`, `to` dùng `ix_audit_at` với 3,75 triệu bản ghi.
- AC-7.1.1 cho thao tác kho tài liệu (`DOCUMENT_*`).
