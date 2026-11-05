# Biên bản kiểm thử chức năng – tuần 8

## 1. Màn hình tuần 7

- **Ngày kiểm thử:** 31/10/2026
- **Người thực hiện:** TV1 (Duong), thay phần TV4 sau review PR #13. Bản nháp của TV4 (Duy) ở PR #13 được thay bằng kết quả
  chạy lại dưới đây.
- **Môi trường:** máy local, `docker compose up -d --build` từ nhánh `dev` (commit `3a75548`), dữ liệu seed 2000 nhân viên.
  Web http://localhost:5173, đăng nhập qua Keycloak http://localhost:8080.
- **Tài khoản:** `employee`, `manager`, `hr`, `admin`, mật khẩu `Passw0rd!`.
- **Người được xem trong các bước "Chi tiết nhân viên":** Trần Thị Nhân (`employee`, E00027), Nguyễn Văn Quản (`manager`,
  E00026), Bùi Bích Hạnh (E00670, phòng IT nội bộ, không liên quan tới 4 tài khoản demo).

### Tóm tắt

| Màn hình | `employee` | `manager` | `hr` | `admin` |
|---|---|---|---|---|
| Đăng nhập / đăng xuất | Đạt | Đạt | Đạt | Đạt |
| Hồ sơ của tôi | Đạt | Đạt | Đạt | Đạt |
| Danh bạ | Đạt | Đạt | Đạt | Đạt |
| Chi tiết nhân viên | Đạt | Đạt | Đạt | Đạt |
| Sơ đồ tổ chức | Đạt | Không kiểm riêng | Đạt | Đạt |

Không có lỗi chặn chức năng. Có 2 lỗi nhỏ về dữ liệu, ghi ở mục 1.3.

### 1.1 Chi tiết từng bước

