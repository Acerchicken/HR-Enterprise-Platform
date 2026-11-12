# Biên bản kiểm thử chức năng – tuần 8

> Biên bản kiểm thử: kết quả chạy thật, kiểm chứng [SRS](../requirements/SRS.md). Bộ tài liệu: [`docs/README.md`](../README.md).

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

- **Ngày kiểm thử:** 08/11/2026
- **Người thực hiện:** TV1 (Duong) chạy thay TV4 theo quyết định của nhóm trưởng, sau review PR #54. Bản do TV4 ghi trước đó chưa có kết quả quan sát được nên được thay bằng lần chạy này.
- **Môi trường:** máy local, `docker compose up -d --build` từ nhánh `dev` (commit `efaa902`), `npm run seed -- --reset` (2000 nhân viên). Web http://localhost:5173, đăng nhập thật qua Keycloak, email xem trên Mailpit.
- **Cách chạy:** script Playwright điều khiển Chrome headless trên giao diện thật với các ca có nút trên giao diện. Các ca giao diện không có thao tác tương ứng (gửi lại cùng key, thiếu header, sai quyền, version cũ, thao tác lên đơn đã duyệt) gọi API bằng access token thật của tài khoản đó.
- **Tài khoản:** `employee`, `manager`, `hr`. Số dư là dòng "Nghỉ phép năm" trên trang Hồ sơ của tôi.
- **Thứ tự:** chạy lần lượt trong một phiên, TC-20 chạy sau TC-22 vì cần đơn `APPROVED`.

