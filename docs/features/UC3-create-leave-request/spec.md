# UC3 – Tạo đơn nghỉ

| Mục | Nội dung |
|---|---|
| Mục tiêu kinh doanh | MT-2 (duyệt đơn nghỉ dưới 1 ngày làm việc) |
| Tác nhân chính | Nhân viên (chủ đơn) |
| Tác nhân phụ, hệ thống ngoài | Quản lý trực tiếp (nhận email); HR, quản lý trực tiếp (tạo đơn hộ, BR-12); queue và dịch vụ email |
| Yêu cầu (SRS) | FR-3.1 → FR-3.7 |
| Quy tắc | [BR-01 → BR-04, BR-07, BR-08, BR-11 → BR-15](../../business/leave-rules.md), [loại phép, ngày lễ](../../business/leave-types-holidays.md), ADR-03 |
| Mức ưu tiên | M (FR-3.7 là S) |
| Trạng thái | Đã có; tạo đơn hộ (FR-3.7) kế hoạch tuần 10 |
| Phiên bản | 1.0 – 13/11/2026 |

## 1. Mô tả ngắn

Nhân viên xem số dư phép, tạo đơn nghỉ theo ngày hoặc nửa ngày, theo dõi và tự hủy đơn khi chưa có quyết định. Hệ thống tính
số ngày theo ngày làm việc (bỏ cuối tuần và ngày lễ), kiểm số dư, chặn trùng lịch, giữ chỗ số ngày và báo quản lý trực tiếp
qua email. Gửi lại do mạng lỗi không tạo đơn thứ hai.

## 2. Tác nhân và quyền

| Tác nhân | Được làm gì | Giới hạn theo dữ liệu |
|---|---|---|
| Nhân viên (mọi vai trò có hồ sơ) | Xem số dư, tạo đơn cho mình, xem đơn của mình, hủy đơn `SUBMITTED` của mình | Chỉ đơn và số dư của chính mình |
| Quản lý trực tiếp | Tạo đơn hộ cấp dưới trực tiếp (FR-3.7, chưa có) | Không tính quan hệ chỉ được giao duyệt thay (BR-06) |
| HR | Tạo đơn hộ mọi nhân viên (FR-3.7, chưa có) | Đơn vẫn qua người duyệt hợp lệ |

## 3. Điều kiện

- **Điều kiện trước:**
  - Người dùng đã đăng nhập, tài khoản gắn với hồ sơ đang làm việc.
  - Số dư: seed cấp số dư năm cho mọi nhân viên. Loại phép chưa có dòng số dư của năm (nhân viên mới, nghỉ cưới…) được tự
    tạo khi tạo đơn, với số ngày được hưởng = `max_days_per_year` của loại phép (chưa tính theo tỉ lệ ngày vào làm).
  - Danh sách ngày lễ của năm đã có.
- **Kích hoạt:** nhân viên bấm "Tạo đơn nghỉ".
- **Điều kiện sau khi thành công:**
  - Đơn ở trạng thái `SUBMITTED`; số ngày của đơn được cộng vào `pending` của chủ đơn.
  - Có một dòng lịch sử (`null` → `SUBMITTED`) và audit `LEAVE_SUBMIT`.
  - Có event `LeaveRequested` trong outbox. Tất cả ghi trong **một giao dịch**.
  - Sau đó worker gửi email cho quản lý trực tiếp ([hợp đồng event](../../architecture/event-contract.md)).
- **Điều kiện sau khi thất bại:** không có đơn, số dư không đổi, không có event.

## 4. Luồng chính: tạo đơn

```mermaid
sequenceDiagram
  actor NV as Nhân viên
  participant W as Web
  participant API
  participant DB as Database
  participant Q as Queue + Worker
  NV->>W: Mở "Tạo đơn nghỉ"
  W->>API: GET /leave-balances/me, /leave-types, /leave-holidays
  NV->>W: Chọn loại phép, ngày, buổi, lý do; bấm Gửi
  W->>API: POST /leave-requests (Idempotency-Key)
  API->>DB: Giao dịch: khóa theo nhân viên, kiểm số dư, trùng lịch, ghi đơn + pending + lịch sử + audit + outbox
  API-->>W: 201 đơn SUBMITTED
  Q-->>NV: (sau vài giây) email cho quản lý trực tiếp
```

