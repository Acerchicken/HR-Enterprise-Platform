# Biên bản kiểm thử chức năng – tuần 8

## 1. Màn hình tuần 7

- **Ngày kiểm thử:** 31/10/2026
- **Người thực hiện:** TV1 (Duong), thay phần TV4 sau review PR #13. Bản nháp của TV4 (Duy) ở PR #13 được thay bằng kết quả chạy lại dưới đây.
- **Môi trường:** máy local, `docker compose up -d --build` từ nhánh `dev` (commit `3a75548`), dữ liệu seed 2000 nhân viên. Web http://localhost:5173, đăng nhập qua Keycloak http://localhost:8080.
- **Tài khoản:** `employee`, `manager`, `hr`, `admin`, mật khẩu `Passw0rd!`.
- **Người được xem trong các bước "Chi tiết nhân viên":** Trần Thị Nhân (`employee`, E00027), Nguyễn Văn Quản (`manager`, E00026), Bùi Bích Hạnh (E00670, phòng IT nội bộ, không liên quan tới 4 tài khoản demo).

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
| 19 | `admin` | Đăng nhập | Vào hồ sơ của mình | Hồ sơ Phạm Minh Quân, IT nội보 | Đạt |
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

---

## 2. Màn hình nghỉ phép (TC-01 → TC-22)

- **Môi trường:** Local (Web UI + Mailpit)
- **Ngày kiểm thử:** 08/11/2026
- **Commit:** `a191a74`
- **Người thực hiện:** Duy (TV4)