| # | Mã TC | Tài khoản | Bước | Kết quả mong đợi | Kết quả thực tế | KQ |
|---|---|---|---|---|---|---|
| 1 | TC-01 | employee | Giao diện: Tạo đơn phép năm hợp lệ. `ANNUAL`, 09/11/2026 (T2) – 10/11/2026 (T3), lý do "Việc gia đình" | 201. Đơn `SUBMITTED`, `days` = 2. Số dư: `pending` +2, `used` không đổi | HTTP 201; chuyển sang trang chi tiết, trạng thái "Chờ duyệt", Số ngày 2; trước: được hưởng 14, đã dùng 1, chờ duyệt 0, còn lại 13; sau: được hưởng 14, đã dùng 1, chờ duyệt 2, còn lại 11; email: manager@hr.local: [HRHelper] Đơn nghỉ phép mới chờ duyệt – Trần Thị Nhân, 09/11/2026 – 10/11/2026 | Đạt |
| 2 | TC-02 | employee | API: Gửi lại cùng Idempotency-Key. Gửi lại đúng request TC-01, cùng key | Trả về đúng đơn của TC-01 (cùng `id`), không tạo đơn mới, `pending` không tăng thêm | HTTP 201; cùng id: true; chờ duyệt 2; email: không có email mới | Đạt |
| 3 | TC-03 | employee | Giao diện: Không đủ số dư. `ANNUAL`, 01/12/2026 – 31/12/2026 (23 ngày làm việc) | 400 "Không đủ số dư". Không tạo đơn, số dư không đổi | HTTP 400; màn hình báo "Không đủ số dư: cần 23 ngày, còn 11 ngày"; chờ duyệt 2 | Đạt |
| 4 | TC-04 | employee | Giao diện: Trùng lịch với đơn đang chờ. Sau TC-01: `ANNUAL`, 10/11/2026 – 11/11/2026 | 409. Có chung ngày 10/11 với đơn `SUBMITTED` của TC-01 | HTTP 409; màn hình báo "Trùng lịch với đơn 2026-11-09 – 2026-11-10 đang SUBMITTED" | Đạt |
| 5 | TC-05 | employee | Giao diện: Đơn qua kỳ nghỉ lễ 30/4–1/5. `ANNUAL`, 29/04/2026 (T4) – 04/05/2026 (T2) | 201, `days` = 2 (29/4 và 4/5). 30/4, 1/5 là ngày lễ, 2–3/5 là cuối tuần | HTTP 201; chuyển sang trang chi tiết, trạng thái "Chờ duyệt", Số ngày 2; days=2; email: manager@hr.local: [HRHelper] Đơn nghỉ phép mới chờ duyệt – Trần Thị Nhân, 29/04/2026 – 04/05/2026 | Đạt |
| 6 | TC-06 | employee | Giao diện: Đơn chỉ gồm ngày nghỉ bù 27/4. `ANNUAL`, 27/04/2026 – 27/04/2026 | 400 "Khoảng nghỉ không có ngày làm việc nào". Không tạo đơn | HTTP 400; màn hình báo "Khoảng nghỉ không có ngày làm việc nào (cuối tuần hoặc ngày lễ)" | Đạt |
| 7 | TC-07 | employee | Giao diện: Đơn chỉ gồm cuối tuần. `ANNUAL`, 14/11/2026 (T7) – 15/11/2026 (CN) | 400, 0 ngày làm việc | HTTP 400; màn hình báo "Khoảng nghỉ không có ngày làm việc nào (cuối tuần hoặc ngày lễ)" | Đạt |
| 8 | TC-08 | employee | Giao diện: Hai nửa ngày khác buổi cùng ngày. Đơn 1: 16/11/2026 buổi sáng (`AM`); đơn 2: 16/11/2026 buổi chiều (`PM`) | Cả hai 201, mỗi đơn `days` = 0,5 | AM HTTP 201, days=0.5; PM HTTP 201, days=0.5; email: manager@hr.local: [HRHelper] Đơn nghỉ phép mới chờ duyệt – Trần Thị Nhân, 16/11/2026 (buổi chiều) ; manager@hr.local: [HRHelper] Đơn nghỉ phép mới chờ duyệt – Trần Thị Nhân, 16/11/2026 (buổi sáng) | Đạt |
| 9 | TC-09 | employee | Giao diện: Cả ngày trùng với nửa ngày đã gửi. Sau TC-08: `ANNUAL`, 13/11/2026 – 16/11/2026 | 409, trùng ngày 16/11 | HTTP 409; màn hình báo "Trùng lịch với đơn 2026-11-16 – 2026-11-16 đang SUBMITTED" | Đạt |
| 10 | TC-10 | employee | API: Dữ liệu sai. (a) ngày kết thúc trước ngày bắt đầu; (b) nửa ngày nhưng hai ngày khác nhau; (c) loại phép không tồn tại; (d) thiếu header `Idempotency-Key` | 400 cho cả 4 trường hợp | (a) 400 Ngày kết thúc phải sau hoặc bằng ngày bắt đầu ; (b) 400 Nghỉ nửa ngày chỉ áp dụng cho một ngày ; (c) 400 Loại phép không tồn tại ; (d) 400 Thiếu header Idempotency-Key (tối đa 100 ký tự) | Đạt |
| 11 | TC-11 | manager | Giao diện: Quản lý trực tiếp duyệt. Đơn TC-01 (`SUBMITTED`), `version` hiện tại | 200. Đơn `APPROVED`, `approverId` = `manager`. Số dư không đổi (vẫn giữ trong `pending`). Lịch sử có dòng `SUBMITTED → APPROVED` | HTTP 200; trạng thái "Đã duyệt"; approverId là manager: true; lịch sử: 21:58:45 8/11/2026 Trần Thị Nhân Chờ duyệt — / 21:59:05 8/11/2026 Nguyễn Văn Quản Chờ duyệt → Đã duyệt —; trước: được hưởng 14, đã dùng 1, chờ duyệt 5, còn lại 8; sau: được hưởng 14, đã dùng 1, chờ duyệt 5, còn lại 8; email: employee@hr.local: [HRHelper] Đơn nghỉ phép đã được duyệt – Trần Thị Nhân, 09/11/2026 – 10/11/2026 | Đạt |
| 12 | TC-12 | hr, employee | API: Người không phải quản lý trực tiếp duyệt. Đơn `SUBMITTED` của `employee` | 403 cho cả hai, đơn giữ `SUBMITTED` | hr 403 Không đủ quyền ; employee 403 Không đủ quyền ; đơn: SUBMITTED | Đạt |
| 13 | TC-13 | manager | API: Duyệt lại lần hai. Gửi lại approve cho đơn TC-11 đã `APPROVED` | 200, đơn vẫn `APPROVED`, `version` và số dư không đổi | HTTP 200; APPROVED; version 2 → 2; chờ duyệt 5 → 5; email: không có email mới | Đạt |
| 14 | TC-14 | manager | API: Duyệt với version cũ. Đơn `SUBMITTED`, gửi `version` khác version hiện tại | 409, đơn không đổi | HTTP 409 Đơn đã được người khác cập nhật, hãy tải lại; đơn: SUBMITTED | Đạt |
| 15 | TC-15 | manager | Giao diện: Quản lý trực tiếp từ chối. Đơn 1 ngày `SUBMITTED` (vd 11/11/2026), comment "Trùng lịch dự án" | 200. Đơn `REJECTED`. `pending` giảm 1, `used` không đổi. Lịch sử lưu comment | HTTP 200; "Bị từ chối"; lịch sử: 21:59:13 8/11/2026 Trần Thị Nhân Chờ duyệt — / 21:59:17 8/11/2026 Nguyễn Văn Quản Chờ duyệt → Bị từ chối Trùng lịch dự án; trước: được hưởng 14, đã dùng 1, chờ duyệt 6, còn lại 7; sau: được hưởng 14, đã dùng 1, chờ duyệt 5, còn lại 8; email: employee@hr.local: [HRHelper] Đơn nghỉ phép bị từ chối – Trần Thị Nhân, 11/11/2026 | Đạt |
| 16 | TC-16 | manager | API: Từ chối đơn đã được duyệt. Đơn TC-11 (`APPROVED`) | 409, đơn giữ `APPROVED` | HTTP 409 Đơn đang ở trạng thái APPROVED, không thể reject; đơn: APPROVED | Đạt |
| 17 | TC-17 | employee | Giao diện: Hủy đơn đang chờ duyệt. Đơn TC-05 (`SUBMITTED`) | 200. Đơn `CANCELLED`, `pending` giảm 2 | HTTP 200; "Đã hủy"; trước: được hưởng 14, đã dùng 1, chờ duyệt 5, còn lại 8; sau: được hưởng 14, đã dùng 1, chờ duyệt 3, còn lại 10; email: manager@hr.local: [HRHelper] Đơn nghỉ phép đã bị hủy – Trần Thị Nhân, 29/04/2026 – 04/05/2026 | Đạt |
| 18 | TC-18 | employee | API: Hủy đơn đã duyệt. Đơn TC-11 (`APPROVED`) | 409, đơn giữ `APPROVED`, số dư không đổi | HTTP 409 Đơn đang ở trạng thái APPROVED, không thể cancel; đơn: APPROVED; chờ duyệt 3 → 3 | Đạt |
| 19 | TC-19 | manager | API: Người khác hủy đơn. Đơn `SUBMITTED` của `employee` | 403 | HTTP 403 Không có quyền cancel đơn này | Đạt |
| 20 | TC-20 | hr | Giao diện: HR hoàn tất đơn đã duyệt. Đơn TC-11 (`APPROVED`) | 200. Đơn `COMPLETED`. `pending` giảm 2, `used` tăng 2. Lịch sử đủ 3 dòng `SUBMITTED → APPROVED → COMPLETED`; audit có `LEAVE_SUBMIT`, `LEAVE_APPROVE`, `LEAVE_COMPLETE` | HTTP 200; "Đã hoàn tất"; lịch sử: 21:58:45 8/11/2026 Trần Thị Nhân Chờ duyệt — / 21:59:05 8/11/2026 Nguyễn Văn Quản Chờ duyệt → Đã duyệt — / 21:59:26 8/11/2026 Lê Thu Hằng Đã duyệt → Đã hoàn tất —; audit: LEAVE_APPROVE, LEAVE_COMPLETE, LEAVE_SUBMIT; trước: được hưởng 14, đã dùng 1, chờ duyệt 3, còn lại 10; sau: được hưởng 14, đã dùng 3, chờ duyệt 1, còn lại 10; email: employee@hr.local: [HRHelper] Đơn nghỉ phép đã được HR hoàn tất – Trần Thị Nhân, 09/11/2026 – 10/11/2026 | Đạt |
| 21 | TC-21 | hr | API: HR hoàn tất đơn chưa duyệt. Đơn `SUBMITTED` | 409, đơn giữ `SUBMITTED` | HTTP 409 Đơn đang ở trạng thái SUBMITTED, không thể complete; đơn: SUBMITTED | Đạt |
| 22 | TC-22 | employee, manager | API: Không phải HR hoàn tất. Đơn `APPROVED` | 403 | employee 403 Không đủ quyền ; manager 403 Không đủ quyền | Đạt |

**Tổng hợp:** 22/22 ca đạt, không phát hiện lỗi mới nên không mở issue.

### 2.1 Phạm vi chưa kiểm

- BR-06 (người duyệt thay) và BR-12 (tạo đơn hộ): chưa có trong hệ thống.
- Tài khoản `admin`: bộ ca không dùng; quyền của `admin` kiểm trong `test-report-tuan-09.md`.
- Chỉ chạy trên Chrome máy tính, chưa kiểm trên điện thoại hay trình duyệt khác.

### 2.2 Theo dõi lỗi

- Issue #18, #19 đã đóng; kết quả TC-17 và TC-13 ở bảng trên khớp với việc đóng các issue này.
- L-01, L-02 ở mục 1.3 đã sửa ở PR #46 (e2e tự dọn phòng ban test; seed đảm bảo ngày vào làm sau ngày sinh ít nhất 18 năm), không mở issue riêng.
