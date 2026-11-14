# UC7 – Lịch sử thao tác (audit log)

| Mục | Nội dung |
|---|---|
| Mục tiêu kinh doanh | MT-3 (100% lượt đọc, sửa dữ liệu nhạy cảm và lượt duyệt có audit) |
| Tác nhân chính | HR, ADMIN (tra cứu) |
| Tác nhân phụ, hệ thống ngoài | Các module Employee, Organization, Leave, Document (ghi audit); database (chặn sửa, xóa) |
| Yêu cầu (SRS) | FR-7.1 → FR-7.3 |
| Quy tắc | [ADR-09](../../architecture/adr/ADR-09-append-only-audit.md), ADR-08, [BR-13, BR-14](../../business/leave-rules.md) |
| Mức ưu tiên | M |
| Trạng thái | Ghi audit đã có; API tra cứu đã có; màn hình tra cứu kế hoạch tuần 10 |
| Phiên bản | 1.0 – 13/11/2026 |

## 1. Mô tả ngắn

Mọi thao tác quan trọng được hệ thống tự ghi vào audit log. Audit ghi cùng giao dịch với thao tác nên không có thao tác nào
thành công mà thiếu log. Audit chỉ được thêm, database chặn mọi lệnh sửa, xóa. HR và ADMIN tra cứu audit theo đối tượng,
người thực hiện và khoảng thời gian, để trả lời câu hỏi "ai đã làm gì, lúc nào". UC7 gồm hai phần: phần ghi (tự động) và phần
tra cứu (người dùng).

## 2. Tác nhân và quyền

| Tác nhân | Được làm gì | Giới hạn theo dữ liệu |
|---|---|---|
| HR | Tra cứu audit | Không sửa, không xóa |
| ADMIN | Tra cứu audit | Như HR. Threat model đề xuất xem xét giới hạn thêm (T-09) |
| Nhân viên, quản lý | Không truy cập | – |
| Hệ thống (các module) | Ghi audit qua `AuditService` trong cùng giao dịch | Không ghi giá trị nhạy cảm, lý do sức khỏe |

**Các thao tác được ghi (FR-7.1):**

