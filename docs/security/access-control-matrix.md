# Ma trận phân quyền RBAC/ABAC

Ma trận mô tả quyền hiện tại của API trong `docs/openapi.yaml`, đối chiếu `@Roles(...)` ở controller và kiểm tra theo dữ
liệu trong service. Đây là hợp đồng nghiệp vụ để TV1 viết e2e test và TV4 viết ca kiểm thử; các điểm chưa được giới hạn ở
code được ghi riêng, không mặc nhiên kết luận đó là lỗi.

## Nguyên tắc và ký hiệu

- **Deny by default:** mọi API cần token Bearer hợp lệ qua `AuthGuard` toàn cục, trừ `GET /api/v1/health`. Endpoint không
  có `@Roles(...)` vẫn yêu cầu đăng nhập; điều kiện theo bản ghi được kiểm tra thêm trong service.
- **Hai lớp phân quyền:** RBAC chặn role ở controller; ABAC giới hạn bản ghi, trường và trạng thái ở service.
- `✓` = role được gọi endpoint; `—` = role không được gọi endpoint theo code hiện tại. Điều kiện ở cột cuối áp dụng cho
  mọi role có `✓`.
- Role là `EMPLOYEE`, `MANAGER`, `HR`, `ADMIN`. `MANAGER` chỉ xác định vai trò quản lý; không tự cấp quyền trên hồ sơ hay
  đơn của mọi nhân viên. Quyền theo quan hệ quản lý phải được kiểm tra riêng.
- `ADMIN` là vai trò quản trị kỹ thuật, không mặc nhiên được xem hồ sơ cá nhân của người khác, trường nhạy cảm hoặc đơn
  nghỉ phép. Nếu tài khoản có `employeeId`, quyền xem/sửa hồ sơ của chính mình vẫn áp dụng như các role khác. Các endpoint
  danh bạ và tổ chức đọc được đánh dấu theo đúng hành vi hiện có.

## Ma trận

### Health

| Tài nguyên | Thao tác | API | EMPLOYEE | MANAGER | HR | ADMIN | Điều kiện theo dữ liệu | Nguồn |
|---|---|---|---:|---:|---:|---:|---|---|
| Health | Kiểm tra trạng thái | `GET /api/v1/health` | ✓ | ✓ | ✓ | ✓ | Endpoint `@Public()`, không yêu cầu tài khoản hay token. | `health.controller.ts` |

### Audit log

| Tài nguyên | Thao tác | API | EMPLOYEE | MANAGER | HR | ADMIN | Điều kiện theo dữ liệu | Nguồn |
|---|---|---|---:|---:|---:|---:|---|---|
| Audit log | Tìm kiếm/xem | `GET /api/v1/audit-logs` | — | — | ✓ | ✓ | Có thể lọc theo loại đối tượng, ID đối tượng, người thao tác, thời gian; phân trang. Log chỉ được thêm, không có API sửa/xóa. | UC7, ADR-09 |

### Tổ chức

| Tài nguyên | Thao tác | API | EMPLOYEE | MANAGER | HR | ADMIN | Điều kiện theo dữ liệu | Nguồn |
|---|---|---|---:|---:|---:|---:|---|---|
| Phòng ban | Xem danh sách | `GET /api/v1/departments` | ✓ | ✓ | ✓ | ✓ | Yêu cầu đăng nhập; hiện trả danh sách phòng ban cho mọi role. | UC2 |
| Phòng ban | Xem cây | `GET /api/v1/departments/tree` | ✓ | ✓ | ✓ | ✓ | Yêu cầu đăng nhập; hiện trả toàn bộ cây, không giới hạn theo phòng ban hay mã phòng ban. | UC2 |
| Phòng ban | Xem chi tiết | `GET /api/v1/departments/{id}` | ✓ | ✓ | ✓ | ✓ | Yêu cầu đăng nhập; ID phải là phòng ban tồn tại. | UC2 |
| Phòng ban | Tạo | `POST /api/v1/departments` | — | — | ✓ | ✓ | Chỉ `HR` hoặc `ADMIN`; `parentId` nếu có phải tồn tại. | UC2; `OrganizationController.create` |
| Phòng ban | Cập nhật | `PATCH /api/v1/departments/{id}` | — | — | ✓ | ✓ | Chỉ `HR` hoặc `ADMIN`; phòng ban phải tồn tại; cập nhật `parentId` không được tạo vòng lặp. | UC2; `OrganizationController.update` |
| Chức danh | Xem danh sách | `GET /api/v1/positions` | ✓ | ✓ | ✓ | ✓ | Yêu cầu đăng nhập; hiện trả danh sách chức danh cho mọi role. | UC2 |

