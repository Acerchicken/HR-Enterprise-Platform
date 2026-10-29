# Bản nháp đối chiếu UC1, UC2 — code tuần 7 và FR tuần 5

> Bản nháp cục bộ để rà soát nội dung. Chưa tạo GitHub Issue, chưa commit và chưa push.

## Phạm vi

Đối chiếu functional requirements trong `docs/progress/tuan-05/TV2_Thanh.md` với code tuần 7 ở module Employee, Organization, Identity và migration `backend/src/database/migrations/1729900000000-InitSchemas.ts`.

## Tóm tắt

- **UC1:** Các quy tắc phân quyền sửa và trường nhạy cảm nhìn chung được triển khai. Một số quyền xem và hành vi bổ sung trong code chưa được mô tả cụ thể trong FR; cần quyết định có cập nhật FR hay không.
- **UC2:** Có hai điểm lệch trực tiếp đáng xem xét: tìm cây theo mã phòng ban chưa có; `managerId` có thể để trống dù FR yêu cầu mỗi nhân viên có đúng một quản lý trực tiếp.
- Các mục về quản lý đã nghỉ việc, trưởng phòng, version và xử lý `null` là đề xuất làm rõ hoặc kiểm thử thêm; không nên ghi tất cả là lỗi FR đã xác nhận.

## Bảng đối chiếu

| Mã | Yêu cầu FR tuần 5 | Hiện trạng code tuần 7 | Kết luận |
|---|---|---|---|
| UC1.1 | Employee, HR xem hồ sơ | `GET employees/:id` yêu cầu đăng nhập qua `AuthGuard`; HR xem cấp HR, nhân viên xem hồ sơ mình, quản lý trực tiếp xem cấp PERSONAL, người khác (kể cả ADMIN) xem cấp PUBLIC. | Khớp phần xem hồ sơ cơ bản; quyền PERSONAL của quản lý trực tiếp là phần vượt FR, cần xác nhận có chủ ý không. |
| UC1.2 | Employee chỉ sửa trường liên hệ | `forbiddenFields` chỉ cho nhân viên sửa `phone`, `address` trên hồ sơ của mình; nhân viên không có `employeeId` không sửa được hồ sơ; HR được sửa. | Khớp. |
| UC1.3 — đọc | Trường nhạy cảm chỉ HR | `profile()` chỉ trả trường nhạy cảm cho HR; vai trò khác nhận 403. Mỗi lượt đọc trường nhạy cảm ghi audit `VIEW_SENSITIVE`. | Khớp; audit là hành vi bổ sung phù hợp. |
| UC1.3 — sửa | Trường nhạy cảm chỉ HR sửa | `nationalId`, `bankAccount`, `salary` không thuộc `SELF_EDITABLE`; chỉ HR vượt qua kiểm tra quyền. Giá trị được mã hóa, audit chỉ ghi dấu che thay vì giá trị. | Khớp. |
| UC1.4 | Trả hồ sơ đã cập nhật | `update()` trả lại hồ sơ sau cập nhật qua `profile(id, actor, false)`. | Khớp. |
| UC2.1 | Mọi vai trò xem phòng ban, sơ đồ và quản lý trực tiếp | Các endpoint đọc không gắn `@Roles`; `AuthGuard` toàn cục vẫn yêu cầu đăng nhập. Có API danh sách/cây phòng ban, chức danh, danh bạ, quản lý trực tiếp và cấp dưới. | Khớp nếu “mọi vai trò” nghĩa là mọi người dùng đã đăng nhập. Không phải endpoint công khai. |
| UC2.2 | Nhập mã phòng ban, nhận cây tổ chức | `GET departments/tree` không nhận mã và trả toàn bộ cây; `GET departments/:id` và `/members` nhận UUID. `department.code` unique nhưng chưa có endpoint tra cây theo code. | Lệch nếu FR bắt buộc input là mã phòng ban; cần chọn bổ sung tra cứu theo code hoặc sửa FR để nói rõ trả toàn bộ cây. |
| UC2.3 | Mỗi nhân viên có đúng một quản lý trực tiếp | `manager_id` nullable ở entity và migration; `CreateEmployeeDto.managerId` tùy chọn; create lưu `null` nếu thiếu. Update nhận `managerId: null`; `assertNoManagerCycle()` chỉ chạy khi giá trị managerId truthy, nên HR có thể gỡ quản lý. Code có chặn tự quản lý và vòng lặp khi gán managerId khác null. | Lệch trực tiếp; cần thống nhất ngoại lệ cho người đứng đầu và mô hình duyệt đơn của người đó. |

