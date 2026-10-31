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

_TV4 kiểm thử chủ nhật (1/11) theo [`leave-test-cases.md`](leave-test-cases.md) sau khi `feat/leave-ui` vào `dev`._
