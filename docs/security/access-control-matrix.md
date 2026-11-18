# Ma trận phân quyền RBAC/ABAC

> Phụ lục của [SRS](../requirements/SRS.md): yêu cầu phân quyền cho từng API (NFR-5). Bộ tài liệu: [`docs/README.md`](../README.md).

Ma trận mô tả quyền hiện tại của API trong `docs/openapi.yaml`, đối chiếu `@Roles(...)` ở controller và kiểm tra theo dữ
liệu trong service. Đây là hợp đồng nghiệp vụ để TV1 viết e2e test và TV4 viết ca kiểm thử; các điểm chưa được giới hạn ở
code được ghi riêng, không mặc nhiên kết luận đó là lỗi.

## Nguyên tắc và ký hiệu

- **Deny by default:** mọi API cần token Bearer hợp lệ qua `AuthGuard` toàn cục, trừ `GET /api/v1/health`. Endpoint không
  có `@Roles(...)` vẫn yêu cầu đăng nhập; điều kiện theo bản ghi được kiểm tra thêm trong service.
- **Ba lớp phân quyền** ([ADR-18](../architecture/adr/ADR-18-authorization.md), [mô hình và quy ước](authorization.md)): RBAC chặn
  role ở controller; kiểm theo dữ liệu (ABAC) giới hạn bản ghi, trường và trạng thái ở service; API danh sách lọc trong truy vấn.