## Các điểm kỹ thuật đã xác nhận

- Migration có FK tự tham chiếu cho `employee.manager_id` và chặn `manager_id = id`, nhưng cho phép `NULL`.
- `department_id` và `position_id` không có FK trong migration; theo quy ước modular monolith, đây là liên kết chéo schema nên cần kiểm tra ở service.
- `org.department.parent_id` có FK tự tham chiếu. `head_employee_id` không có FK trong migration được đọc.
- `hasDirectReports()` hiện được Identity dùng để suy ra role `MANAGER`; chưa được dùng để chặn gán quản lý đã nghỉ hoặc chuyển nhân viên có cấp dưới sang `TERMINATED`.
- `@IsOptional()` trong DTO bỏ qua cả `null`. Với các trường cập nhật không cho null, cần kiểm tra validation/service và response thực tế trước khi khẳng định lỗi HTTP.
- `UpdateEmployeeDto.version` là tùy chọn; service chỉ so version khi client gửi. Quy ước repo nói bản ghi quan trọng dùng optimistic locking, lệch version trả 409.
- `ApiErrorFilter` ánh xạ lỗi unique constraint `23505` sang 409; lỗi database constraint khác chưa có ánh xạ riêng và có thể thành 500.
- Lỗi ngoặc trong bản ghi chép/dán controller không xuất hiện trong controller hiện có trong repo; không đưa thành issue nếu chưa xác minh lại bằng file thật.

## Bản nháp issue UC2.3 — điểm lệch nghiệp vụ đã xác nhận

**Tiêu đề:** `[UC2] Làm rõ và thực thi quy tắc quản lý trực tiếp`

```markdown
## Use case
UC2 – Organizational info.
Yêu cầu nguồn: `docs/progress/tuan-05/TV2_Thanh.md`.

## Yêu cầu nghiệp vụ
Functional requirements tuần 5 ghi: “Mỗi nhân viên có đúng 1 quản lý trực tiếp”.

## Điểm lệch trong code tuần 7
- Cột `employee.employee.manager_id` trong entity và migration cho phép `NULL`.
- `CreateEmployeeDto.managerId` là tùy chọn; `EmployeeService.create()` lưu `managerId = null` nếu không gửi.
- `UpdateEmployeeDto.managerId` cho phép `null`.
- Trong `update()`, `assertNoManagerCycle()` chỉ chạy khi `dto.managerId` có giá trị. Vì vậy, `PATCH` với `managerId: null` bỏ qua bước kiểm tra quản lý và cho phép HR gỡ quản lý trực tiếp.
- Code đã chặn tự quản lý và vòng lặp khi gán quản lý khác null.

## Ảnh hưởng
Quan hệ quản lý trực tiếp được dùng để xác định người duyệt `DIRECT_MANAGER`. Nhân viên không có quản lý có thể không có người duyệt hợp lệ cho đơn nghỉ (UC4, BR-06).

## Cần thống nhất mô hình nghiệp vụ
Với cây quản lý tự tham chiếu hiện tại, cần quyết định cách biểu diễn người đứng đầu:

1. Cho phép đúng một người đứng đầu không có quản lý. Khi đó cần chặn tạo bản ghi gốc thứ hai. Cần xác định người đứng đầu đã `TERMINATED` có còn được tính là bản ghi gốc không; nếu không, cần cho phép bổ nhiệm người đứng đầu mới mà vẫn giữ hồ sơ người cũ.
2. Nếu không cho phép bản ghi gốc, cần thiết kế cách biểu diễn quản lý của người đứng đầu ngoài cây nhân viên hiện tại. Chỉ thêm `NOT NULL` cho `manager_id` không đủ để giải quyết nếu vẫn phải tránh vòng lặp.

Dù chọn phương án nào, cần quy định ai duyệt đơn nghỉ của người đứng đầu. Có thể cân nhắc người duyệt thay do HR ghi nhận theo BR-06, nhưng cần xác nhận nghiệp vụ và quyền tương ứng.

## Tiêu chí hoàn tất
- Functional requirement và code thống nhất về ngoại lệ cho người đứng đầu.
- Nếu có ngoại lệ: đúng một bản ghi gốc là hợp lệ; tạo thiếu quản lý khi đã có người đứng đầu bị từ chối; có quy tắc xử lý bản ghi gốc `TERMINATED`; và xác định người duyệt đơn nghỉ của người đứng đầu.
- Nếu không có ngoại lệ: mô hình quản lý được điều chỉnh để người đứng đầu có quản lý hợp lệ mà không tạo vòng lặp; migration, seed và validation tuân theo mô hình mới.
- Có test cho tạo nhân viên thiếu quản lý (bao gồm trường hợp đã có người đứng đầu), `PATCH managerId: null`, và các trường hợp người đứng đầu đã thống nhất.
```

