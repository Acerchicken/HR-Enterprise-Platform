# Ca kiểm thử workflow nghỉ phép

Ca kiểm thử cho 5 bước của luồng nghỉ phép (tạo, duyệt, từ chối, hủy, HR hoàn tất), đối chiếu với business rule trong
[`leave-rules.md`](leave-rules.md) và danh sách ngày lễ trong [`leave-types-holidays.md`](leave-types-holidays.md).
Bản nháp đầu do TV4 (Duy) viết ở PR #13; bản này sửa theo review của PR đó.

**Tài khoản demo** (mật khẩu chung `Passw0rd!`): `employee` (Trần Thị Nhân), `manager` (Nguyễn Văn Quản, quản lý trực tiếp
của `employee`), `hr`, `admin`. `hr` không phải quản lý trực tiếp của `employee`.

**API** (tiền tố `/api/v1`): `POST /leave-requests` (header `Idempotency-Key`), `POST /leave-requests/{id}/approve | reject |
cancel | complete` với body `{ version, comment? }`. Lỗi trả về `{ code, message, traceId }`.

**Điều kiện đầu:** số dư phép năm (`ANNUAL`) năm 2026 của `employee` còn ít nhất 3 ngày, chưa có đơn nào trong các khoảng ngày
dưới đây. Các ca dùng ngày năm 2026.

## 1. Tạo đơn

| Mã | Tên ca | BR | Tài khoản | Đầu vào | Kết quả mong đợi |
|---|---|---|---|---|---|
| TC-01 | Tạo đơn phép năm hợp lệ | BR-01, BR-03 | `employee` | `ANNUAL`, 09/11/2026 (T2) – 10/11/2026 (T3), lý do "Việc gia đình" | 201. Đơn `SUBMITTED`, `days` = 2. Số dư: `pending` +2, `used` không đổi |
| TC-02 | Gửi lại cùng Idempotency-Key | BR-11 | `employee` | Gửi lại đúng request TC-01, cùng key | Trả về đúng đơn của TC-01 (cùng `id`), không tạo đơn mới, `pending` không tăng thêm |
| TC-03 | Không đủ số dư | BR-01 | `employee` | `ANNUAL`, 01/12/2026 – 31/12/2026 (23 ngày làm việc) | 400 "Không đủ số dư". Không tạo đơn, số dư không đổi |
| TC-04 | Trùng lịch với đơn đang chờ | BR-02 | `employee` | Sau TC-01: `ANNUAL`, 10/11/2026 – 11/11/2026 | 409. Có chung ngày 10/11 với đơn `SUBMITTED` của TC-01 |
| TC-05 | Đơn qua kỳ nghỉ lễ 30/4–1/5 | BR-03 | `employee` | `ANNUAL`, 29/04/2026 (T4) – 04/05/2026 (T2) | 201, `days` = 2 (29/4 và 4/5). 30/4, 1/5 là ngày lễ, 2–3/5 là cuối tuần |
| TC-06 | Đơn chỉ gồm ngày nghỉ bù 27/4 | BR-03 | `employee` | `ANNUAL`, 27/04/2026 – 27/04/2026 | 400 "Khoảng nghỉ không có ngày làm việc nào". Không tạo đơn |
| TC-07 | Đơn chỉ gồm cuối tuần | BR-03 | `employee` | `ANNUAL`, 14/11/2026 (T7) – 15/11/2026 (CN) | 400, 0 ngày làm việc |
| TC-08 | Hai nửa ngày khác buổi cùng ngày | BR-04 | `employee` | Đơn 1: 16/11/2026 buổi sáng (`AM`); đơn 2: 16/11/2026 buổi chiều (`PM`) | Cả hai 201, mỗi đơn `days` = 0,5 |
| TC-09 | Cả ngày trùng với nửa ngày đã gửi | BR-02, BR-04 | `employee` | Sau TC-08: `ANNUAL`, 13/11/2026 – 16/11/2026 | 409, trùng ngày 16/11 |
| TC-10 | Dữ liệu sai | – | `employee` | (a) ngày kết thúc trước ngày bắt đầu; (b) nửa ngày nhưng hai ngày khác nhau; (c) loại phép không tồn tại; (d) thiếu header `Idempotency-Key` | 400 cho cả 4 trường hợp |

