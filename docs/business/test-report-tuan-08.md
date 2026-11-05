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
| 1 | TC-01 | employee | Chọn loại phép ANNUAL, chọn 05/11/2026 - 07/11/2026 (2 ngày), lý do "cưới". Bấm Gửi đơn. | Đơn tạo thành công, trạng thái SUBMITTED, HTTP 201 Created. Có gửi email cho manager. | Đơn tạo thành công, trạng thái "Chờ duyệt". Có nhận được email gửi tới manager@hr.local với tiêu đề "[HR] Đơn nghỉ phép mới chờ duyệt...". Số dư phép sau khi xin: 11 | Đạt | |

| 2 | TC-02 | employee | F12 mở Network. Chọn loại phép ANNUAL, xin nghỉ từ 10/11/2026 đến 30/11/2026 (cần 14 ngày, vượt số dư 11 ngày). Bấm Gửi đơn. | API chặn, trả về HTTP 400 Bad Request (Không đủ số dư). | Giao diện hiện lỗi đỏ "Không đủ số dư: cần 14 ngày, còn 11 ngày". API trả về mã 400 Bad Request. Đơn không được tạo. | Đạt | |

| 3 | TC-03 | employee | F12 mở Network. Chọn loại phép ANNUAL, xin nghỉ từ 05/11/2026 đến 07/11/2026 (trùng với đơn đang chờ duyệt). Bấm Gửi đơn. | API chặn, trả về HTTP 409 Conflict (Trùng lịch). | Giao diện báo lỗi đỏ trùng lịch với đơn đang SUBMITTED. API trả về mã 409 Conflict. Đơn không được tạo. | Đạt | |

| 4 | TC-04 | employee | Chọn loại phép ANNUAL, xin nghỉ từ 12/11/2026 đến 12/11/2026, chọn ca Sáng. Bấm Gửi đơn. | Đơn tạo thành công, trạng thái SUBMITTED. Hệ thống trừ đúng số ngày phép. | Đơn tạo thành công, hiển thị "12/11/2026 (sáng)", số ngày: 0.5, trạng thái Chờ duyệt. API trả về 201 Created. Số dư phép giảm 0.5 ngày (còn 10.5 ngày). | Đạt | |

| 5 | TC-05 | manager | Đăng nhập manager, vào Duyệt đơn. Chọn đơn đang SUBMITTED của employee (đơn 2 ngày), bấm Duyệt. | Trạng thái chuyển APPROVED, HTTP 200 OK. Có gửi email thông báo. | Đơn chuyển sang trạng thái APPROVED thành công. API trả về 200 OK. Kiểm tra Mailpit có email thông báo gửi tới nhân viên. | Đạt | |

| 6 | TC-06 | manager | Đăng nhập manager, vào Duyệt đơn. Chọn đơn nửa ngày đang SUBMITTED, bấm Từ chối, nhập lý do. | Trạng thái chuyển REJECTED, HTTP 200 OK. Có gửi email thông báo. | Đơn chuyển sang trạng thái REJECTED thành công. API trả về 200 OK. Kiểm tra Mailpit có email từ chối gửi tới nhân viên. | Đạt | |

| 7 | TC-07 | manager | Đăng nhập manager, vào Duyệt đơn, kiểm tra các tùy chọn thao tác trên đơn đang SUBMITTED. | Đơn bị đẩy lại trạng thái chờ sửa, HTTP 200 OK. | Giao diện hiện tại chỉ có 2 nút "Duyệt" và "Từ chối", thiếu nút/chức năng "Trả về để sửa" (Return for edit). | Không đạt | Thiếu tính năng trên giao diện UI, cần mở Issue báo cáo. |