| Bước | Tác nhân | Hệ thống |
|---|---|---|
| 1 | Nhân viên mở "Tạo đơn nghỉ" | Hiện số dư từng loại phép: được hưởng, đã dùng, đang chờ, còn lại = được hưởng − đã dùng − đang chờ (FR-3.1) |
| 2 | Chọn loại phép, ngày bắt đầu, ngày kết thúc; nếu nghỉ nửa ngày thì chọn buổi sáng hoặc chiều (chỉ khi một ngày); nhập lý do (tùy chọn) | Kiểm định dạng ở form |
| 3 | Bấm Gửi | Gửi `POST /leave-requests` kèm header `Idempotency-Key` sinh mới cho mỗi lần mở form |
| 4 | | Nếu key đã dùng cho đơn trước của cùng nhân viên: trả lại đơn đó, không tạo mới (FR-3.5, BR-11) |
| 5 | | Mở giao dịch, khóa theo nhân viên để hai request song song không cùng vượt qua kiểm tra |
| 6 | | Tính số ngày: đếm ngày làm việc, bỏ thứ Bảy, Chủ nhật, ngày lễ và ngày nghỉ bù; nửa ngày tính 0,5 (BR-03, BR-04) |
| 7 | | Kiểm không trùng với đơn `SUBMITTED` hoặc `APPROVED` khác của chủ đơn; hai nửa ngày khác buổi không trùng (BR-02, BR-04) |
| 8 | | Kiểm số ngày ≤ số dư còn lại (BR-01) |
| 9 | | Ghi đơn `SUBMITTED`, cộng `pending`, ghi lịch sử, audit, event outbox |
| 10 | Thấy đơn mới trong "Đơn của tôi" | Trả 201 kèm đơn; worker gửi email cho quản lý trực tiếp |

## 5. Luồng thay thế

- **A1, nhân viên hủy đơn (FR-3.6):**
  1. Nhân viên mở đơn `SUBMITTED` của mình và bấm Hủy. Web gửi `POST /leave-requests/{id}/cancel` kèm `version`.
  2. Hệ thống chuyển đơn sang `CANCELLED` và trả số ngày khỏi `pending` (BR-07).
  3. Hệ thống ghi lịch sử, audit `LEAVE_CANCEL` và event `LeaveCancelled`, rồi email báo quản lý trực tiếp.
  4. Bấm hủy lần hai không đổi gì (BR-11).
- **A2, xem đơn của mình:** `GET /leave-requests/me`, lọc theo trạng thái, có phân trang. Mở chi tiết thì thấy lịch sử
  trạng thái (FR-4.7).
- **A3, HR hoặc quản lý tạo đơn hộ (FR-3.7, BR-12, chưa có):**
  1. Người tạo chọn nhân viên là chủ đơn. Hệ thống kiểm phạm vi: HR được chọn mọi nhân viên, quản lý chỉ chọn cấp dưới trực tiếp.
  2. Bước 4–9 của luồng chính áp dụng theo **chủ đơn**.
  3. Lịch sử và audit ghi riêng người tạo và chủ đơn. Chủ đơn nhận email và vẫn tự hủy được.
- **A4 (từ bước 2), nghỉ nửa ngày vào ngày nghỉ:** số ngày bằng 0, đi tới ngoại lệ E4.

## 6. Ngoại lệ

| Mã | Tình huống | Hệ thống phản hồi |
|---|---|---|
| E1 | Thiếu header `Idempotency-Key` hoặc dài quá 100 ký tự | 400 `BAD_REQUEST` |
| E2 | Ngày sai định dạng, ngày kết thúc trước ngày bắt đầu, nửa ngày nhưng hai ngày khác nhau, loại phép không tồn tại, lý do quá 500 ký tự | 400 `BAD_REQUEST` kèm `fields` |
| E3 | Không đủ số dư (BR-01) | 400 `BAD_REQUEST`, câu báo cần bao nhiêu ngày, còn bao nhiêu |
| E4 | Khoảng nghỉ có 0 ngày làm việc: chỉ cuối tuần, ngày lễ hoặc ngày nghỉ bù (BR-03) | 400 `BAD_REQUEST` |
| E5 | Trùng lịch với đơn đang chờ hoặc đã duyệt (BR-02) | 409 `CONFLICT`, nêu khoảng ngày của đơn bị trùng |
| E6 | Hủy đơn đã duyệt (BR-08) hoặc đã có quyết định khác | 409 `CONFLICT` |
| E7 | Hủy đơn của người khác | 403 `FORBIDDEN` |
| E8 | Hủy với `version` cũ | 409 `CONFLICT` |
| E9 | Tài khoản chưa gắn hồ sơ | 404 `NOT_FOUND` ("Tài khoản chưa gắn với nhân viên") |
| E10 | Khoảng nghỉ qua hai năm, ví dụ 30/12 – 2/1 | 400 `BAD_REQUEST`, yêu cầu tách thành hai đơn |
| E11 | Dùng lại `Idempotency-Key` cũ cho đơn khác (loại phép, ngày hoặc buổi khác) | 409 `CONFLICT` |

## 7. Quy tắc áp dụng

