# Ma trận ca kiểm thử phân quyền và bảo mật (Security Test Cases)

> Tài liệu kiểm thử: kiểm chứng NFR-5 và ma trận phân quyền trong [SRS](../requirements/SRS.md). Bộ tài liệu: [`docs/README.md`](../README.md).

- **Nguyên tắc:** Các API (trừ Health) đều yêu cầu token. Ca bị chặn đối với các API cho phép mọi Role sẽ được kiểm thử bằng thao tác không gửi token (401) hoặc thao tác ngoài phạm vi dữ liệu (403).

## 1. Hệ thống & Audit Log
| Mã TC | Dòng ma trận | Tài khoản | Request (Method + Endpoint + Body) | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Health - Kiểm tra | Không token | `GET /api/v1/health` | `200 OK`, API public không cần token. |
| **SEC-02** | Health - Kiểm tra | Bất kỳ | `POST /api/v1/health` | `404/405`, lỗi sai HTTP Method. |
| **SEC-03** | Audit log - Tìm kiếm | `hr` | `GET /api/v1/audit-logs` | `200 OK`, trả về danh sách log. |
| **SEC-04** | Audit log - Tìm kiếm | `employee` | `GET /api/v1/audit-logs` | `403 Forbidden`, chỉ HR/ADMIN được xem. |

## 2. Tổ chức (Phòng ban & Chức danh)
| Mã TC | Dòng ma trận | Tài khoản | Request (Method + Endpoint + Body) | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-05** | Phòng ban - Xem danh sách | `employee` | `GET /api/v1/departments` | `200 OK`, trả về danh sách phòng ban. |
| **SEC-06** | Phòng ban - Xem danh sách | Không token | `GET /api/v1/departments` | `401 Unauthorized`, yêu cầu đăng nhập. |
| **SEC-07** | Phòng ban - Xem cây | `manager` | `GET /api/v1/departments/tree` | `200 OK`, trả về toàn bộ cây. |
| **SEC-08** | Phòng ban - Xem cây | Không token | `GET /api/v1/departments/tree` | `401 Unauthorized`. |
| **SEC-09** | Phòng ban - Xem chi tiết | `hr` | `GET /api/v1/departments/{id}` | `200 OK`, trả về chi tiết phòng ban. |
| **SEC-10** | Phòng ban - Xem chi tiết | Không token | `GET /api/v1/departments/{id}` | `401 Unauthorized`. |
| **SEC-11** | Phòng ban - Tạo | `admin` | `POST /api/v1/departments` (Body: `{"name": "IT", "code": "IT01", "office": "Hanoi"}`) | `201 Created`, tạo thành công. |
| **SEC-12** | Phòng ban - Tạo | `employee` | `POST /api/v1/departments` | `403 Forbidden`. |
| **SEC-13** | Phòng ban - Cập nhật | `hr` | `PATCH /api/v1/departments/{id}` (Body: `{"name": "HR"}`) | `200 OK`, cập nhật thành công. |
| **SEC-14** | Phòng ban - Cập nhật | `manager` | `PATCH /api/v1/departments/{id}` | `403 Forbidden`. |
| **SEC-15** | Chức danh - Xem danh sách | `employee` | `GET /api/v1/positions` | `200 OK`, trả danh sách chức danh. |
| **SEC-16** | Chức danh - Xem danh sách | Không token | `GET /api/v1/positions` | `401 Unauthorized`. |