| # | Mã TC | Tài khoản | Bước thực hiện / Kịch bản | Kết quả mong đợi | Kết quả thực tế quan sát được | KQ | Ghi chú / Số dư |
|---|---|---|---|---|---|---|---|
| 1 | **TC-01** | `employee` | Tạo đơn phép năm (ANNUAL) từ 09/11/2026 đến 10/11/2026 | 201 Created, đơn `SUBMITTED`, `days` = 2 | Khớp thiết kế, đơn chuyển `SUBMITTED`, gửi kèm Idempotency-Key | Đạt | Số dư trước: 10 -> Sau: pending +2 |
| 2 | **TC-02** | `employee` | Gửi lại request TC-01 cùng Idempotency-Key | Trả về đúng đơn cũ, không tạo đơn mới, pending không tăng | Khớp thiết kế, Idempotency-Key hoạt động tốt | Đạt | |
| 3 | **TC-03** | `employee` | Tạo đơn vượt quá số dư phép (01/12 - 31/12/2026) | 400 Bad Request, báo "Không đủ số dư" | Khớp thiết kế, chặn thành công | Đạt | |
| 4 | **TC-04** | `employee` | Tạo đơn trùng lịch với đơn đang chờ (10/11 - 11/11/2026) | 409 Conflict, trùng ngày với đơn `SUBMITTED` | Khớp thiết kế, chặn thành công | Đạt | |
| 5 | **TC-05** | `employee` | Tạo đơn qua kỳ nghỉ lễ 30/4–1/5 (29/04 - 04/05/2026) | 201 Created, `days` = 2 (tính đúng ngày lễ và cuối tuần) | Khớp thiết kế, tính đúng số ngày làm việc | Đạt | |
| 6 | **TC-06** | `employee` | Tạo đơn chỉ gồm ngày nghỉ bù 27/04/2026 | 400 Bad Request, báo không có ngày làm việc | Khớp thiết kế, chặn thành công | Đạt | |
| 7 | **TC-07** | `employee` | Tạo đơn chỉ gồm cuối tuần (14/11 - 15/11/2026) | 400 Bad Request, 0 ngày làm việc | Khớp thiết kế, chặn thành công | Đạt | |
| 8 | **TC-08** | `employee` | Tạo 2 nửa ngày khác buổi cùng ngày (16/11/2026 AM và PM) | Cả hai 201 Created, mỗi đơn `days` = 0,5 | Khớp thiết kế, ghi nhận chính xác buổi | Đạt | |
| 9 | **TC-09** | `employee` | Tạo đơn cả ngày trùng với nửa ngày đã gửi (13/11 - 16/11) | 409 Conflict, trùng ngày 16/11 | Khớp thiết kế, chặn thành công | Đạt | |
| 10 | **TC-10** | `employee` | Test dữ liệu sai (ngày sai, nửa ngày khác ngày, thiếu key...) | 400 Bad Request cho tất cả các trường hợp | Khớp thiết kế, trả về lỗi chuẩn | Đạt | |
| 11 | **TC-11** | `manager` | Quản lý trực tiếp duyệt đơn (`APPROVED`) cho TC-01 | 200 OK, đơn `APPROVED`, `approverId` = manager | Khớp thiết kế, giữ số dư trong pending | Đạt | Số dư pending giữ nguyên |
| 12 | **TC-12** | `hr`, `employee` | Người không phải quản lý trực tiếp gọi duyệt đơn | 403 Forbidden cho cả hai, đơn giữ `SUBMITTED` | Khớp thiết kế, phân quyền đúng | Đạt | |
| 13 | **TC-13** | `manager` | Gửi lại yêu cầu duyệt lần hai cho đơn đã duyệt | 200 OK, đơn vẫn `APPROVED`, version/số dư không đổi | Khớp thiết kế, xử lý an toàn | Đạt | |
| 14 | **TC-14** | `manager` | Duyệt đơn với version cũ không khớp | 409 Conflict, đơn không đổi | Khớp thiết kế, Optimistic locking hoạt động | Đạt | |
| 15 | **TC-15** | `manager` | Quản lý trực tiếp từ chối đơn 1 ngày, kèm comment | 200 OK, đơn `REJECTED`, pending giảm 1 | Khớp thiết kế, lịch sử lưu comment | Đạt | Số dư pending giảm 1 |
| 16 | **TC-16** | `manager` | Từ chối đơn đã được duyệt (`APPROVED`) | 409 Conflict, đơn giữ `APPROVED` | Khớp thiết kế, chặn thành công | Đạt | |
| 17 | **TC-17** | `employee` | Nhân viên hủy đơn đang chờ duyệt (`SUBMITTED`) | 200 OK, đơn `CANCELLED`, pending giảm | Khớp thiết kế, hoàn lại số dư pending | Đạt | Số dư pending giảm tương ứng |
| 18 | **TC-18** | `employee` | Nhân viên hủy đơn đã được duyệt (`APPROVED`) | 409 Conflict, đơn giữ nguyên trạng thái | Khớp thiết kế, chặn đúng quy trình | Đạt | |
| 19 | **TC-19** | `manager` | Người khác (không phải chủ đơn) gọi hủy đơn | 403 Forbidden, chặn quyền | Khớp thiết kế, phân quyền đúng | Đạt | |
| 20 | **TC-20** | `hr` | HR hoàn tất đơn đã duyệt (`COMPLETED`) | 200 OK, đơn `COMPLETED`, pending giảm, used tăng | Khớp thiết kế, ghi đủ audit logs | Đạt | Pending giảm, used tăng 2 |
| 21 | **TC-21** | `hr` | HR gọi hoàn tất đơn chưa duyệt (`SUBMITTED`) | 409 Conflict, đơn giữ nguyên | Khớp thiết kế, chặn luồng sai trạng thái | Đạt | |
| 22 | **TC-22** | `employee`, `manager` | Không phải HR cố ý gọi API hoàn tất đơn | 403 Forbidden, chặn quyền | Khớp thiết kế, phân quyền chuẩn | Đạt | |

### Phạm vi chưa kiểm
- Chưa kiểm tra luồng người duyệt thay (Delegation theo BR-06) do tính năng này chưa được tích hợp vào hệ thống hiện tại (như đã ghi chú trong `leave-test-cases.md`).
- Chưa kiểm tra các thông báo đẩy (notifications) qua email real-time trên Mailpit ở một số ngoại lệ mạng chậm.