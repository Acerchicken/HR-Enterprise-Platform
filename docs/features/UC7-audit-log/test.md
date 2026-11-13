# UC7 – Lịch sử thao tác: kiểm thử

> Tiêu chí: [requirements.md](requirements.md). Cách chạy chung, tài khoản mẫu: [README](../README.md#kiểm-thử).

## 1. Chiến lược

Rủi ro chính: **thiếu audit** (thao tác thành công mà không có bản ghi), **audit chứa giá trị nhạy cảm**, và audit bị sửa xóa.
e2e kiểm audit sau từng thao tác của UC1, UC4, UC5; một test chạy UPDATE thẳng vào database để chứng minh trigger chặn;
hiệu năng tra cứu đo với dữ liệu lớn.

## 2. Test tự động đã có

| Mức | File | Nội dung |
|---|---|---|
| e2e | `backend/test/app.e2e-spec.ts` | Audit sau thao tác hồ sơ, đơn nghỉ; quyền tra cứu; trigger append-only (mục 3) |

## 3. Bảng phủ tiêu chí

| Tiêu chí | Test tự động (e2e, tên test) | Ca tay | Trạng thái |
|---|---|---|---|
| AC-7.1.1 | "HR xem trường nhạy cảm (đã giải mã) và lượt xem được audit", "tạo → quản lý duyệt → HR hoàn tất; số dư, lịch sử và audit đúng" | – | Có cho UC1, UC3, UC4; UC5 cần thêm |
| AC-7.1.2 | – | Cần thêm | Chưa |
| AC-7.1.3 | "HR cập nhật lương: audit chỉ ghi tên trường, không ghi giá trị" | Cần thêm CCCD, lý do ốm | Một phần |
| AC-7.2.1 | "audit_log là append-only ở mức database" | – | Có |
| AC-7.3.1 | Lọc theo `entity`, `entityId` trong test VIEW_SENSITIVE | Cần thêm `actor`, `from`, `to` | Một phần |
| AC-7.3.2 | "nhân viên không xem được audit log", "audit log: HR, ADMIN xem được; MANAGER bị chặn" | SEC-03, SEC-04 | Có |
| AC-7.3.3 | – | Cần thêm | Chưa |
| AC-7.3.4 | – | – | Chưa có giao diện |
| AC-7.4.1 | – | – | Chưa có tính năng |

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
- AC-7.3.1: lọc theo `actor` và khoảng thời gian. AC-7.3.3: ngày sai định dạng, `size = 101`.
- AC-7.1.1 cho thao tác kho tài liệu (`DOCUMENT_*`).