### Hồ sơ nhân viên

| Tài nguyên | Thao tác | API | EMPLOYEE | MANAGER | HR | ADMIN | Điều kiện theo dữ liệu | Nguồn |
|---|---|---|---:|---:|---:|---:|---|---|
| Hồ sơ của tôi | Xem tài khoản và hồ sơ liên kết | `GET /api/v1/me` | ✓ | ✓ | ✓ | ✓ | Nếu tài khoản chưa gắn `employeeId`, chỉ trả email/role và `employee: null`; nếu đã gắn, hồ sơ theo quy tắc `GET /employees/{id}` nhưng không kèm trường nhạy cảm. | UC1; `EmployeeController.me` |
| Danh bạ | Tìm kiếm/xem danh sách | `GET /api/v1/employees` | ✓ | ✓ | ✓ | ✓ | Không giới hạn theo người xem hay phòng ban ngoài bộ lọc được client gửi; loại nhân viên `TERMINATED`; kết quả hiện gồm tên, email, điện thoại, mã, phòng ban, chức danh và quản lý. Có phân trang. | UC2, UC6; `EmployeeService.directory` |
| Hồ sơ nhân viên | Tạo | `POST /api/v1/employees` | — | — | ✓ | — | Chỉ `HR`; phòng ban và chức danh phải tồn tại; quản lý nếu truyền vào phải tồn tại. `ADMIN` không được phép theo decorator hiện tại. | UC1; `EmployeeController.create` |
| Hồ sơ nhân viên | Xem thông tin cơ bản/cá nhân | `GET /api/v1/employees/{id}` | ✓ | ✓ | ✓ | ✓ | Bản ghi phải tồn tại. Chủ hồ sơ và quản lý trực tiếp thấy thêm dữ liệu cá nhân; HR thấy cấp HR; người khác, kể cả ADMIN, chỉ thấy cấp danh bạ. Chỉ HR được yêu cầu `include=sensitive`; mỗi lượt xem đó ghi audit. | UC1; `employee-access.ts:viewLevel`; `EmployeeService.profile` |
| Hồ sơ nhân viên | Cập nhật | `PATCH /api/v1/employees/{id}` | ✓ | ✓ | ✓ | ✓ | HR được cập nhật các trường DTO; mọi role có `employeeId` trùng ID hồ sơ chỉ được cập nhật `phone`, `address` trên hồ sơ của chính mình. Quản lý không có quyền sửa hồ sơ cấp dưới chỉ vì quan hệ quản lý. Người khác bị từ chối; `version` nếu gửi phải khớp. | UC1; `employee-access.ts:forbiddenFields`; `EmployeeService.update` |
| Danh bạ cấp dưới | Xem cấp dưới trực tiếp của một nhân viên | `GET /api/v1/employees/{id}/direct-reports` | ✓ | ✓ | ✓ | ✓ | ID nhân viên phải tồn tại; truy vấn trả nhân viên ACTIVE/ON_LEAVE có `managerId` bằng ID trên. Hiện không xác minh người gọi là quản lý của ID đó. | UC2; `EmployeeService.directReports` |
| Danh bạ phòng ban | Xem thành viên | `GET /api/v1/departments/{id}/members` | ✓ | ✓ | ✓ | ✓ | Phòng ban phải tồn tại; kết quả lọc theo ID phòng ban, loại TERMINATED và phân trang. Hiện không giới hạn theo role, phòng ban của người gọi hay quyền quản lý. | UC2; `EmployeeController.members` |
| Trường nhạy cảm | Xem CCCD, tài khoản ngân hàng, lương | `GET /api/v1/employees/{id}?include=sensitive` | — | — | ✓ | — | Chỉ HR; bản ghi phải tồn tại. Giá trị giải mã chỉ được thêm vào response khi yêu cầu; mỗi lượt xem ghi `VIEW_SENSITIVE` vào audit. ADMIN không được xem. | UC1.3; ADR-08; `EmployeeService.profile` |
| Trường nhạy cảm | Cập nhật | `PATCH /api/v1/employees/{id}` | — | — | ✓ | — | Chỉ HR; giá trị được mã hóa qua `FieldCrypto`; audit ghi tên trường đã che, không ghi giá trị nhạy cảm. Endpoint tạo nhân viên hiện không nhận trường nhạy cảm. | UC1.3; ADR-08; `EmployeeService` |

