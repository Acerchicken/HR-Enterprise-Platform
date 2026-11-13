# Mã lỗi API – HRHelper (HR Enterprise Platform)

Dùng cho frontend (hiện lỗi đúng chỗ) và kiểm thử (TV4 viết ca kiểm thử theo `status` + `code` + `message`). Nguồn:
`backend/src/common/api-error.filter.ts` (`ApiErrorFilter`), `backend/src/bootstrap.ts` (`validationError`) và các
`throw new ...Exception(...)` trong `backend/src/modules/`. Endpoint nào trả lỗi nào: xem [`openapi.yaml`](../openapi.yaml)
hoặc Swagger (`/api/docs`).

| Phiên bản | Ngày | Người viết | Nội dung |
|---|---|---|---|
| 1.0 | 13/11/2026 | TV1 Duong | Bản đầu, theo code `dev` ngày 13/11/2026 |

## 1. Format lỗi

Mọi lỗi (trừ lỗi mạng) trả cùng một dạng JSON:

```json
{
  "code": "CONFLICT",
  "message": "Đơn đã được người khác cập nhật, hãy tải lại",
  "traceId": "3f2a9c1e-7d4b-4e8a-9b1c-5e6f7a8b9c0d"
}
```

| Trường | Kiểu | Luôn có | Ý nghĩa |
|---|---|---|---|
| `code` | string | Có | Mã lỗi máy đọc, suy ra từ HTTP status ([mục 2](#2-bảng-mã-lỗi)). Frontend rẽ nhánh theo `code`, không theo `message` |
| `message` | string hoặc string[] | Có | Câu tiếng Việt cho người dùng. Lỗi validation là **mảng** các câu |
| `fields` | object `{ tênTrường: lỗi }` | Chỉ lỗi validation | Lỗi đầu tiên của mỗi trường, để form hiện lỗi đúng ô. Trường lồng nhau viết `cha.con` |
| `traceId` | string | Có | Trùng header `X-Trace-Id` của response và log server. Gửi kèm khi báo lỗi để tra log |

Client có thể gửi header `X-Trace-Id` (tối đa 64 ký tự) để tự đặt mã; không gửi thì server sinh uuid.

## 2. Bảng mã lỗi

| HTTP | `code` | Khi nào | Frontend nên làm |
|---|---|---|---|
| 400 | `BAD_REQUEST` | Dữ liệu sai: validation DTO, vi phạm business rule, tham chiếu không tồn tại | Hiện `message`; có `fields` thì gắn lỗi vào từng ô |
| 401 | `UNAUTHENTICATED` | Không có token, token sai/hết hạn, token không cấp cho ứng dụng này | Đăng nhập lại (làm mới token) |
| 403 | `FORBIDDEN` | Đã đăng nhập nhưng không đủ quyền (theo role hoặc theo dữ liệu) | Hiện "không có quyền", không thử lại |
| 404 | `NOT_FOUND` | Không có đối tượng, hoặc đường dẫn API không tồn tại | Hiện "không tìm thấy" |
| 409 | `CONFLICT` | Xung đột: optimistic locking (`version` cũ), trùng dữ liệu unique, trạng thái không cho phép, trùng lịch | Với lỗi `version`: tải lại dữ liệu rồi cho người dùng làm lại |
| 422 | `UNPROCESSABLE` | Khai báo sẵn, **hiện chưa endpoint nào dùng** | – |
| 500 | `INTERNAL` | Lỗi không lường trước; `message` luôn là `Lỗi hệ thống` (không lộ chi tiết) | Hiện lỗi chung kèm `traceId` |
| 503 | `HTTP_503` | Kho tài liệu chưa cấu hình (`STORAGE_BUCKET` trống) | Hiện "chức năng chưa sẵn sàng" |

Status không có trong bảng ánh xạ sẽ có `code` dạng `HTTP_<status>` (như 503 ở trên).

## 3. Lỗi theo module

Cột "Message" là câu chính xác server trả (phần `<...>` thay bằng giá trị thật). Kiểm thử có thể so khớp nguyên câu.

### Xác thực và phân quyền (`identity`)

| HTTP | Message | Nguyên nhân |
|---|---|---|
| 401 | `Thiếu Bearer token` | Không có header `Authorization: Bearer ...` |
| 401 | `Token không hợp lệ hoặc đã hết hạn` | Sai chữ ký, sai issuer, hết hạn |
| 401 | `Chỉ chấp nhận access token` | Gửi ID token thay vì access token |
| 401 | `Token không cấp cho ứng dụng này` | Client id không nằm trong `OIDC_ALLOWED_CLIENTS` |
| 401 | `Token thiếu sub` / `Token thiếu email` | Token thiếu claim cần thiết |
| 401 | `Không lấy được email từ IdP` / `Userinfo không khớp token` | Lỗi khi gọi userinfo (Cognito) |
| 401 | `Email đã gắn với một tài khoản khác` | Email đã liên kết với một `sub` khác |
| 401 | `Token dev phải có dạng dev:<email>` | Chỉ ở `AUTH_MODE=dev` |
| 403 | `Không đủ quyền` | Role không nằm trong `@Roles(...)` của endpoint |

### Nhân viên (`employee`)

| HTTP | Message | Nguyên nhân |
|---|---|---|
| 400 | `Phòng ban không tồn tại` / `Chức danh không tồn tại` | `departmentId` / `positionId` sai |
| 400 | `Quản lý không tồn tại` | `managerId` sai |
| 400 | `Quản lý trực tiếp đã nghỉ việc` | Quản lý có trạng thái `TERMINATED` |
| 400 | `Nhân viên không thể tự quản lý mình` | `managerId` bằng chính nhân viên |
| 400 | `Gán quản lý này sẽ tạo vòng lặp trong sơ đồ tổ chức` | A quản lý B, B lại quản lý A (trực tiếp hoặc gián tiếp) |
| 400 | `Nhân viên phải có quản lý trực tiếp (chỉ CEO được để trống)` | Bỏ trống `managerId` khi không phải CEO |
| 400 | `CEO không có quản lý trực tiếp` / `Đã có một CEO, không thể có CEO thứ hai` | Quy tắc CEO |
| 403 | `Chỉ HR được xem trường nhạy cảm` | `?include=sensitive` khi không phải HR |
| 403 | `Không được sửa: <danh sách trường>` | Nhân viên sửa trường ngoài `phone`, `address` |
| 404 | `Không tìm thấy nhân viên` | |
| 404 | `Không tìm thấy phòng ban` | `/departments/{id}/members` |
| 409 | `Hồ sơ đã được người khác cập nhật, hãy tải lại` | `version` gửi lên đã cũ |
| 409 | `Dữ liệu bị trùng` | Trùng `employee_code` hoặc `work_email` |

### Tổ chức (`organization`)

| HTTP | Message | Nguyên nhân |
|---|---|---|
| 400 | `Không thể đặt phòng ban cha là chính nó hoặc phòng ban con của nó` | Tạo vòng trong cây phòng ban |
| 404 | `Không tìm thấy phòng ban` | |
| 409 | `Dữ liệu bị trùng` | Trùng `code` phòng ban |

### Nghỉ phép (`leave`)

| HTTP | Message | Nguyên nhân |
|---|---|---|
| 400 | `Thiếu header Idempotency-Key (tối đa 100 ký tự)` | Tạo đơn không có header |
| 400 | `Loại phép không tồn tại` | `leaveType` sai mã |
| 400 | `Ngày không hợp lệ` | Ngày không đúng dạng `YYYY-MM-DD` |
| 400 | `Ngày kết thúc phải sau hoặc bằng ngày bắt đầu` | |
| 400 | `Đơn phải nằm trong cùng một năm, hãy tách thành hai đơn` | Khoảng nghỉ qua năm mới |
| 400 | `Nghỉ nửa ngày chỉ áp dụng cho một ngày` | `halfDay` với đơn nhiều ngày (BR-04) |
| 400 | `Khoảng nghỉ không có ngày làm việc nào (cuối tuần hoặc ngày lễ)` | Toàn cuối tuần/lễ (BR-03) |
| 400 | `Không đủ số dư: cần <n> ngày, còn <m> ngày` | Vượt số dư |
| 403 | `Không có quyền <approve/reject/cancel/complete> đơn này` | Không phải quản lý trực tiếp / chủ đơn / HR theo state machine |
| 403 | `Không có quyền xem đơn này` | Xem đơn của người khác |
| 404 | `Không tìm thấy đơn nghỉ phép` | |
| 404 | `Tài khoản chưa gắn với nhân viên` | Tài khoản (ví dụ admin) không có hồ sơ nhân viên |
| 409 | `Trùng lịch với đơn <từ> – <đến> đang <trạng thái>` | Chồng ngày với đơn `SUBMITTED`/`APPROVED` |
| 409 | `Đơn đang ở trạng thái <X>, không thể <hành động>` | Chuyển trạng thái không hợp lệ |
| 409 | `Đơn đã được người khác cập nhật, hãy tải lại` | `version` cũ |
| 409 | `Idempotency-Key đã được dùng cho một đơn khác` | Cùng key nhưng nội dung đơn khác. Gửi lại **đúng** đơn cũ thì nhận lại đơn đã tạo, không lỗi |

Gửi lại cùng một quyết định (duyệt đơn đã duyệt) không lỗi: trả về đơn như cũ.

### Kho tài liệu (`document`)

| HTTP | Message | Nguyên nhân |
|---|---|---|
| 400 | `Chỉ nhận file PDF hoặc DOCX` | Phần mở rộng khác |
| 400 | `Loại file không khớp phần mở rộng` | `contentType` không khớp đuôi file |
| 400 | `File phải từ 1 byte đến 20 MiB` | Khai báo dung lượng sai |
| 400 | `Chưa có file trên kho, hãy tải file lên trước khi xác nhận` | Xác nhận khi chưa upload |
| 400 | `Dung lượng file không khớp khai báo hoặc vượt 20 MiB` | File thật khác khai báo; phiên bản chuyển `REJECTED` |
| 400 | `Nội dung file không đúng định dạng PDF/DOCX` | Kiểm tra magic bytes thất bại; phiên bản chuyển `REJECTED` |
| 400 | `Tài liệu phải có ít nhất một phạm vi xem` | Không chọn toàn công ty, phòng ban hay role |
| 400 | `Phòng ban không tồn tại` | Phạm vi trỏ tới phòng ban sai |
| 404 | `Không tìm thấy tài liệu` / `Không tìm thấy phiên bản` | Kể cả khi không có quyền xem (không lộ sự tồn tại) |
| 409 | `Phiên bản này đã bị từ chối, hãy tạo phiên bản mới` | Xác nhận phiên bản `REJECTED` |
| 409 | `Tài liệu đã được người khác cập nhật, hãy tải lại` | `version` cũ |
| 503 | `Kho tài liệu chưa được cấu hình (STORAGE_BUCKET)` | Thiếu cấu hình storage |

### Lỗi chung

| HTTP | Message | Nguyên nhân |
|---|---|---|
| 400 | Mảng câu từ class-validator, kèm `fields` | Body/query sai kiểu, thiếu trường, thừa trường lạ (`forbidNonWhitelisted`) |
| 400 | `Validation failed (uuid is expected)` | Tham số đường dẫn không phải uuid |
| 404 | `Cannot <METHOD> <path>` | Sai đường dẫn API |
| 409 | `Dữ liệu bị trùng` | Mọi vi phạm unique ở database (PostgreSQL `23505`) |
| 500 | `Lỗi hệ thống` | Mọi lỗi khác; chi tiết chỉ có trong log server, tra theo `traceId` |

Ví dụ lỗi validation:

```json
{
  "code": "BAD_REQUEST",
  "message": ["workEmail must be an email", "hireDate must be a valid ISO 8601 date string"],
  "fields": { "workEmail": "workEmail must be an email", "hireDate": "hireDate must be a valid ISO 8601 date string" },
  "traceId": "..."
}
```

Câu lỗi validation là tiếng Anh mặc định của class-validator, trừ các trường đã đặt câu riêng trong DTO (ví dụ
`Số điện thoại không hợp lệ`, `CCCD phải gồm 12 chữ số`, `Mã nhân viên dạng E00001`).

## 4. Lưu ý cho kiểm thử

- Vi phạm ràng buộc `CHECK` hoặc foreign key ở database (ví dụ số dư âm) trả **500** `INTERNAL`, không phải 400. Code kiểm
  tra trước nên bình thường không xảy ra; gặp 500 kiểu này là lỗi cần báo.
- 404 thay cho 403 ở kho tài liệu là cố ý (không cho biết tài liệu tồn tại).
- Nên so khớp `status` + `code`, và `message` khi ca kiểm thử cần phân biệt nguyên nhân.

**Khi thêm lỗi mới:** dùng exception chuẩn của NestJS ([CONVENTIONS mục 4](../CONVENTIONS.md#4-api)), message tiếng Việt
cho người dùng, và thêm một dòng vào mục 3 trong cùng PR.