## 3. Hồ sơ nhân viên
| Mã TC | Dòng ma trận | Tài khoản | Request (Method + Endpoint + Body) | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-17** | Hồ sơ - Xem của tôi | `employee` | `GET /api/v1/me` | `200 OK`, trả về tài khoản và `employeeId`. |
| **SEC-18** | Hồ sơ - Xem của tôi | Không token | `GET /api/v1/me` | `401 Unauthorized`. |
| **SEC-19** | Danh bạ - Tìm kiếm | `manager` | `GET /api/v1/employees` | `200 OK`, trả danh sách nhân viên ACTIVE. |
| **SEC-20** | Danh bạ - Tìm kiếm | Không token | `GET /api/v1/employees` | `401 Unauthorized`. |
| **SEC-21** | Hồ sơ - Tạo mới | `hr` | `POST /api/v1/employees` (Body: `{"employeeCode":"E91270","fullName":"Nguyen Van Kiem Thu","workEmail":"sec21-e91270@hr.local","departmentId":"<UUID phòng ban>","positionId":"<UUID chức danh>","managerId":"<UUID của manager>","hireDate":"2026-11-01"}`) | `201 Created`, hồ sơ được tạo. |
| **SEC-22** | Hồ sơ - Tạo mới | `admin` | `POST /api/v1/employees` | `403 Forbidden`, admin không được cấp quyền. |
| **SEC-23** | Hồ sơ - Xem cơ bản | `employee` | `GET /api/v1/employees/{id_khác}` | `200 OK`, chỉ thấy cấp danh bạ. |
| **SEC-24** | Hồ sơ - Xem cơ bản | Không token | `GET /api/v1/employees/{id}` | `401 Unauthorized`. |
| **SEC-25** | Hồ sơ - Cập nhật | `employee` | `PATCH /api/v1/employees/{id_của_mình}` (Body: `{"phone": "0912345678"}`) | `200 OK`, cập nhật thành công. |
| **SEC-26** | Hồ sơ - Cập nhật | `employee` | `PATCH /api/v1/employees/{id_người_khác}` | `403 Forbidden`, không được sửa hồ sơ người khác. |
| **SEC-27** | Danh bạ - Cấp dưới | `manager` | `GET /api/v1/employees/{id}/direct-reports` | `200 OK`, trả danh sách cấp dưới. |
| **SEC-28** | Danh bạ - Cấp dưới | Không token | `GET /api/v1/employees/{id}/direct-reports` | `401 Unauthorized`. |
| **SEC-29** | Danh bạ - Thành viên PB | `employee` | `GET /api/v1/departments/{id}/members` | `200 OK`, trả danh sách thành viên. |
| **SEC-30** | Danh bạ - Thành viên PB | Không token | `GET /api/v1/departments/{id}/members` | `401 Unauthorized`. |
| **SEC-31** | Trường nhạy cảm - Xem | `hr` | `GET /api/v1/employees/{id}?include=sensitive` | `200 OK`, trả về `nationalId`. |
| **SEC-32** | Trường nhạy cảm - Xem | `admin` | `GET /api/v1/employees/{id}?include=sensitive` | `403 Forbidden`. |
| **SEC-33** | Trường nhạy cảm - Cập nhật| `hr` | `PATCH /api/v1/employees/{id}` (Body: `{"nationalId": "012345678912"}`) | `200 OK`. |
| **SEC-34** | Trường nhạy cảm - Cập nhật| `manager` | `PATCH /api/v1/employees/{id}` (Body: `{"nationalId": "012345678912"}`) | `403 Forbidden`. |