## Các issue/điểm làm rõ khác có thể tách riêng

### UC2.2 — Tra cây tổ chức theo mã phòng ban

**Tiêu đề gợi ý:** `[UC2] Làm rõ input mã phòng ban khi tra sơ đồ tổ chức`

FR ghi input là “Mã phòng ban”, nhưng endpoint cây hiện trả toàn bộ cây, không nhận code. Cần thống nhất:

- Bổ sung endpoint/parameter tìm cây con theo `department.code`; hoặc
- Sửa FR để mô tả thao tác xem toàn bộ cây và phân biệt chức năng lọc phòng ban.

### UC2 — Trạng thái của quản lý trực tiếp

Code cho phép gán nhân viên `TERMINATED` làm quản lý và chưa chặn việc chấm dứt nhân viên còn cấp dưới. Đây là quy tắc chưa được nêu trực tiếp trong FR; cần xác nhận business rule trước khi ghi nhận thành bug. Nếu thống nhất quản lý phải đang làm việc, cần chặn gán quản lý không phù hợp và yêu cầu chuyển cấp dưới trước khi chấm dứt.

### UC2 — Ý nghĩa `headEmployeeId`

`headEmployeeId` và `managerId` là hai trường riêng; service hiện chưa kiểm tra nhân viên trưởng đơn vị có tồn tại/đang làm việc/thuộc đơn vị hay quan hệ này có phải quản lý trực tiếp hay không. Cần xác nhận `headEmployeeId` chỉ biểu thị trưởng phòng và `managerId` mới là nguồn chuẩn của quản lý trực tiếp. Migration được đọc không khai báo FK cho `head_employee_id`.

### UC1/UC2 — Null trong PATCH

`@IsOptional()` bỏ qua `null` cho cả trường nullable và không nullable. Cần kiểm thử PATCH với `null` trên các trường bắt buộc như `fullName`, `departmentId`, `positionId`, `status`, `name`, `office`, rồi xác nhận response và bổ sung validation nếu cần. Không kết luận mã lỗi trước khi chạy test.

### UC1 — Version trong PATCH

`version` được mô tả là optimistic locking nhưng DTO cho phép bỏ qua; service chỉ so khi có version. Đây là điểm cần đối chiếu với quy ước “cập nhật bản ghi quan trọng dùng version” và thống nhất bắt buộc hay tùy chọn. Không phải business rule được nêu trực tiếp trong FR tuần 5.

### UC1 — Phạm vi FR còn thiếu chi tiết

Code hiện cho quản lý trực tiếp xem thêm dữ liệu cá nhân; ADMIN không có quyền HR; HR đọc trường nhạy cảm theo yêu cầu và mỗi lần đọc đều audit; HR có thể cập nhật mọi trường, bao gồm hồ sơ của chính HR; `employeeCode`, `workEmail`, `hireDate` không sửa qua PATCH; nhân viên `TERMINATED` bị ẩn khỏi danh bạ. Cần quyết định mục nào là chủ ý thiết kế và cập nhật FR tương ứng; không gộp tất cả thành một lỗi code.

## Không đưa vào issue nếu chưa xác minh

- Chưa có kết quả chạy thử lỗi database khi gửi `null`; mô tả HTTP 500 mới là khả năng suy ra từ error filter.
- Không kết luận `headEmployeeId` vi phạm rule quản lý trực tiếp trước khi chốt ý nghĩa nghiệp vụ của trường này.
- Không ghi lỗi cú pháp/ngoặc của controller từ bản sao chép; file controller trong repo đã kiểm tra không có lỗi đó.