- **Nguồn vai trò:** `HR`, `ADMIN` chỉ lấy từ `iam.role_assignment`; `EMPLOYEE`, `MANAGER` suy ra. Claim vai trò trong token bị bỏ qua.
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
| Hồ sơ của tôi | Xem tài khoản | `GET /api/v1/me` | ✓ | ✓ | ✓ | ✓ | Chỉ `email`, `roles`, `employee { id, employeeCode, fullName }` hoặc `employee: null`; dữ liệu hồ sơ lấy qua `summary` (AC-1.8.7). Tài khoản gắn hồ sơ `TERMINATED`: mọi API trả 403 (AC-1.7.2) | UC1; `EmployeeController.me`; `IdentityService.resolve` |
| Danh bạ | Tìm kiếm/xem danh sách | `GET /api/v1/employees` | ✓ | ✓ | ✓ | ✓ | Không giới hạn theo người xem hay phòng ban ngoài bộ lọc được client gửi; loại nhân viên `TERMINATED`; kết quả hiện gồm tên, email, điện thoại, mã, phòng ban, chức danh và quản lý. Có phân trang. Có `q` thì tính giới hạn tìm kiếm 20/phút | UC2, UC6; `EmployeeService.directory` |
| Hồ sơ nhân viên | Tạo | `POST /api/v1/employees` | — | — | ✓ | — | Chỉ `HR`; phòng ban và chức danh phải tồn tại; quản lý theo FR-2.5. `ADMIN` không được phép. Audit `CREATE` theo nhóm trường | UC1; `EmployeeController.create` |
| Hồ sơ nhân viên | Xem trang mặc định, thẻ xem nhanh | `GET /api/v1/employees/{id}/summary` | ✓ | ✓ | ✓ | ✓ | Chỉ dữ liệu mức danh bạ cộng danh sách mục người xem được thấy (`relation`: HR, OWNER, MANAGER, OTHER); hàng "Diện đối tượng" chỉ từ mức QL | UC1 FR-1.8; `profile-sections.ts` |
| Hồ sơ nhân viên | Xem đầy đủ (form HR, trang cũ) | `GET /api/v1/employees/{id}` | ✓ | ✓ | ✓ | ✓ | Chủ hồ sơ và quản lý trực tiếp thấy thêm dữ liệu cá nhân; HR thấy cấp HR; người khác, kể cả ADMIN, chỉ thấy cấp danh bạ. `include=sensitive` chỉ HR, mỗi lượt ghi `VIEW_SENSITIVE`, tối đa 100 lượt/giờ | UC1; `employee-access.ts:viewLevel` |
| Hồ sơ nhân viên | Cập nhật trường chính | `PATCH /api/v1/employees/{id}` | — | — | ✓ | — | **Chỉ HR** (từ #86). Nhân viên đổi điện thoại, địa chỉ qua yêu cầu cập nhật. `version` bắt buộc; không cho chuyển `TERMINATED` khi còn cấp dưới; trùng email 409. Audit theo nhóm trường | UC1 FR-1.2, FR-1.4, FR-1.6, FR-1.7; `employee-access.ts:forbiddenFields` |
| Danh bạ cấp dưới | Xem cấp dưới trực tiếp của một nhân viên | `GET /api/v1/employees/{id}/direct-reports` | ✓ | ✓ | ✓ | ✓ | ID nhân viên phải tồn tại; truy vấn trả nhân viên ACTIVE/ON_LEAVE có `managerId` bằng ID trên. Mở cho mọi người đã đăng nhập vì là dữ liệu danh bạ, nhưng chỉ trả trường mức danh bạ (ADR-18 mục 5). | UC2; `EmployeeService.directReports` |
| Danh bạ phòng ban | Xem thành viên | `GET /api/v1/departments/{id}/members` | ✓ | ✓ | ✓ | ✓ | Phòng ban phải tồn tại; kết quả lọc theo ID phòng ban, loại TERMINATED và phân trang. Mở cho mọi người đã đăng nhập ở mức danh bạ (ADR-18 mục 5). | UC2; `EmployeeController.members` |
| Mục hồ sơ | Xem | `GET /api/v1/employees/{id}/profile/{section}` | ✓ | ✓ | ✓ | ✓ | Theo mức của mục (spec 9.1): QL cho chủ hồ sơ, quản lý trực tiếp, HR; CN, NC cho chủ hồ sơ và HR. Không được xem hoặc mục không tồn tại: 404. `reveal=true` giải mã giá trị NC (chủ hồ sơ, HR) hoặc CCCD (chỉ HR), ghi `VIEW_SENSITIVE` | UC1 FR-1.3, FR-1.8, FR-1.12, FR-1.13 |
| Mục hồ sơ | HR thêm, sửa, xóa dòng trực tiếp | `POST /api/v1/employees/{id}/profile/{section}`, `PATCH/DELETE …/{itemId}` | — | — | ✓ | — | Chỉ HR; `version` từng dòng; hợp đồng trùng khoảng ngày 409; 30 lệnh ghi/phút. Audit `PROFILE_ITEM_*` | UC1 FR-1.9 A9, FR-1.12 |
| Hợp đồng sắp hết hạn | Xem | `GET /api/v1/contracts/expiring` | — | — | ✓ | — | Chỉ HR | UC1 AC-1.12.5 |
| Yêu cầu cập nhật hồ sơ | Gửi, hủy, đóng thông báo từ chối | `POST /api/v1/employees/{id}/change-requests`, `DELETE …/{requestId}`, `POST …/{requestId}/acknowledge` | ✓ | ✓ | ✓ | ✓ | Chỉ chủ hồ sơ (`relation = OWNER`), chỉ mục có cột "Nhập" là NV; `Idempotency-Key` bắt buộc; tối đa 20 yêu cầu chờ; 30 lệnh ghi/phút. Audit `PROFILE_CHANGE_SUBMIT`, `PROFILE_CHANGE_CANCEL`. Xem điểm lệch 7 về HR với hồ sơ của mình | UC1 FR-1.9 |
| Yêu cầu cập nhật hồ sơ | Xem chi tiết | `GET /api/v1/change-requests/{requestId}` | ✓ | ✓ | ✓ | ✓ | HR hoặc người gửi; người khác 404. `reveal=true` chỉ HR, ghi `VIEW_SENSITIVE` | UC1 FR-1.9 |
| Yêu cầu cập nhật hồ sơ | Xem danh sách, duyệt, từ chối | `GET /api/v1/change-requests`, `POST …/{requestId}/approve`, `POST …/{requestId}/reject` | — | — | ✓ | — | Chỉ HR. Duyệt kiểm `baseVersion` (409), duyệt lặp lại trả lại yêu cầu; từ chối bắt buộc lý do. Audit `PROFILE_CHANGE_APPROVE`, `PROFILE_CHANGE_REJECT` (không có lý do) | UC1 FR-1.9 |
| File hồ sơ | Tải lên, xác nhận, xem danh sách, tải xuống | `POST /api/v1/employees/{id}/files`, `…/{fileId}/confirm`, `GET …/files?section=`, `GET …/{fileId}/download` | ✓ | ✓ | ✓ | ✓ | Chủ hồ sơ và HR; người khác (kể cả quản lý trực tiếp) 404. File của hợp đồng, khen thưởng kỷ luật chỉ HR tải lên. HR tải file người khác ghi `PROFILE_FILE_DOWNLOAD`. 10 URL/giờ, 30/ngày; ảnh đại diện 5/ngày; 60 file tải xuống/giờ | UC1 FR-1.10 |
| File hồ sơ | Xóa trực tiếp | `DELETE /api/v1/employees/{id}/files/{fileId}` | — | — | ✓ | — | Chỉ HR; nhân viên xóa file của mình bằng yêu cầu cập nhật, không xóa được file HR tải lên (403) | UC1 FR-1.10 |
| Ảnh đại diện | Xem | `GET /api/v1/employees/{id}/avatar` | ✓ | ✓ | ✓ | ✓ | Chỉ ảnh đã được HR duyệt (mức danh bạ) | UC1 AC-1.10.3 |
| Nhật ký hồ sơ | Xem | `GET /api/v1/employees/{id}/history` | ✓ | ✓ | ✓ | ✓ | Chủ hồ sơ và HR; quản lý trực tiếp, người khác 403. Không có giá trị, không có tên file gốc, không có lý do từ chối | UC1 FR-1.11 |

### Nghỉ phép

| Tài nguyên | Thao tác | API | EMPLOYEE | MANAGER | HR | ADMIN | Điều kiện theo dữ liệu | Nguồn |
|---|---|---|---:|---:|---:|---:|---|---|
| Loại phép | Xem danh sách | `GET /api/v1/leave-types` | ✓ | ✓ | ✓ | ✓ | Yêu cầu đăng nhập; hiện không giới hạn theo role. | UC3 |
| Ngày lễ | Xem danh sách theo năm | `GET /api/v1/leave-holidays` | ✓ | ✓ | ✓ | ✓ | Yêu cầu đăng nhập; nếu không truyền năm, dùng năm hiện tại. | BR-03 |
| Số dư phép | Xem số dư của mình | `GET /api/v1/leave-balances/me` | ✓ | ✓ | ✓ | ✓ | Tài khoản phải gắn với nhân viên; chỉ trả số dư của `employeeId` trong token, không có tham số chọn nhân viên khác. | BR-01; `LeaveController.myBalances` |
| Đơn nghỉ phép | Tạo/gửi (tự tạo hoặc tạo hộ) | `POST /api/v1/leave-requests` | ✓ chỉ cho mình | ✓ cho mình hoặc cấp dưới trực tiếp | ✓ cho mình hoặc mọi nhân viên | ✓ chỉ cho mình | Tạo hộ phải chỉ rõ chủ đơn: MANAGER chỉ được chỉ định cấp dưới trực tiếp (không tính quan hệ chỉ được giao duyệt thay theo BR-06); HR được chỉ định mọi nhân viên. Chủ đơn là người nghỉ và là chủ số dư; BR-01–04 áp dụng theo chủ đơn. `Idempotency-Key` bắt buộc. History/audit phải ghi riêng người tạo và chủ đơn; email gửi cho chủ đơn. Manager tạo hộ cho cấp dưới vẫn có thể tự duyệt theo BR-05 — trade-off đã chấp nhận. Đây là nghiệp vụ yêu cầu, hiện API chưa hỗ trợ tạo hộ. | BR-01–04, BR-11, BR-12 |
| Đơn nghỉ phép | Xem đơn của mình | `GET /api/v1/leave-requests/me` | ✓ | ✓ | ✓ | ✓ | Tài khoản phải gắn với nhân viên; chỉ trả đơn của `employeeId` người gọi; có thể lọc trạng thái và phân trang. | UC3; `LeaveService.mine` |
| Đơn nghỉ phép | Xem danh sách chờ duyệt | `GET /api/v1/leave-requests/pending-approval` | — | ✓ | ✓ đơn của CEO | — | MANAGER thấy đơn `SUBMITTED` của cấp dưới trực tiếp; HR thấy đơn `SUBMITTED` của CEO (issue #22); trong thời hạn phân công BR-06, người duyệt thay thấy đơn của cấp dưới trực tiếp của quản lý được thay. Code chưa có phần người duyệt thay (BR-06). | UC4, BR-05, BR-06; `LeaveService.pendingApproval` |
| Đơn nghỉ phép | Xem danh sách toàn hệ thống | `GET /api/v1/leave-requests` | — | — | ✓ | — | Chỉ HR; có thể lọc trạng thái và phân trang; mặc định chỉ đơn `APPROVED` chờ HR hoàn tất. | BR-10; `LeaveService.all` |
| Đơn nghỉ phép | Xem chi tiết | `GET /api/v1/leave-requests/{id}` | ✓ | ✓ | ✓ | ✓ | Chỉ chủ đơn, quản lý trực tiếp hiện tại của chủ đơn, hoặc HR; điều kiện chủ đơn/quản lý áp dụng cho mọi role, gồm ADMIN. Người khác bị từ chối. | BR-05; `LeaveService.get` |
| Đơn nghỉ phép | Duyệt | `POST /api/v1/leave-requests/{id}/approve` | — | ✓ | ✓ chỉ đơn của CEO | — | MANAGER phải là quản lý trực tiếp hiện tại hoặc người duyệt thay hợp lệ theo BR-06; HR chỉ duyệt đơn của CEO. Đơn phải ở `SUBMITTED`; thay đổi trạng thái yêu cầu `version` hiện tại; thao tác lặp cùng quyết định không tạo side effect. Code đã có HR duyệt đơn CEO (tuần 10); chưa có người duyệt thay (BR-06). | UC4, BR-05, BR-06, BR-11 |
| Đơn nghỉ phép | Từ chối | `POST /api/v1/leave-requests/{id}/reject` | — | ✓ | ✓ chỉ đơn của CEO | — | MANAGER phải là quản lý trực tiếp hiện tại hoặc người duyệt thay hợp lệ theo BR-06; HR chỉ từ chối đơn của CEO. Đơn phải ở `SUBMITTED`; thay đổi trạng thái yêu cầu `version` hiện tại; thao tác lặp cùng quyết định không tạo side effect. Code đã có HR từ chối đơn CEO (tuần 10); chưa có người duyệt thay (BR-06). | UC4, BR-05, BR-06, BR-09, BR-11 |
| Đơn nghỉ phép | Hủy | `POST /api/v1/leave-requests/{id}/cancel` | ✓ | ✓ | ✓ | ✓ | Chỉ chủ đơn; đơn phải ở `SUBMITTED`. Role không thay thế điều kiện sở hữu; không tự hủy đơn đã duyệt. | BR-07, BR-08 |
| Đơn nghỉ phép | HR hoàn tất | `POST /api/v1/leave-requests/{id}/complete` | — | — | ✓ | — | Role HR; đơn phải ở `APPROVED`; thay đổi trạng thái yêu cầu `version` hiện tại. Chỉ HR được hoàn tất. | BR-10, BR-11 |

### Kho tài liệu (tuần 10, `document-rules.md`)

| Tài nguyên | Thao tác | API | EMPLOYEE | MANAGER | HR | ADMIN | Điều kiện theo dữ liệu | Nguồn |
|---|---|---|---:|---:|---:|---:|---|---|
| Tài liệu | Xem danh sách | `GET /api/v1/documents` | ✓ | ✓ | ✓ | ✓ | Chỉ tài liệu chưa ẩn, có phiên bản sẵn sàng và khớp ít nhất một phạm vi: toàn công ty, phòng ban của người xem hoặc phòng ban cha, vai trò. Người đã nghỉ việc hoặc chưa gắn hồ sơ nhận danh sách rỗng. Lọc trong truy vấn, không lộ số lượng. | DR-02, DR-05, DR-06, DR-08 |
| Tài liệu | Xem chi tiết, phiên bản | `GET /api/v1/documents/{id}` | ✓ | ✓ | ✓ | ✓ | Như trên; ngoài phạm vi trả 404 như không tồn tại. HR không có quyền xem ngầm. | DR-03, DR-04, DR-08 |
| Tài liệu | Tải xuống | `GET /api/v1/documents/{id}/download`, `GET /api/v1/documents/{id}/versions/{versionId}/download` | ✓ | ✓ | ✓ | ✓ | Kiểm phạm vi ở mỗi lần tải, file đi qua API; không phát link tải. | DR-06, ADR-13 |
| Kho tài liệu | Quản lý (danh sách, chi tiết metadata) | `GET /api/v1/documents/manage`, `GET /api/v1/documents/manage/{id}` | — | — | ✓ | — | Thấy mọi tài liệu kể cả đã ẩn, chỉ metadata (tiêu đề, phạm vi, phiên bản); không tải được nội dung ngoài phạm vi. | DR-03 |
| Kho tài liệu | Tạo, thêm phiên bản, xác nhận tải lên | `POST /api/v1/documents`, `POST /api/v1/documents/{id}/versions`, `POST /api/v1/documents/{id}/versions/{versionId}/confirm` | — | — | ✓ | — | PDF/DOCX ≤ 20 MiB, định dạng thực phải khớp; ít nhất một phạm vi; phiên bản mới không ghi đè bản cũ. Ghi audit. | DR-01, DR-04 |
| Kho tài liệu | Sửa metadata, ẩn, khôi phục | `PATCH /api/v1/documents/{id}`, `POST /api/v1/documents/{id}/hide`, `POST /api/v1/documents/{id}/restore` | — | — | ✓ | — | `version` phải khớp khi sửa; ẩn không xóa phiên bản. Ghi audit. | DR-03, DR-05 |

## Điểm lệch và quyết định nghiệp vụ

Các mục dưới đây ghi nhận quyết định nghiệp vụ đã thống nhất và các phần chưa được triển khai trong code:

1. **`GET /employees/{id}/direct-reports` và `GET /departments/{id}/members`:** mọi tài khoản đã đăng nhập có thể truy vấn
   danh sách, không cần là người quản lý hay thành viên của phạm vi đó. Quyết định: giữ nguyên danh bạ toàn tổ chức cho mọi
   tài khoản đã đăng nhập theo UC2; đây là chủ ý nghiệp vụ, không phải điểm chờ xác nhận.
2. **`GET /employees`:** mọi role đã đăng nhập, gồm ADMIN, nhận được số điện thoại và thông tin danh bạ của tất cả nhân viên
   không TERMINATED; bộ lọc phòng ban là do người gọi chọn. Quyết định: giữ nguyên các trường danh bạ và phạm vi tra cứu
   hiện tại cho mọi tài khoản đã đăng nhập theo UC2; phạm vi này được chấp nhận cho danh bạ nội bộ và không mở quyền đọc
   trường nhạy cảm.
3. **Đọc tổ chức/chức danh và loại phép/ngày lễ:** hiện mở cho mọi role đã đăng nhập. Ma trận ghi nhận hành vi code; các
   bảng này không phải hồ sơ cá nhân theo UC2 và UC6; đây là phạm vi đọc công khai cho người dùng đã đăng nhập và là quyết
   định có chủ ý.
4. **BR-06 chưa được triển khai:** nghiệp vụ đã chốt người duyệt thay; API chưa có phân công thay thế. Ngoại lệ CEO trong
   BR-05 (HR duyệt đơn CEO) đã có từ tuần 10, kèm e2e.
5. **BR-12 chưa được triển khai:** API tạo đơn hiện chỉ nhận chủ đơn là người gọi; chưa hỗ trợ HR tạo hộ mọi nhân viên hoặc
   MANAGER tạo hộ cấp dưới trực tiếp. Cần hỗ trợ phân biệt người tạo và chủ đơn trong request, history/audit, tính số dư theo
   chủ đơn và gửi email cho chủ đơn. Quản lý được chấp nhận vừa tạo hộ vừa duyệt đơn đó theo BR-05.
7. **HR với hồ sơ của chính mình (lệch với thiết kế):** ma trận thiết kế ghi HR gửi yêu cầu cập nhật cho hồ sơ của mình như
   nhân viên và không tự duyệt yêu cầu của mình. Code hiện xét vai trò HR trước quan hệ chủ hồ sơ (`relationTo` trong
   `profile-sections.ts`), nên HR xem hồ sơ của mình ở mức HR, **ghi thẳng** được (kể cả tài khoản ngân hàng của mình) và không
   gửi được yêu cầu (403); cũng chưa có kiểm "không tự duyệt". Cần quyết định và sửa ở một nhánh riêng.
6. **UC5 (Document repository) và các API tài liệu/tìm kiếm chưa xuất hiện trong `docs/openapi.yaml`:** không có endpoint
   hiện tại để đưa vào ma trận; bổ sung khi API được thiết kế.

## Phạm vi đối chiếu

Ma trận bao phủ **27/27 operation** có trong `docs/openapi.yaml` tại thời điểm viết: health (1), audit (1), organization
(6), employee (7), leave (12). Các đường dẫn lược tiền tố chung `/api/v1`. Khi thêm hoặc đổi endpoint, cập nhật ma trận
cùng PR API và kiểm tra lại các ô quyền với `@Roles(...)` cùng kiểm tra trong service.

Nguồn code chính: `backend/src/health.controller.ts`; `backend/src/modules/{audit,employee,identity,leave,organization}/`;
`backend/src/common/field-crypto.ts`. Nguồn nghiệp vụ: `docs/progress/tuan-05/TV2_Thanh.md`,
`docs/business/leave-rules.md`, ADR-08/ADR-09/ADR-10 trong `docs/progress/tuan-07/README.md`.