| Module | Hành động (`action`) | Khi nào |
|---|---|---|
| Employee | `CREATE`, `UPDATE` | Tạo, sửa hồ sơ. Trường tổ chức ghi giá trị cũ và mới; trường cá nhân và nhạy cảm chỉ ghi tên ([UC1 mục 3](../UC1-employee-profile/spec.md#3-điều-kiện)) |
| Employee | `VIEW_SENSITIVE` | HR xem CCCD, số tài khoản, lương |
| Organization | `CREATE`, `UPDATE` (`entityType = department`) | Tạo, sửa phòng ban |
| Leave (`entityType = leave_request`) | `LEAVE_SUBMIT`, `LEAVE_APPROVE`, `LEAVE_REJECT`, `LEAVE_CANCEL`, `LEAVE_COMPLETE` | Mọi bước của đơn nghỉ. Ghi loại phép, ngày, số ngày, trạng thái trước và sau; **không** ghi lý do và ghi chú tự do (BR-14) |
| Document | `DOCUMENT_CREATE`, `DOCUMENT_PUBLISH`, `DOCUMENT_UPDATE`, `DOCUMENT_HIDE`, `DOCUMENT_RESTORE` | Thao tác quản lý kho tài liệu |

Mỗi bản ghi có:
- người thực hiện;
- hành động;
- loại và ID đối tượng;
- thời điểm;
- `traceId` của request;
- danh sách trường đã đổi.

## 3. Điều kiện

- **Điều kiện trước:** HR hoặc ADMIN đã đăng nhập.
- **Kích hoạt:**
  - Phần ghi: bất kỳ thao tác nào trong bảng trên.
  - Phần tra cứu: HR, ADMIN mở trang "Lịch sử thao tác".
- **Điều kiện sau khi thành công:** tra cứu không thay đổi dữ liệu.
- **Điều kiện sau khi thất bại:** thao tác nghiệp vụ lỗi thì audit cũng không được ghi (cùng giao dịch).

## 4. Luồng chính: HR tra cứu ai đã xem lương của một nhân viên

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | HR mở "Lịch sử thao tác", chọn đối tượng `employee`, nhập ID nhân viên, chọn khoảng thời gian | |
| 2 | Bấm Tìm | Gọi `GET /audit-logs?entity=employee&entityId=…&from=…&to=…&page=&size=` |
| 3 | | Kiểm vai trò HR hoặc ADMIN; lọc theo điều kiện; mới nhất trước; phân trang |
| 4 | Xem danh sách: lúc nào, ai, hành động gì (ví dụ `VIEW_SENSITIVE`), `traceId` | Trả danh sách |
| 5 | Lấy `traceId` để đối chiếu log hệ thống nếu cần | |

## 5. Luồng thay thế

- **A1 (bước 1), tìm theo người thực hiện:** lọc `actor` để xem một người đã làm những gì.
- **A2 (bước 1), tìm theo đơn nghỉ:** `entity = leave_request` và ID đơn, để xem toàn bộ các bước của một đơn.
- **A3, phần ghi khi thao tác thất bại:** giao dịch bị hủy, không có bản ghi audit, không có thay đổi dữ liệu.

## 6. Ngoại lệ

| Mã | Tình huống | Hệ thống phản hồi |
|---|---|---|
| E1 | Nhân viên, quản lý gọi `GET /audit-logs` | 403 `FORBIDDEN` |
| E2 | Ngày sai định dạng | 400 `BAD_REQUEST` |
| E3 | Bất kỳ ai, kể cả ứng dụng, chạy UPDATE hoặc DELETE trên bảng audit | Database trigger chặn, giao dịch lỗi (FR-7.2) |
| E4 | `size` lớn hơn 100 | 400 `BAD_REQUEST` |

## 7. Quy tắc áp dụng

- [ADR-09](../../architecture/adr/ADR-09-append-only-audit.md): append-only, trigger chặn sửa, xóa, ghi cùng giao dịch.
- [ADR-08](../../architecture/adr/ADR-08-field-encryption.md): audit ghi tên trường nhạy cảm, không ghi giá trị.
- BR-13: giữ audit 5 năm kể từ lúc ghi, có legal hold. SRS mục 8 còn câu hỏi về thời gian lưu (đề xuất 2 năm ở NFR-6.3); cần thống
  nhất với BR-13.
- BR-14: không đưa lý do sức khỏe vào audit.

## 8. Dữ liệu vào

| Trường | Bắt buộc | Kiểm tra |
|---|---|---|
| `entity` | Không | Đúng một trong `employee`, `department`, `leave_request`, `document` (so khớp chính xác, giá trị khác trả rỗng) |
| `entityId` | Không | ID đối tượng |
| `actor` | Không | UUID hồ sơ nhân viên của người thực hiện (không phải ID tài khoản) |
| `from`, `to` | Không | Ngày `YYYY-MM-DD` hoặc ngày giờ ISO 8601. Cả hai tính cả mốc: `to=2026-11-01` lấy hết ngày 1/11 (giờ Việt Nam) |
| `page`, `size` | Không | `size` tối đa 100 |

## 9. Giao diện và API

| Luồng | Màn hình | API |
|---|---|---|
| Tra cứu | Chưa có (nhánh `feat/audit-ui`, tuần 10) | `GET /audit-logs` |
| Ghi | Không có màn hình | `AuditService.record` gọi trong cùng giao dịch của từng module |

## 10. Yêu cầu phi chức năng liên quan

- NFR-6.1 → NFR-6.4: audit đủ, không sửa được, thời gian lưu, `traceId`.
- NFR-2.4: tra cứu theo đối tượng hoặc thời gian p95 < 1 s với 3 năm dữ liệu (~3,75 triệu bản ghi).
- NFR-5.10: chưa ghi đăng nhập và cấp, thu hồi vai trò (kế hoạch, T-03).

## 11. Kiểm thử

Chiến lược, test đã có, bảng phủ tiêu chí và ca còn thiếu: [test.md](test.md). Cách triển khai: [deploy.md](deploy.md).

## 12. Hiện trạng và việc còn lại

| Nội dung | Trạng thái | Việc còn lại |
|---|---|---|
| Ghi audit cùng giao dịch, chặn sửa xóa | Đã có | – |
| API tra cứu | Đã có | – |
| Màn hình tra cứu | Chưa có | TV1, nhánh `feat/audit-ui` (tuần 10) |
| Audit đăng nhập, cấp và thu hồi vai trò | Chưa có | NFR-5.10, kế hoạch sau tuần 11 |
| Thời gian lưu, archive | Chưa có | Thống nhất BR-13 (5 năm) với NFR-6.3 (2 năm đề xuất) |
| `to` tính cả ngày kết thúc | Code chưa đúng: `to` không tính mốc, `to=2026-11-01` bỏ mất ngày 1/11 | TV1, cùng `feat/audit-ui` |

## 13. Thiết kế đề xuất cho phần chưa có: màn hình tra cứu

> Đề xuất để có chỗ bám khi code. TV1 chốt trong PR `feat/audit-ui`. API đã có, không cần đổi.

- **Route** `/audit`, chỉ hiện trong menu với HR, ADMIN.
- **Bộ lọc:** loại đối tượng (chọn trong 4 giá trị), ID đối tượng, người thực hiện (ô tìm theo danh bạ, gửi UUID hồ sơ), từ
  ngày, đến ngày (tính cả hai ngày).
- **Bảng:** thời điểm (giờ Việt Nam), người thực hiện (tên), hành động, đối tượng (link tới hồ sơ, đơn, tài liệu nếu người xem có
  quyền), `traceId` (nút sao chép), nút mở `changedFields`.
- **Mở nhanh:** trang hồ sơ nhân viên và chi tiết đơn của HR có link "Lịch sử thao tác" mở `/audit` với bộ lọc điền sẵn.
- Không có nút sửa, xóa. Không có xuất file, để audit không thành đường lộ dữ liệu (BR-14).
