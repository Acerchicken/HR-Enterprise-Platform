# Biên bản kiểm thử phân quyền - Tuần 9

> Biên bản kiểm thử: kết quả chạy thật, kiểm chứng [SRS](../requirements/SRS.md). Bộ tài liệu: [`docs/README.md`](../README.md).

- **Ngày chạy:** 08/11/2026
- **Commit của dev:** `a191a74`
- **Môi trường:** Local (Swagger, `AUTH_MODE=dev`)
- **Người thực hiện:** Duy (TV4)
- **Chạy bổ sung:** SEC-21, 41, 51, 53, 55, 57 do TV1 (Duong) chạy thay ngày 08/11/2026 trên commit `dc68b37`, cùng môi trường, vì bản trước chưa khớp DTO. Body thực tế ghi ở cột Ghi chú.
- **Phạm vi chưa kiểm:** Không có.

## 1. Kết quả thực thi Security Test Cases

| Mã TC | Tài khoản | Request (Tóm tắt) | Kết quả mong đợi | Kết quả thực tế quan sát được | KQ | Ghi chú/Issue |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Không token | `GET /api/v1/health` | 200 OK | HTTP 200 OK, API public hoạt động đúng. | Đạt | |
| **SEC-02** | Bất kỳ | `POST /api/v1/health` | 404/405 | HTTP 404 Not Found do sai phương thức. | Đạt | |
| **SEC-03** | `hr` | `GET /api/v1/audit-logs` | 200 OK | HTTP 200 OK, trả về danh sách lịch sử log. | Đạt | |
| **SEC-04** | `employee` | `GET /api/v1/audit-logs` | 403 Forbidden | HTTP 403 Forbidden, chặn đúng quyền truy cập. | Đạt | |
| **SEC-05** | `employee` | `GET /api/v1/departments` | 200 OK | HTTP 200 OK, trả về danh sách phòng ban. | Đạt | |
| **SEC-06** | Không token | `GET /api/v1/departments` | 401 Unauthorized | HTTP 401 Unauthorized, yêu cầu đăng nhập. | Đạt | |
| **SEC-07** | `manager` | `GET /api/v1/departments/tree` | 200 OK | HTTP 200 OK, trả về cây phòng ban. | Đạt | |
| **SEC-08** | Không token | `GET /api/v1/departments/tree` | 401 Unauthorized | HTTP 401 Unauthorized. | Đạt | |
| **SEC-09** | `hr` | `GET /api/v1/departments/{id}` | 200 OK | HTTP 200 OK, trả về chi tiết phòng ban. | Đạt | |
| **SEC-10** | Không token | `GET /api/v1/departments/{id}` | 401 Unauthorized | HTTP 401 Unauthorized. | Đạt | |
| **SEC-11** | `admin` | `POST /api/v1/departments` (Body: `{"name": "IT", "code": "IT01", "office": "Hanoi"}`) | 201 Created | HTTP 201 Created, tạo phòng ban mới thành công. | Đạt | |
| **SEC-12** | `employee` | `POST /api/v1/departments` | 403 Forbidden | HTTP 403 Forbidden, chặn đúng quyền khởi tạo. | Đạt | |
| **SEC-13** | `hr` | `PATCH /api/v1/departments/{id}` | 200 OK | HTTP 200 OK, cập nhật phòng ban thành công. | Đạt | |
| **SEC-14** | `manager` | `PATCH /api/v1/departments/{id}` | 403 Forbidden | HTTP 403 Forbidden. | Đạt | |
| **SEC-15** | `employee` | `GET /api/v1/positions` | 200 OK | HTTP 200 OK, trả về danh sách chức danh. | Đạt | |
| **SEC-16** | Không token | `GET /api/v1/positions` | 401 Unauthorized | HTTP 401 Unauthorized. | Đạt | |
| **SEC-17** | `employee` | `GET /api/v1/me` | 200 OK | HTTP 200 OK, hiển thị đúng thông tin cá nhân. | Đạt | |
| **SEC-18** | Không token | `GET /api/v1/me` | 401 Unauthorized | HTTP 401 Unauthorized. | Đạt | |
| **SEC-19** | `manager` | `GET /api/v1/employees` | 200 OK | HTTP 200 OK, trả về danh sách nhân viên. | Đạt | |
| **SEC-20** | Không token | `GET /api/v1/employees` | 401 Unauthorized | HTTP 401 Unauthorized. | Đạt | |
| **SEC-21** | `hr` | `POST /api/v1/employees` | 201 Created | HTTP 201 Created, trả về hồ sơ E91270. | Đạt | Body gửi: `{"employeeCode":"E91270","fullName":"Nguyen Van Kiem Thu","workEmail":"sec21-e91270@hr.local","departmentId":"<UUID phòng ban>","positionId":"<UUID chức danh>","managerId":"<UUID của manager>","hireDate":"2026-11-01"}` (TV1 chạy thay, commit `dc68b37`) |
| **SEC-22** | `admin` | `POST /api/v1/employees` | 403 Forbidden | HTTP 403 Forbidden, chặn theo decorator hệ thống. | Đạt | |
| **SEC-23** | `employee` | `GET /api/v1/employees/{id_khác}` | 200 OK | HTTP 200 OK, chỉ hiển thị trường danh bạ cơ bản. | Đạt | |
| **SEC-24** | Không token | `GET /api/v1/employees/{id}` | 401 Unauthorized | HTTP 401 Unauthorized. | Đạt | |
| **SEC-25** | `employee` | `PATCH /api/v1/employees/{id_của_mình}` (Body: `{"phone": "0912345678"}`) | 200 OK | HTTP 200 OK, sửa hồ sơ cá nhân thành công. | Đạt | |
| **SEC-26** | `employee` | `PATCH /api/v1/employees/{id_khác}` | 403 Forbidden | HTTP 403 Forbidden, từ chối sửa hồ sơ người khác. | Đạt | |
| **SEC-27** | `manager` | `GET /api/v1/employees/{id}/direct-reports` | 200 OK | HTTP 200 OK, hiển thị danh sách cấp dưới. | Đạt | |
| **SEC-28** | Không token | `GET /api/v1/employees/{id}/direct-reports`| 401 Unauthorized | HTTP 401 Unauthorized. | Đạt | |
| **SEC-29** | `employee` | `GET /api/v1/departments/{id}/members` | 200 OK | HTTP 200 OK, hiển thị danh sách thành viên PB. | Đạt | |
| **SEC-30** | Không token | `GET /api/v1/departments/{id}/members` | 401 Unauthorized | HTTP 401 Unauthorized. | Đạt | |
| **SEC-31** | `hr` | `GET /api/v1/employees/{id}?include=sensitive`| 200 OK | HTTP 200 OK, trả về trường nhạy cảm đã giải mã. | Đạt | |
| **SEC-32** | `admin` | `GET /api/v1/employees/{id}?include=sensitive`| 403 Forbidden | HTTP 403 Forbidden, ADMIN không được đọc dữ liệu nhạy cảm. | Đạt | |
| **SEC-33** | `hr` | `PATCH /api/v1/employees/{id}` (Body: `{"nationalId": "012345678912"}`) | 200 OK | HTTP 200 OK, cập nhật trường nhạy cảm thành công. | Đạt | Body gửi: `{"nationalId": "012345678912", "version": <version hiện tại của hồ sơ>}` |
| **SEC-34** | `manager` | `PATCH /api/v1/employees/{id}` (Body: `{"nationalId": "012345678912"}`) | 403 Forbidden | HTTP 403 Forbidden. | Đạt | |
| **SEC-35** | `employee` | `GET /api/v1/leave-types` | 200 OK | HTTP 200 OK, hiển thị loại phép. | Đạt | |
| **SEC-36** | Không token | `GET /api/v1/leave-types` | 401 Unauthorized | HTTP 401 Unauthorized. | Đạt | |
| **SEC-37** | `hr` | `GET /api/v1/leave-holidays` | 200 OK | HTTP 200 OK, hiển thị danh sách ngày lễ. | Đạt | |
| **SEC-38** | Không token | `GET /api/v1/leave-holidays` | 401 Unauthorized | HTTP 401 Unauthorized. | Đạt | |
| **SEC-39** | `employee` | `GET /api/v1/leave-balances/me` | 200 OK | HTTP 200 OK, trả về số dư cá nhân. | Đạt | |
| **SEC-40** | Không token | `GET /api/v1/leave-balances/me` | 401 Unauthorized | HTTP 401 Unauthorized. | Đạt | |
| **SEC-41** | `employee` | `POST /api/v1/leave-requests` | 201 Created | HTTP 201 Created, đơn `SUBMITTED`. | Đạt | Body gửi: `{"leaveType":"ANNUAL","startDate":"2026-12-14","endDate":"2026-12-14","reason":"Kiem thu phan quyen"}`, header `Idempotency-Key` (TV1 chạy thay, commit `dc68b37`) |
| **SEC-42** | Không token | `POST /api/v1/leave-requests` | 401 Unauthorized | HTTP 401 Unauthorized. | Đạt | |
| **SEC-43** | `employee` | `GET /api/v1/leave-requests/me` | 200 OK | HTTP 200 OK, hiển thị danh sách đơn của mình. | Đạt | |
| **SEC-44** | Không token | `GET /api/v1/leave-requests/me` | 401 Unauthorized | HTTP 401 Unauthorized. | Đạt | |
| **SEC-45** | `manager` | `GET /api/v1/leave-requests/pending-approval`| 200 OK | HTTP 200 OK, lấy danh sách chờ duyệt thành công. | Đạt | |
| **SEC-46** | `employee` | `GET /api/v1/leave-requests/pending-approval`| 403 Forbidden | HTTP 403 Forbidden. | Đạt | |
| **SEC-47** | `hr` | `GET /api/v1/leave-requests` | 200 OK | HTTP 200 OK, lấy danh sách toàn hệ thống. | Đạt | |
| **SEC-48** | `manager` | `GET /api/v1/leave-requests` | 403 Forbidden | HTTP 403 Forbidden, giới hạn quyền HR. | Đạt | |
| **SEC-49** | `manager` | `GET /api/v1/leave-requests/{id}` | 200 OK | HTTP 200 OK, quản lý trực tiếp xem chi tiết đơn. | Đạt | |
| **SEC-50** | `employee` | `GET /api/v1/leave-requests/{id}` | 403 Forbidden | HTTP 403 Forbidden, chặn do không phải chủ đơn. | Đạt | |
| **SEC-51** | `manager` | `POST /api/v1/leave-requests/{id}/approve` | 200 OK | HTTP 200 OK, đơn chuyển `APPROVED`. | Đạt | Body gửi: `{"version":1,"comment":"Dong y duyet"}` (TV1 chạy thay, commit `dc68b37`) |
| **SEC-52** | `hr` | `POST /api/v1/leave-requests/{id}/approve` | 403 Forbidden | HTTP 403 Forbidden. | Đạt | |
| **SEC-53** | `manager` | `POST /api/v1/leave-requests/{id}/reject` | 200 OK | HTTP 200 OK, đơn chuyển `REJECTED`. | Đạt | Body gửi: `{"version":1,"comment":"Tu choi do trung lich"}` (TV1 chạy thay, commit `dc68b37`) |
| **SEC-54** | `admin` | `POST /api/v1/leave-requests/{id}/reject` | 403 Forbidden | HTTP 403 Forbidden. | Đạt | |
| **SEC-55** | `employee` | `POST /api/v1/leave-requests/{id}/cancel` | 200 OK | HTTP 200 OK, đơn chuyển `CANCELLED`. | Đạt | Body gửi: `{"version":1,"comment":"Da thu xep duoc cong viec"}` (TV1 chạy thay, commit `dc68b37`) |
| **SEC-56** | `manager` | `POST /api/v1/leave-requests/{id}/cancel` | 403 Forbidden | HTTP 403 Forbidden, chặn quản lý tự hủy. | Đạt | |
| **SEC-57** | `hr` | `POST /api/v1/leave-requests/{id}/complete`| 200 OK | HTTP 200 OK, đơn chuyển `COMPLETED`. | Đạt | Body gửi: `{"version":2,"comment":"Da cap nhat he thong"}` (TV1 chạy thay, commit `dc68b37`) |
| **SEC-58** | `manager` | `POST /api/v1/leave-requests/{id}/complete`| 403 Forbidden | HTTP 403 Forbidden. | Đạt | |