## 4. Nghỉ phép
| Mã TC | Dòng ma trận | Tài khoản | Request (Method + Endpoint + Body) | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-35** | Loại phép - Xem DS | `employee` | `GET /api/v1/leave-types` | `200 OK`. |
| **SEC-36** | Loại phép - Xem DS | Không token | `GET /api/v1/leave-types` | `401 Unauthorized`. |
| **SEC-37** | Ngày lễ - Xem DS | `hr` | `GET /api/v1/leave-holidays` | `200 OK`. |
| **SEC-38** | Ngày lễ - Xem DS | Không token | `GET /api/v1/leave-holidays` | `401 Unauthorized`. |
| **SEC-39** | Số dư - Xem của mình | `employee` | `GET /api/v1/leave-balances/me` | `200 OK`. |
| **SEC-40** | Số dư - Xem của mình | Không token | `GET /api/v1/leave-balances/me` | `401 Unauthorized`. |
| **SEC-41** | Đơn - Tạo/gửi | `employee` | `POST /api/v1/leave-requests` (Body: `{"leaveType":"ANNUAL","startDate":"2026-12-14","endDate":"2026-12-14","reason":"Kiem thu phan quyen"}`, header `Idempotency-Key`) | `201 Created`. |
| **SEC-42** | Đơn - Tạo/gửi | Không token | `POST /api/v1/leave-requests` | `401 Unauthorized`. |
| **SEC-43** | Đơn - Xem của mình | `employee` | `GET /api/v1/leave-requests/me` | `200 OK`. |
| **SEC-44** | Đơn - Xem của mình | Không token | `GET /api/v1/leave-requests/me` | `401 Unauthorized`. |
| **SEC-45** | Đơn - DS chờ duyệt | `manager` | `GET /api/v1/leave-requests/pending-approval` | `200 OK`. |
| **SEC-46** | Đơn - DS chờ duyệt | `employee` | `GET /api/v1/leave-requests/pending-approval` | `403 Forbidden`. |
| **SEC-47** | Đơn - DS toàn hệ thống | `hr` | `GET /api/v1/leave-requests` | `200 OK`. |
| **SEC-48** | Đơn - DS toàn hệ thống | `manager` | `GET /api/v1/leave-requests` | `403 Forbidden`. |
| **SEC-49** | Đơn - Xem chi tiết | `manager` (Quản lý trực tiếp) | `GET /api/v1/leave-requests/{id}` | `200 OK`. |
| **SEC-50** | Đơn - Xem chi tiết | `employee` (Không phải chủ đơn) | `GET /api/v1/leave-requests/{id}` | `403 Forbidden`. |
| **SEC-51** | Đơn - Duyệt | `manager` (Quản lý trực tiếp) | `POST /api/v1/leave-requests/{id}/approve` (Body: `{"version":1,"comment":"Dong y duyet"}`) | `200 OK`. |
| **SEC-52** | Đơn - Duyệt | `hr` | `POST /api/v1/leave-requests/{id}/approve` | `403 Forbidden`. |
| **SEC-53** | Đơn - Từ chối | `manager` (Quản lý trực tiếp) | `POST /api/v1/leave-requests/{id}/reject` (Body: `{"version":1,"comment":"Tu choi do trung lich"}`) | `200 OK`. |
| **SEC-54** | Đơn - Từ chối | `admin` | `POST /api/v1/leave-requests/{id}/reject` | `403 Forbidden`. |
| **SEC-55** | Đơn - Hủy | `employee` (Chủ đơn) | `POST /api/v1/leave-requests/{id}/cancel` (Body: `{"version":1,"comment":"Da thu xep duoc cong viec"}`) | `200 OK`. |
| **SEC-56** | Đơn - Hủy | `manager` | `POST /api/v1/leave-requests/{id}/cancel` | `403 Forbidden`. |
| **SEC-57** | Đơn - HR hoàn tất | `hr` | `POST /api/v1/leave-requests/{id}/complete` (Body: `{"version":2,"comment":"Da cap nhat he thong"}`) | `200 OK`. |
| **SEC-58** | Đơn - HR hoàn tất | `manager` | `POST /api/v1/leave-requests/{id}/complete` | `403 Forbidden`. |