### Nghỉ phép

| Tài nguyên | Thao tác | API | EMPLOYEE | MANAGER | HR | ADMIN | Điều kiện theo dữ liệu | Nguồn |
|---|---|---|---:|---:|---:|---:|---|---|
| Loại phép | Xem danh sách | `GET /api/v1/leave-types` | ✓ | ✓ | ✓ | ✓ | Yêu cầu đăng nhập; hiện không giới hạn theo role. | UC3 |
| Ngày lễ | Xem danh sách theo năm | `GET /api/v1/leave-holidays` | ✓ | ✓ | ✓ | ✓ | Yêu cầu đăng nhập; nếu không truyền năm, dùng năm hiện tại. | BR-03 |
| Số dư phép | Xem số dư của mình | `GET /api/v1/leave-balances/me` | ✓ | ✓ | ✓ | ✓ | Tài khoản phải gắn với nhân viên; chỉ trả số dư của `employeeId` trong token, không có tham số chọn nhân viên khác. | BR-01; `LeaveController.myBalances` |
| Đơn nghỉ phép | Tạo/gửi | `POST /api/v1/leave-requests` | ✓ | ✓ | ✓ | ✓ | Tài khoản phải gắn với nhân viên; đơn luôn được tạo cho chính người gọi. `Idempotency-Key` bắt buộc; áp dụng số dư, ngày làm việc, trùng lịch và trạng thái theo BR-01–04. | BR-01–04, BR-11 |
| Đơn nghỉ phép | Xem đơn của mình | `GET /api/v1/leave-requests/me` | ✓ | ✓ | ✓ | ✓ | Tài khoản phải gắn với nhân viên; chỉ trả đơn của `employeeId` người gọi; có thể lọc trạng thái và phân trang. | UC3; `LeaveService.mine` |
| Đơn nghỉ phép | Xem danh sách chờ duyệt | `GET /api/v1/leave-requests/pending-approval` | — | ✓ | — | — | Role MANAGER; chỉ đơn `SUBMITTED` của nhân viên ACTIVE/ON_LEAVE đang báo cáo trực tiếp cho người gọi. | UC4, BR-05; `LeaveService.pendingApproval` |
| Đơn nghỉ phép | Xem danh sách toàn hệ thống | `GET /api/v1/leave-requests` | — | — | ✓ | — | Chỉ HR; có thể lọc trạng thái và phân trang; mặc định chỉ đơn `APPROVED` chờ HR hoàn tất. | BR-10; `LeaveService.all` |
| Đơn nghỉ phép | Xem chi tiết | `GET /api/v1/leave-requests/{id}` | ✓ | ✓ | ✓ | ✓ | Chỉ chủ đơn, quản lý trực tiếp hiện tại của chủ đơn, hoặc HR; điều kiện chủ đơn/quản lý áp dụng cho mọi role, gồm ADMIN. Người khác bị từ chối. | BR-05; `LeaveService.get` |
| Đơn nghỉ phép | Duyệt | `POST /api/v1/leave-requests/{id}/approve` | — | ✓ | — | — | Role MANAGER **và** là quản lý trực tiếp hiện tại của chủ đơn; đơn phải ở `SUBMITTED`. Thay đổi trạng thái yêu cầu `version` hiện tại; thao tác lặp cùng quyết định không tạo side effect. | UC4, BR-05, BR-11 |
| Đơn nghỉ phép | Từ chối | `POST /api/v1/leave-requests/{id}/reject` | — | ✓ | — | — | Role MANAGER **và** là quản lý trực tiếp hiện tại của chủ đơn; đơn phải ở `SUBMITTED`. Thay đổi trạng thái yêu cầu `version` hiện tại; thao tác lặp cùng quyết định không tạo side effect. | UC4, BR-05, BR-09, BR-11 |
| Đơn nghỉ phép | Hủy | `POST /api/v1/leave-requests/{id}/cancel` | ✓ | ✓ | ✓ | ✓ | Chỉ chủ đơn; đơn phải ở `SUBMITTED`. Role không thay thế điều kiện sở hữu; không tự hủy đơn đã duyệt. | BR-07, BR-08 |
| Đơn nghỉ phép | HR hoàn tất | `POST /api/v1/leave-requests/{id}/complete` | — | — | ✓ | — | Role HR; đơn phải ở `APPROVED`; thay đổi trạng thái yêu cầu `version` hiện tại. Chỉ HR được hoàn tất. | BR-10, BR-11 |