| # | Tài khoản | Bước | Kết quả mong đợi | Kết quả thực tế | KQ |
|---|---|---|---|---|---|
| 1 | `employee` | Đăng nhập với mật khẩu sai | Keycloak báo lỗi, không vào được app | Keycloak hiện "Invalid username or password.", ở lại trang đăng nhập | Đạt |
| 2 | `employee` | Đăng nhập đúng mật khẩu | Vào trang "Hồ sơ của tôi" | Vào trang hồ sơ của Trần Thị Nhân, E00027, Web Engineering, quản lý trực tiếp Nguyễn Văn Quản | Đạt |
| 3 | `employee` | Xem số dư phép trên trang hồ sơ | Có bảng số dư 2026 | Bảng có Nghỉ phép năm và Nghỉ ốm, đủ cột được hưởng / đã dùng / chờ duyệt / còn lại | Đạt |
| 4 | `employee` | Sửa số điện thoại thành `0912 310310`, bấm Lưu | Lưu thành công | Hiện "Đã lưu"; mở lại hồ sơ (bước 13) thấy số mới | Đạt |
| 5 | `employee` | Nhập số điện thoại `abc`, bấm Lưu | Báo lỗi, không lưu | Hiện "Số điện thoại không hợp lệ (traceId: …)" | Đạt |
| 6 | `employee` | Mở Danh bạ | Danh sách có phân trang | "Trang 1/99 · 1970 người", 20 người mỗi trang, có lọc theo phòng ban | Đạt |
| 7 | `employee` | Tìm `employee@hr.local` | Ra đúng 1 người | "Trang 1/1 · 1 người", E00027 | Đạt |
| 8 | `employee` | Mở chi tiết Bùi Bích Hạnh (người ngoài) | Chỉ thấy thông tin danh bạ | Hiện "Bạn chỉ thấy thông tin danh bạ"; không có ngày sinh, địa chỉ, không có nút trường nhạy cảm | Đạt |
| 9 | `employee` | Mở Sơ đồ tổ chức, chọn Web Engineering | Cây phòng ban, xem được thành viên | Cây có gốc Ban Giám đốc; chọn Web Engineering hiện "119 thành viên · hiển thị 100 người đầu" | Đạt |
| 10 | `employee` | Đăng xuất rồi bấm Đăng nhập lại | Phải nhập lại mật khẩu | Về trang đăng nhập của app; bấm Đăng nhập thì Keycloak yêu cầu nhập lại tài khoản (phiên SSO đã kết thúc) | Đạt |
| 11 | `manager` | Đăng nhập | Vào hồ sơ của mình | Hồ sơ Nguyễn Văn Quản, Trưởng nhóm, Web Engineering | Đạt |
| 12 | `manager` | Tìm `employee@hr.local` trong Danh bạ | Ra đúng 1 người | Ra Trần Thị Nhân | Đạt |
| 13 | `manager` | Mở chi tiết Trần Thị Nhân (nhân viên trực thuộc) | Thấy thông tin cá nhân, không thấy trường nhạy cảm | Hiện "Bạn thấy thông tin cá nhân (chính mình hoặc nhân viên trực thuộc)"; có ngày sinh, địa chỉ, số điện thoại mới ở bước 4; không có nút trường nhạy cảm | Đạt |
| 14 | `manager` | Mở chi tiết Bùi Bích Hạnh | Chỉ thấy thông tin danh bạ | Hiện "Bạn chỉ thấy thông tin danh bạ", không có ngày sinh | Đạt |
| 15 | `manager` | Mở chi tiết của chính mình | Danh sách nhân viên trực thuộc | "Nhân viên trực thuộc (14)", có Trần Thị Nhân | Đạt |
| 16 | `hr` | Đăng nhập | Vào hồ sơ của mình | Hồ sơ Lê Thu Hằng, C&B (Lương thưởng) | Đạt |
| 17 | `hr` | Mở chi tiết Trần Thị Nhân, bấm "Xem trường nhạy cảm (sẽ ghi audit)" | Thấy toàn bộ hồ sơ và trường nhạy cảm đã giải mã | Hiện "Bạn là HR: thấy toàn bộ hồ sơ"; hiện CCCD (12 chữ số), số tài khoản, lương tháng | Đạt |
| 18 | `hr` | Mở Danh bạ và Sơ đồ tổ chức | Hiển thị như `employee` | Danh bạ 1970 người, cây phòng ban có Ban Giám đốc | Đạt |
| 19 | `admin` | Đăng nhập | Vào hồ sơ của mình | Hồ sơ Phạm Minh Quân, IT nội bộ | Đạt |
| 20 | `admin` | Mở chi tiết Trần Thị Nhân | Chỉ thấy thông tin danh bạ (ADMIN là quản trị kỹ thuật, không xem hồ sơ nhân sự) | Không có ngày sinh, không có nút trường nhạy cảm | Đạt |
| 21 | `admin` | Tìm `E00670` trong Danh bạ, mở Sơ đồ tổ chức | Hiển thị bình thường | "Trang 1/1 · 1 người"; cây phòng ban có Ban Giám đốc | Đạt |

### 1.2 Phạm vi chưa kiểm

- `manager` chưa kiểm riêng màn hình Sơ đồ tổ chức (cùng màn hình và cùng API với các tài khoản khác).
- Chưa kiểm lần ghi audit khi HR xem trường nhạy cảm qua giao diện (đã có e2e test kiểm `VIEW_SENSITIVE`).
- Chưa kiểm trên điện thoại hay trình duyệt khác.

### 1.3 Lỗi nhỏ phát hiện

| # | Mô tả | Mức độ | Ghi chú |
|---|---|---|---|
| L-01 | Danh sách phòng ban (bộ lọc Danh bạ và Sơ đồ tổ chức) có 2 dòng "Phòng test" | Thấp | Do e2e test (`test/app.e2e-spec.ts`, ca "HR tạo được phòng ban") tạo phòng ban trên DB dùng chung với demo mà không dọn lại |
| L-02 | Hồ sơ `admin` có ngày sinh 25/09/2004 nhưng ngày vào làm 22/04/2015 (vào làm khi 10 tuổi) | Thấp | Seed sinh ngày sinh và ngày vào làm ngẫu nhiên độc lập; cần ràng buộc ngày vào làm sau ngày sinh ít nhất 18 năm |

Mỗi lỗi cần được mở issue trên GitHub để theo dõi.

## 2. Màn hình nghỉ phép