| 8 | TC-08 | manager | Dùng Swagger, gọi API duyệt đơn (`POST /api/v1/leave-requests/{id}/approve`) liên tiếp 2 lần với cùng một ID đơn chờ duyệt. | Lần 1 thành công (200 OK), lần 2 bị chặn với lỗi Conflict (409). | Lần gọi đầu tiên thành công, đơn được duyệt. Lần gọi thứ hai ngay sau đó bị hệ thống từ chối, trả về mã HTTP 409 Conflict kèm thông báo "Đơn đã được người khác cập nhật, hãy tải lại". Chống double-click/lặp lệnh thành công. | Đạt | |

| 9 | TC-09 | employee | Đăng nhập tài khoản employee, tạo một đơn nghỉ phép mới, sau đó bấm nút Hủy đơn khi đơn đang ở trạng thái chờ duyệt. | Đơn chuyển sang trạng thái Đã hủy, HTTP 200 OK. | Đơn nghỉ phép đã được hủy thành công trên giao diện. Lịch sử cập nhật trạng thái từ "Chờ duyệt" sang "Đã hủy" chính xác, API trả về 200 OK. | Đạt | |

| 10 | TC-10 | employee | Đăng nhập tài khoản employee, kiểm tra các đơn đã được duyệt/từ chối hoặc dùng API gọi hủy đơn đã duyệt. | Hệ thống từ chối hủy, trả về mã lỗi (400/409). | Giao diện đã ẩn nút "Hủy đơn" đối với các đơn không còn ở trạng thái chờ duyệt. Đảm bảo tính toàn vẹn dữ liệu. | Đạt | |

| 11 | TC-11 | employee | Đăng nhập tài khoản employee, chọn một đơn nghỉ phép bất kỳ trong danh sách để xem chi tiết và lịch sử thay đổi. | Hiển thị đầy đủ thông tin chi tiết và lịch sử, HTTP 200 OK. | Giao diện hiển thị chính xác các thông tin của đơn (loại phép, thời gian, lý do, trạng thái) và phần lịch sử thay đổi trạng thái theo thời gian thực. API trả về 200 OK. | Đạt | |

| 12 | TC-12 | employee | Đăng nhập tài khoản employee, vào danh sách đơn nghỉ phép và chọn lọc theo các trạng thái khác nhau (Chờ duyệt, Đã duyệt, Đã hủy, v.v.). | Danh sách lọc chính xác theo trạng thái, API trả về 200 OK. | Tính năng lọc đơn theo trạng thái hoạt động chính xác trên giao diện. Các request gửi lên server đính kèm tham số `status` hợp lệ và trả về dữ liệu đúng yêu cầu. | Đạt | |

| 13 | TC-13 | employee | Đăng nhập tài khoản employee, truy cập trang quản lý đơn nghỉ phép để kiểm tra hiển thị danh sách và cơ chế phân trang dữ liệu. | Hiển thị danh sách chính xác, API trả về 200 OK. | Danh sách đơn nghỉ phép tải và hiển thị đầy đủ các bản ghi. Các request gọi dữ liệu danh sách hoạt động ổn định, trả về mã HTTP 200 OK thành công. | Đạt | |

| 14 | TC-14 | employee/manager | Dùng Swagger, gọi API lấy danh sách ngày lễ theo năm (`GET /api/v1/leave-holidays?year=2026`) với token hợp lệ. | Trả về danh sách các ngày lễ trong năm 2026, HTTP 200 OK. | API lấy danh sách ngày lễ hoạt động chính xác, trả về dữ liệu JSON đầy đủ các dịp lễ (Tết Dương lịch, Tết Nguyên đán,...) kèm mã trạng thái 200 OK. | Đạt | |

| 15 | TC-15 | employee | Dùng Swagger, gọi API xem số dư ngày phép cá nhân (`GET /api/v1/leave-balances/me`) với token hợp lệ. | Trả về thông tin số dư các loại phép, HTTP 200 OK. | API trả về dữ liệu số dư phép của nhân viên chính xác, chi tiết từng loại (phép năm, nghỉ ốm,...) kèm mã trạng thái 200 OK thành công. | Đạt | |