- [BR-01](../../business/leave-rules.md) số dư.
- BR-02 trùng lịch, BR-03 ngày làm việc và ngày lễ, BR-04 nửa ngày.
- BR-07 hủy đơn chờ, BR-08 không tự hủy đơn đã duyệt.
- BR-11 thao tác lặp, BR-12 tạo đơn hộ.
- BR-13 thời hạn lưu, BR-14 người xem lý do nghỉ ốm, BR-15 email không chứa chi tiết.
- Loại phép, số ngày được hưởng, ngày lễ 2026: [`leave-types-holidays.md`](../../business/leave-types-holidays.md).
- [ADR-03](../../architecture/adr/ADR-03-sync-workflow-async-notification.md): ghi đơn đồng bộ, email bất đồng bộ qua outbox.

## 8. Dữ liệu vào

| Trường | Bắt buộc | Kiểm tra |
|---|---|---|
| Header `Idempotency-Key` | Có | 1–100 ký tự; web sinh mới cho mỗi lần tạo |
| `leaveType` | Có | Mã loại phép, ví dụ `ANNUAL` (`GET /leave-types`) |
| `startDate`, `endDate` | Có | `YYYY-MM-DD`, `endDate` ≥ `startDate` |
| `halfDay` | Không | `AM` hoặc `PM`, chỉ khi `startDate = endDate` |
| `reason` | Không | Tối đa 500 ký tự; với nghỉ ốm, thai sản chỉ chủ đơn và HR được xem (BR-14) |
| `version` (khi hủy) | Có | Version hiện tại của đơn |

## 9. Giao diện và API

| Luồng | Màn hình | API |
|---|---|---|
| Chính | `/leave/new` | `GET /leave-balances/me`, `GET /leave-types`, `GET /leave-holidays`, `POST /leave-requests` |
| A1, A2 | `/leave`, `/leave/:id` | `GET /leave-requests/me`, `GET /leave-requests/{id}`, `POST /leave-requests/{id}/cancel` |
| A3 | Chưa có | Chưa có |

## 10. Yêu cầu phi chức năng liên quan

- NFR-1.2: tạo, hủy đơn p95 < 500 ms. NFR-1.4: email tới hộp thư p95 < 1 phút.
- NFR-3.4: queue hoặc email lỗi không chặn việc tạo đơn. NFR-4.3: đơn đã nhận 201 không bao giờ mất.
- NFR-5.18: email, log không chứa lý do nghỉ (BR-15).

## 11. Kiểm thử

Chiến lược, test đã có, bảng phủ tiêu chí và ca còn thiếu: [test.md](test.md). Cách triển khai: [deploy.md](deploy.md).

## 12. Hiện trạng và việc còn lại

| Nội dung | Trạng thái | Việc còn lại |
|---|---|---|
| Số dư, tạo đơn, ngày lễ, nửa ngày, trùng lịch, idempotency, hủy | Đã có | – |
| Tạo đơn hộ (FR-3.7, BR-12) | Chưa có | TV1, nhánh `feat/leave-delegation`, mức 3 tuần 10 |
| Email chỉ chứa thông báo chung (BR-15) | Chưa có: email còn tên, loại phép, ngày | TV1 sửa `buildEmail` và payload event |
| Ẩn lý do nghỉ ốm với quản lý (BR-14) | Chưa có | TV1 sửa response chi tiết, danh sách, lịch sử |
| Lưu trữ 5 năm, legal hold (BR-13) | Chưa có | Thiết kế sau MVP; ghi trong SRS mục 8 |

## 13. Thiết kế đề xuất cho phần chưa có

> Đề xuất để có chỗ bám khi code. TV1 chốt trong PR `feat/leave-delegation`; khác đề xuất thì sửa mục này trong cùng PR.

### 13.1 Tạo đơn hộ (FR-3.7, BR-12)

- **API:** dùng lại `POST /leave-requests`, thêm trường tùy chọn `employeeId` (chủ đơn). Không gửi thì chủ đơn là người gọi như hiện nay.
- **Kiểm quyền:** có `employeeId` khác người gọi thì người gọi phải là HR, hoặc là quản lý trực tiếp hiện tại của chủ đơn. Quan hệ
  duyệt thay (BR-06) không tính. Sai thì 403.
- **Dữ liệu:** thêm cột `leave_request.created_by` (người tạo, mặc định bằng chủ đơn). Lịch sử dòng đầu ghi `actorId` = người tạo.
  Audit `LEAVE_SUBMIT`: `actorId` = người tạo, `changedFields` thêm `onBehalfOf` = chủ đơn.
- **Khóa và idempotency:** khóa advisory theo **chủ đơn**; `Idempotency-Key` duy nhất theo (chủ đơn, key) như hiện tại.
- **Email:** event `LeaveRequested` gửi quản lý như thường, thêm một email báo chủ đơn "có đơn nghỉ được tạo cho bạn" (nội dung
  chung theo BR-15).
- **Giao diện:** `/leave/new` thêm ô "Tạo cho" chỉ hiện với HR (tìm mọi nhân viên) và quản lý (chọn trong cấp dưới trực tiếp).
  Số dư hiển thị là số dư của người được chọn: cần API `GET /leave-balances?employeeId=` cho HR và quản lý trực tiếp.