## 2. Quản lý duyệt

| Mã | Tên ca | BR | Tài khoản | Đầu vào | Kết quả mong đợi |
|---|---|---|---|---|---|
| TC-11 | Quản lý trực tiếp duyệt | BR-05 | `manager` | Đơn TC-01 (`SUBMITTED`), `version` hiện tại | 200. Đơn `APPROVED`, `approverId` = `manager`. Số dư không đổi (vẫn giữ trong `pending`). Lịch sử có dòng `SUBMITTED → APPROVED` |
| TC-12 | Người không phải quản lý trực tiếp duyệt | BR-05 | `hr`, `employee` | Đơn `SUBMITTED` của `employee` | 403 cho cả hai, đơn giữ `SUBMITTED` |
| TC-13 | Duyệt lại lần hai | BR-11 | `manager` | Gửi lại approve cho đơn TC-11 đã `APPROVED` | 200, đơn vẫn `APPROVED`, `version` và số dư không đổi |
| TC-14 | Duyệt với version cũ | – | `manager` | Đơn `SUBMITTED`, gửi `version` khác version hiện tại | 409, đơn không đổi |

## 3. Quản lý từ chối

| Mã | Tên ca | BR | Tài khoản | Đầu vào | Kết quả mong đợi |
|---|---|---|---|---|---|
| TC-15 | Quản lý trực tiếp từ chối | BR-05, BR-09 | `manager` | Đơn 1 ngày `SUBMITTED` (vd 11/11/2026), comment "Trùng lịch dự án" | 200. Đơn `REJECTED`. `pending` giảm 1, `used` không đổi. Lịch sử lưu comment |
| TC-16 | Từ chối đơn đã được duyệt | BR-05, BR-11 | `manager` | Đơn TC-11 (`APPROVED`) | 409, đơn giữ `APPROVED` |

## 4. Nhân viên hủy

| Mã | Tên ca | BR | Tài khoản | Đầu vào | Kết quả mong đợi |
|---|---|---|---|---|---|
| TC-17 | Hủy đơn đang chờ duyệt | BR-07 | `employee` | Đơn TC-05 (`SUBMITTED`) | 200. Đơn `CANCELLED`, `pending` giảm 2 |
| TC-18 | Hủy đơn đã duyệt | BR-08 | `employee` | Đơn TC-11 (`APPROVED`) | 409, đơn giữ `APPROVED`, số dư không đổi |
| TC-19 | Người khác hủy đơn | BR-07 | `manager` | Đơn `SUBMITTED` của `employee` | 403 |

## 5. HR hoàn tất

| Mã | Tên ca | BR | Tài khoản | Đầu vào | Kết quả mong đợi |
|---|---|---|---|---|---|
| TC-20 | HR hoàn tất đơn đã duyệt | BR-10, BR-11 | `hr` | Đơn TC-11 (`APPROVED`) | 200. Đơn `COMPLETED`. `pending` giảm 2, `used` tăng 2. Lịch sử đủ 3 dòng `SUBMITTED → APPROVED → COMPLETED`; audit có `LEAVE_SUBMIT`, `LEAVE_APPROVE`, `LEAVE_COMPLETE` |
| TC-21 | HR hoàn tất đơn chưa duyệt | BR-10 | `hr` | Đơn `SUBMITTED` | 409, đơn giữ `SUBMITTED` |
| TC-22 | Không phải HR hoàn tất | BR-10 | `employee`, `manager` | Đơn `APPROVED` | 403 |

## Ghi chú

- Các ca đã có e2e test tương ứng trong `backend/test/app.e2e-spec.ts` (nhóm "workflow nghỉ phép"), trừ TC-04, TC-21 và
  TC-22 (cần bổ sung e2e).
- BR-06 (người duyệt thay) chưa có trong hệ thống nên chưa có ca kiểm thử.
- Khi có màn hình nghỉ phép (`feat/leave-ui`), chạy lại các ca trên qua giao diện và ghi kết quả vào `test-report-tuan-08.md`.