## 5. Xác thực, Phiên đăng nhập & Bảo vệ hạ tầng (NFR-5.2 → 5.5, 5.9, 5.21, 5.22)
| Mã TC | Dòng ma trận / NFR | Tài khoản | Thao tác / Request | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-59** | NFR-5.9 – Không tự đăng ký | Khách (Chưa có tài khoản) | Mở màn hình đăng nhập Keycloak (`realm hr`) và Cognito Hosted UI (staging) | Không hiển thị nút/liên kết tự đăng ký (*Register* / *Sign up*); endpoint đăng ký tự do bị tắt. |
| **SEC-60** | NFR-5.9 – Liên kết `email_verified` | Tài khoản IdP có `email_verified = false` | `GET /api/v1/me` (kèm Bearer token có `email_verified: false` trùng email nhân viên) | `403 Forbidden` (hoặc không liên kết `employeeId`), ngăn chiếm tài khoản qua email chưa xác minh (T-02). |
| **SEC-61** | NFR-5.2 – Chính sách mật khẩu | `employee` (hoặc tài khoản mới) | Đặt/đổi mật khẩu trên IdP với chuỗi `< 8` ký tự (`Abc12`), thiếu chữ hoa (`passw0rd1`), thiếu chữ thường (`PASSW0RD1`), thiếu số (`Password!`) hoặc trùng email | IdP từ chối cập nhật, yêu cầu đủ tối thiểu 8 ký tự gồm chữ hoa, chữ thường, số và không trùng email. |
| **SEC-62** | NFR-5.2 – Không ép đổi định kỳ | `employee` | Kiểm tra cấu hình Password Policy trên Keycloak và Cognito User Pool | Không bật chính sách hết hạn mật khẩu định kỳ (*Password Expiration* tắt theo NIST SP 800-63B). |
| **SEC-63** | NFR-5.3 – Chống dò mật khẩu | `employee` | Nhập sai mật khẩu 5 lần liên tiếp trong 15 phút trên trang đăng nhập IdP, sau đó thử lần thứ 6 (kể cả nhập đúng mật khẩu) | Từ lần thứ 6 tài khoản bị khóa tạm 15 phút; thông báo lỗi chung chung, không tiết lộ email có tồn tại hay không. |
| **SEC-64** | NFR-5.4 – MFA bắt buộc (HR, ADMIN) | `hr`, `admin` | Đăng nhập tài khoản `hr` hoặc `admin` trên Keycloak (và mọi tài khoản trên Cognito staging) | Bắt buộc thiết lập ứng dụng TOTP (quét mã QR) và nhập mã OTP 6 chữ số hợp lệ mới cấp token. |
| **SEC-65** | NFR-5.4 – MFA tự chọn (Employee) | `employee` | Đăng nhập tài khoản `employee` trên Keycloak local | Đăng nhập thành công bằng mật khẩu mà không bị bắt buộc bật TOTP. |
| **SEC-66** | NFR-5.5 – Hết hạn Access Token | `employee` | Giữ Access Token quá 15 phút (không refresh), sau đó gọi `GET /api/v1/me` | `401 Unauthorized`, API từ chối token đã hết hạn (`exp`). |
| **SEC-67** | NFR-5.5 – Hết phiên không thao tác / tối đa | `employee` | Ngừng thao tác `> 30` phút (hoặc giữ phiên liên tục `> 10` giờ) rồi tải lại trang / gọi refresh token | IdP từ chối gia hạn phiên, bắt buộc người dùng đăng nhập lại. |
| **SEC-68** | NFR-5.21 – Rate limit chung | `employee` | Gửi liên tiếp `101` request `GET /api/v1/me` trong vòng 60 giây | Từ request thứ 101 trả về `429 Too Many Requests` kèm header `Retry-After` và `{ code, message, traceId }`. |
| **SEC-69** | NFR-5.21 – Rate limit tìm kiếm | `employee` | Gửi liên tiếp `21` request `GET /api/v1/employees?q=Nguyen` trong vòng 60 giây | Request thứ 21 trả về `429 Too Many Requests`. |
| **SEC-70** | NFR-5.21 – Rate limit ghi & xem nhạy cảm | `employee` / `hr` | Gửi `> 30` lệnh `PATCH /api/v1/employees/{id}` trong 1 phút (hoặc `> 100` lượt `GET /api/v1/employees/{id}?include=sensitive` trong 1 giờ) | Vượt ngưỡng trả về `429 Too Many Requests`. |
| **SEC-71** | NFR-5.22 – Header bảo mật HTTP | Không token | `GET /api/v1/health` (và trang chủ frontend trên staging) | Response header có đủ `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (hoặc `frame-ancestors 'none'`), `Content-Security-Policy` và `Strict-Transport-Security` (trên HTTPS). |
| **SEC-72** | NFR-5.22 – Kiểm soát CORS | Không token | Gửi request `OPTIONS` / `GET /api/v1/health` kèm header `Origin: https://evil.example.com` (khác `CORS_ORIGIN`) | Server không trả `Access-Control-Allow-Origin: https://evil.example.com`; trình duyệt chặn truy cập chéo nguồn. |