| 16 | TC-16 | manager | Dùng Swagger, gọi API từ chối đơn đã được duyệt (`POST /api/v1/leave-requests/{id}/reject`) với token hợp lệ của quản lý và đơn đang ở trạng thái `APPROVED`. | Trả về mã lỗi 409 Conflict, đơn giữ nguyên trạng thái `APPROVED`. | API chặn thành công thao tác từ chối đơn đã được duyệt, trả về mã trạng thái 409 Conflict với thông báo `"Đơn đang ở trạng thái APPROVED, không thể reject"`. | Đạt | |

| 17 | TC-17 | employee | Dùng giao diện web, tạo mới đơn nghỉ phép (trạng thái `SUBMITTED`), sau đó thực hiện bấm hủy đơn (`POST /api/v1/leave-requests/{id}/cancel`). | Trả về mã HTTP 200 OK, đơn chuyển sang trạng thái `CANCELLED`, số ngày phép chờ duyệt (`pending`) giảm. | Hệ thống cập nhật trạng thái đơn thành công sang `CANCELLED`, trả về HTTP 200 OK và số dư phép chờ duyệt (`pending`) giảm chính xác tương ứng. | Đạt | |

| 18 | TC-18 | employee | Dùng Swagger, gọi API hủy đơn đối với một đơn nghỉ phép đang ở trạng thái `APPROVED` (`POST /api/v1/leave-requests/{id}/cancel`). | Trả về mã lỗi 409 Conflict, đơn giữ nguyên trạng thái `APPROVED`, số dư không đổi. | Hệ thống chặn thành công thao tác hủy đơn đã duyệt, trả về HTTP 409 Conflict, đơn giữ nguyên trạng thái `APPROVED` và số dư phép không thay đổi. | Đạt | |

| 19 | TC-19 | manager | Dùng Swagger, đăng nhập bằng tài khoản `manager` (hoặc tài khoản khác không phải chủ đơn) và gọi API hủy đơn `POST /api/v1/leave-requests/{id}/cancel` trên đơn đang ở trạng thái `SUBMITTED` của `employee`. | Trả về mã lỗi 403 Forbidden do không đủ quyền hạn. | Hệ thống kiểm tra phân quyền thành công, trả về HTTP 403 Forbidden và từ chối cho phép người dùng khác hủy đơn của nhân viên. | Đạt | |

| 20 | TC-20 | hr | Dùng Swagger, đăng nhập bằng tài khoản `hr` và gọi API hoàn tất đơn `POST /api/v1/leave-requests/{id}/complete` đối với đơn đang ở trạng thái `APPROVED`. | Trả về HTTP 200 OK, đơn chuyển sang trạng thái `COMPLETED`, số dư phép cập nhật chính xác. | Hệ thống thực hiện hoàn tất đơn thành công, trả về HTTP 200 OK, trạng thái đơn cập nhật thành `COMPLETED` và số dư phép được tính toán chính xác. | Đạt | |

| 21 | TC-21 | hr | Dùng Swagger, đăng nhập bằng tài khoản `hr` và gọi API hoàn tất đơn `POST /api/v1/leave-requests/{id}/complete` đối với đơn đang ở trạng thái `SUBMITTED` (chưa duyệt). | Trả về mã lỗi 409 Conflict, đơn giữ nguyên trạng thái `SUBMITTED`. | Hệ thống chặn thành công thao tác hoàn tất đơn chưa qua phê duyệt, trả về HTTP 409 Conflict và giữ nguyên trạng thái đơn. | Đạt | |

| 22 | TC-22 | employee | Dùng Swagger, đăng nhập bằng tài khoản `employee` (hoặc `manager`) và cố gắng gọi API hoàn tất đơn `POST /api/v1/leave-requests/{id}/complete` trên một đơn đang ở trạng thái `APPROVED`. | Trả về mã lỗi 403 Forbidden do vi phạm phân quyền. | Hệ thống kiểm tra phân quyền tài khoản thành công, trả về HTTP 403 Forbidden và chặn người dùng không phải HR thực hiện hoàn tất đơn. | Đạt | |