| # | Mã TC | Tài khoản | Bước | Kết quả mong đợi | Kết quả thực tế | KQ | Ghi chú |
|---|---|---|---|---|---|---|---|
| 1 | TC-01 | employee | Chọn loại phép ANNUAL, chọn 05/11/2026 - 07/11/2026 (2 ngày), lý do "cưới". Bấm Gửi đơn. | Đơn tạo thành công, trạng thái SUBMITTED, HTTP 201 Created. Có gửi email cho manager. | Đơn tạo thành công, trạng thái "Chờ duyệt". Có nhận được email gửi tới manager@hr.local. Số dư phép sau khi xin: 11 | Đạt | |
| 2 | TC-02 | employee | F12 mở Network. Chọn loại phép ANNUAL, xin nghỉ từ 10/11/2026 đến 30/11/2026 (cần 14 ngày, vượt số dư 11 ngày). Bấm Gửi đơn. | API chặn, trả về HTTP 400 Bad Request (Không đủ số dư). | Giao diện hiện lỗi đỏ "Không đủ số dư". API trả về mã 400 Bad Request. Đơn không được tạo. | Đạt | |
| 3 | TC-03 | employee | F12 mở Network. Chọn loại phép ANNUAL, xin nghỉ từ 05/11/2026 đến 07/11/2026 (trùng với đơn đang chờ duyệt). Bấm Gửi đơn. | API chặn, trả về HTTP 409 Conflict (Trùng lịch). | Giao diện báo lỗi đỏ trùng lịch với đơn đang SUBMITTED. API trả về mã 409 Conflict. Đơn không được tạo. | Đạt | |
| 4 | TC-04 | employee | Chọn loại phép ANNUAL, xin nghỉ từ 05/11/2026 đến 07/11/2026 (trùng lịch). Bấm Gửi đơn. | API trả về HTTP 409 Conflict do trùng khoảng thời gian nghỉ phép đã tồn tại. | Hệ thống chặn thành công, trả về HTTP 409 Conflict, thông báo trùng lịch. | Đạt | |
| 5 | TC-05 | manager | Đăng nhập manager, vào Duyệt đơn. Chọn đơn đang SUBMITTED của employee, bấm Duyệt. | Trạng thái chuyển APPROVED, HTTP 200 OK. Có gửi email thông báo. | Đơn chuyển sang trạng thái APPROVED thành công. API trả về 200 OK. Kiểm tra Mailpit có email thông báo. | Đạt | |
| 6 | TC-06 | manager | Đăng nhập manager, vào Duyệt đơn. Chọn đơn đang SUBMITTED, bấm Từ chối, nhập lý do. | Trạng thái chuyển REJECTED, HTTP 200 OK. Có gửi email thông báo. | Đơn chuyển sang trạng thái REJECTED thành công. API trả về 200 OK. Kiểm tra Mailpit có email từ chối. | Đạt | |
| 7 | TC-07 | manager | Dùng Swagger, gọi API duyệt đơn `POST /api/v1/leave-requests/{id}/approve` liên tiếp 2 lần với cùng một ID đơn chờ duyệt. | Lần 1 thành công (200 OK), lần 2 lặp lại quyết định trả 200 OK (không đổi gì theo BR-11). | Cả 2 lần gọi đều trả về HTTP 200 OK thành công, trạng thái giữ nguyên không bị lỗi xung đột 409. | Đạt | Đã chỉnh lại theo phản hồi: duyệt lặp lại không đổi gì (BR-11). |
| 8 | TC-08 | employee | Dùng tài khoản employee, gửi yêu cầu hủy đơn ở trạng thái SUBMITTED. | Đơn chuyển sang trạng thái CANCELLED, HTTP 200 OK. | Đơn nghỉ phép đã được hủy thành công. API trả về 200 OK. | Đạt | |
| 9 | TC-09 | employee | Dùng Swagger, gọi API hủy đơn đối với một đơn đã ở trạng thái APPROVED (`POST /api/v1/leave-requests/{id}/cancel`). | Hệ thống từ chối hủy, trả về mã lỗi 400/409. | API chặn thành công, trả về HTTP 409 Conflict, đơn giữ nguyên trạng thái APPROVED. | Đạt | Đã sửa lại đúng kiểm tra qua API (thay vì chỉ kiểm tra giao diện). |
| 10 | TC-10 | employee | Dùng Swagger, gọi API hủy đơn của người khác. | Trả về HTTP 403 Forbidden do vi phạm phân quyền. | Hệ thống chặn thành công, trả về HTTP 403 Forbidden. | Đạt | |
| 11 | TC-11 | employee | Xem chi tiết và lịch sử thay đổi một đơn nghỉ phép bất kỳ. | Hiển thị đầy đủ thông tin chi tiết và lịch sử, HTTP 200 OK. | Giao diện hiển thị chính xác thông tin và lịch sử thay đổi. API trả về 200 OK. | Đạt | |
| 12 | TC-12 | employee | Lọc danh sách đơn nghỉ phép theo các trạng thái khác nhau. | Danh sách lọc chính xác theo trạng thái, API trả về 200 OK. | Tính năng lọc hoạt động chính xác, request đính kèm tham số `status` hợp lệ. | Đạt | |
| 13 | TC-13 | employee | Truy cập trang quản lý đơn nghỉ phép kiểm tra phân trang dữ liệu. | Hiển thị danh sách chính xác, API trả về 200 OK. | Danh sách tải đầy đủ bản ghi, trả về mã HTTP 200 OK. | Đạt | |
| 14 | TC-14 | employee/manager | Dùng Swagger gọi API lấy danh sách ngày lễ theo năm (`GET /api/v1/leave-holidays?year=2026`). | Trả về danh sách ngày lễ, HTTP 200 OK. | API trả về dữ liệu JSON đầy đủ các dịp lễ kèm mã trạng thái 200 OK. | Đạt | |
| 15 | TC-15 | employee | Dùng Swagger gọi API xem số dư ngày phép cá nhân (`GET /api/v1/leave-balances/me`). | Trả về thông tin số dư các loại phép, HTTP 200 OK. | API trả về dữ liệu số dư phép chính xác kèm mã trạng thái 200 OK. | Đạt | |
| 16 | TC-16 | manager | Dùng Swagger gọi API từ chối đơn đã được duyệt (`POST /api/v1/leave-requests/{id}/reject`). | Trả về mã lỗi 409 Conflict, đơn giữ nguyên trạng thái APPROVED. | API chặn thành công, trả về mã trạng thái 409 Conflict. | Đạt | |
| 17 | TC-17 | employee | Tạo mới đơn nghỉ phép (SUBMITTED), thực hiện hủy đơn qua API. | Trả về HTTP 200 OK, đơn chuyển sang CANCELLED, số dư chờ duyệt giảm. | Hệ thống cập nhật trạng thái thành công, trả về HTTP 200 OK, số dư chờ duyệt giảm chính xác. | Đạt | |
| 18 | TC-18 | employee | Dùng Swagger gọi API hủy đơn đang ở trạng thái APPROVED. | Trả về mã lỗi 409 Conflict, giữ nguyên trạng thái APPROVED, số dư không đổi. | Hệ thống chặn thành công, trả về HTTP 409 Conflict, số dư không đổi. | Đạt | |
| 19 | TC-19 | manager | Dùng tài khoản khác không phải chủ đơn gọi API hủy đơn SUBMITTED. | Trả về mã lỗi 403 Forbidden do không đủ quyền hạn. | Hệ thống kiểm tra phân quyền thành công, trả về HTTP 403 Forbidden. | Đạt | |
| 20 | TC-20 | hr | Dùng Swagger đăng nhập tài khoản hr gọi API hoàn tất đơn đang ở trạng thái APPROVED (`POST /api/v1/leave-requests/{id}/complete`). | Trả về HTTP 200 OK, đơn chuyển COMPLETED, số dư phép cập nhật chính xác. | Hệ thống hoàn tất đơn thành công, trả về HTTP 200 OK, cập nhật trạng thái và số dư phép. | Đạt | |
| 21 | TC-21 | hr | Dùng tài khoản hr gọi API hoàn tất đơn đang ở trạng thái SUBMITTED (chưa duyệt). | Trả về mã lỗi 409 Conflict, đơn giữ nguyên trạng thái SUBMITTED. | Hệ thống chặn thành công, trả về mã lỗi 409 Conflict. | Đạt | |
| 22 | TC-22 | employee | Dùng tài khoản employee/manager cố gắng gọi API hoàn tất đơn APPROVED. | Trả về mã lỗi 403 Forbidden do vi phạm phân quyền. | Hệ thống kiểm tra phân quyền thành công, trả về HTTP 403 Forbidden. | Đạt | |