## Điểm lệch và câu hỏi cần review

Các điểm dưới đây mô tả code hiện tại để reviewer thống nhất trước khi ma trận trở thành hợp đồng kiểm thử:

1. **`GET /employees/{id}/direct-reports` và `GET /departments/{id}/members`:** mọi tài khoản đã đăng nhập có thể truy vấn
   danh sách, không cần là người quản lý hay thành viên của phạm vi đó. Cần xác nhận đây là danh bạ toàn tổ chức theo UC2,
   hay phải giới hạn role/phạm vi.
2. **`GET /employees`:** mọi role đã đăng nhập, gồm ADMIN, nhận được số điện thoại và thông tin danh bạ của tất cả nhân viên
   không TERMINATED; bộ lọc phòng ban là do người gọi chọn. Cần xác nhận các trường và phạm vi này phù hợp với nguyên tắc
   ADMIN là quản trị kỹ thuật và yêu cầu tối thiểu hóa dữ liệu.
3. **Đọc tổ chức/chức danh và loại phép/ngày lễ:** hiện mở cho mọi role đã đăng nhập. Ma trận ghi nhận hành vi code; các
   bảng này không phải hồ sơ cá nhân nhưng cần TV1/TV4 xác nhận mức hiển thị.
4. **BR-06 chưa được triển khai:** ma trận hiện chỉ cho quản lý trực tiếp duyệt/từ chối; chưa có quan hệ ủy quyền để mở
   quyền cho người duyệt thay. Cập nhật ma trận sau khi nghiệp vụ và code được chốt ở nhánh `docs/leave-rules-br06`.
5. **UC5 (Document repository) và các API tài liệu/tìm kiếm chưa xuất hiện trong `docs/openapi.yaml`:** không có endpoint
   hiện tại để đưa vào ma trận; bổ sung khi API được thiết kế.

## Phạm vi đối chiếu

Ma trận bao phủ **27/27 operation** có trong `docs/openapi.yaml` tại thời điểm viết: health (1), audit (1), organization
(6), employee (7), leave (12). Các đường dẫn lược tiền tố chung `/api/v1`. Khi thêm hoặc đổi endpoint, cập nhật ma trận
cùng PR API và kiểm tra lại các ô quyền với `@Roles(...)` cùng kiểm tra trong service.

Nguồn code chính: `backend/src/health.controller.ts`; `backend/src/modules/{audit,employee,identity,leave,organization}/`;
`backend/src/common/field-crypto.ts`. Nguồn nghiệp vụ: `docs/progress/tuan-05/TV2_Thanh.md`,
`docs/business/leave-rules.md`, ADR-08/ADR-09/ADR-10 trong `docs/progress/tuan-07/README.md`.
