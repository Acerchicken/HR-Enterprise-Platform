# Ca kiểm thử workflow nghỉ phép

> Tài liệu kiểm thử: kiểm chứng FR UC3–UC4 trong [SRS](../requirements/SRS.md). Bộ tài liệu: [`docs/README.md`](../README.md).

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
| TC-20 | HR hoàn tất đơn đã duyệt | BR-10, BR-11 | `hr` | Đơn TC-11 (`APPROVED`), ngày kết thúc trước hôm nay (từ khi có AC-4.5.3) | 200. Đơn `COMPLETED`. `pending` giảm 2, `used` tăng 2. Lịch sử đủ 3 dòng `SUBMITTED → APPROVED → COMPLETED`; audit có `LEAVE_SUBMIT`, `LEAVE_APPROVE`, `LEAVE_COMPLETE` |
| TC-21 | HR hoàn tất đơn chưa duyệt | BR-10 | `hr` | Đơn `SUBMITTED` | 409, đơn giữ `SUBMITTED` |
| TC-22 | Không phải HR hoàn tất | BR-10 | `employee`, `manager` | Đơn `APPROVED` | 403 |
| TC-23 | Gửi lại cùng Idempotency-Key nhưng khác nội dung | AC-3.5.3, BR-11 | `employee` | Gửi request giống TC-01 với `Idempotency-Key` đã dùng, nhưng đổi `endDate` sang `11/11/2026` | 409 Conflict, không tạo đơn mới, số dư không đổi |
| TC-24 | Số dư phép theo tỉ lệ / thâm niên và nghỉ sự kiện | AC-3.1.3, AC-3.1.4 | `employee` | (a) Kiểm tra số dư nhân viên vào làm `01/07/2026` và nhân viên đủ 10 năm thâm niên; (b) Tạo đơn nghỉ sự kiện (Cưới 3 ngày / Con cưới 1 ngày / Tang 3 ngày) | (a) Được hưởng `6` ngày (tỉ lệ) và `14` ngày (thâm niên); (b) Tính đúng số ngày từng sự kiện, không trừ vào số dư phép năm |
| TC-25 | Đơn nghỉ vắt qua hai năm và tài khoản chưa gắn hồ sơ | AC-3.2.4, AC-3.2.5 | `employee` | (a) Tạo đơn `ANNUAL` từ `29/12/2026` đến `04/01/2027`; (b) Tài khoản chưa liên kết `employeeId` gọi API tạo đơn | (a) Trừ đúng số ngày làm việc thuộc năm `2026` và năm `2027` vào quỹ từng năm; (b) Trả `404` |
| TC-26 | Đổi quản lý trực tiếp khi đơn đang chờ duyệt | AC-4.2.6, BR-05 | `hr`, `manager` | Nhân viên có đơn `SUBMITTED`; `hr` điều chuyển nhân viên sang quản lý mới (`manager2`) | Quản lý cũ không còn thấy/duyệt được đơn (`403`/`404`); đơn chuyển sang danh sách chờ duyệt của `manager2` |
| TC-27 | HR hoàn tất đơn trước ngày kết thúc nghỉ | AC-4.5.3 | `hr` | Đơn `APPROVED` có ngày kết thúc ở tương lai (vd `20/11/2026`) | Nút **Hoàn tất** bị khóa trên UI (*"Hoàn tất được từ 21/11"*); gọi API trực tiếp trả `409` |
| TC-28 | Che lý do nghỉ ốm với Quản lý và audit HR xem lý do | AC-4.7.3, AC-4.7.4, BR-14 | `manager`, `hr` | Nhân viên tạo đơn `SICK` có lý do chi tiết; `manager` mở chi tiết đơn; `hr` mở đơn và bấm biểu tượng mắt xem lý do | `manager` chỉ thấy *"Lý do: chỉ HR xem"* (API không trả trường lý do); `hr` mặc định thấy lý do bị che, bấm mắt mới giải mã và ghi audit |
| TC-29 | HR duyệt cấp 2 cho đơn nghỉ không lương > 3 ngày / thai sản | AC-4.8.1 → AC-4.8.3, BR-16 | `manager`, `hr` | Nhân viên tạo đơn `UNPAID` `5` ngày làm việc; `manager` duyệt; sau đó `hr` vào tab `Đơn nghỉ` duyệt tiếp | Sau khi `manager` duyệt, đơn chuyển trạng thái chờ HR duyệt; sau khi `hr` duyệt, đơn chuyển `APPROVED` và ghi đủ 2 bước trong lịch sử |
| TC-30 | Chặn HR tự duyệt đơn nghỉ của chính mình | AC-4.8.5 | `hr` | Tài khoản `hr` tạo đơn nghỉ thuộc diện HR duyệt, sau đó mở đơn đó ở màn hình duyệt | Ẩn/khóa nút **Duyệt** và **Từ chối** (*"Bạn không duyệt đơn của chính mình"*); gọi API duyệt trả `403` |
| TC-31 | HR từ chối ở bước duyệt cấp 2 trả lại số dư | AC-4.8.4, BR-09 | `hr` | Đơn đã được `manager` duyệt và đang chờ HR duyệt; `hr` bấm **Từ chối** kèm lý do | 200. Đơn chuyển `REJECTED`, hoàn trả số ngày `pending` về quỹ phép của nhân viên |
| TC-32 | HR tạo, kết thúc sớm và hủy phân công duyệt thay | AC-4.3.1, AC-2.9.3 | `hr` | `hr` vào `/approvals/delegations`, tạo ủy quyền cho phó phòng duyệt thay trưởng phòng; kiểm tra chặn trùng người/trùng khoảng ngày; thử `Kết thúc sớm` và `Hủy` | Chỉ `hr` thao tác được; gợi ý phó phòng lên đầu; chặn trùng quản lý hoặc chồng lấn ngày hiệu lực; cập nhật trạng thái đúng |
| TC-33 | Người duyệt thay xử lý đơn của cấp dưới quản lý vắng | AC-4.3.2 → AC-4.3.4, BR-06 | `manager` (người thay) | Trong thời gian ủy quyền hiệu lực, người được ủy quyền mở `Việc cần duyệt` và duyệt đơn của cấp dưới trực tiếp của quản lý vắng | Thấy đơn kèm nhãn *"duyệt thay [Tên quản lý]"*, duyệt/từ chối thành công; không thấy đơn ngoài phạm vi và không ủy quyền tiếp cho người khác |

## Ghi chú

- Cả 22 ca đã có e2e test tương ứng trong `backend/test/app.e2e-spec.ts` (nhóm "workflow nghỉ phép"); TC-04, TC-21, TC-22
  bổ sung ở nhánh `test/access-control-e2e` (tuần 9).
- BR-06 (người duyệt thay) chưa có trong hệ thống nên chưa có ca kiểm thử.
- Khi có màn hình nghỉ phép (`feat/leave-ui`), chạy lại các ca trên qua giao diện và ghi kết quả vào `test-report-tuan-08.md`.
