# Danh sách Ca kiểm thử Quản lý Nghỉ phép (Leave Management Test Cases)

Tài liệu này tổng hợp các ca kiểm thử cho quy trình 5 bước xin nghỉ phép và quy tắc tính ngày nghỉ lễ (BR-03).

## 1. Danh sách Ca kiểm thử Workflow (5 bước)

| Mã TC | Tên ca kiểm thử | BR liên quan | Tài khoản | Đầu vào (Input) | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-01** | Tạo đơn xin nghỉ phép năm hợp lệ | BR-01, BR-02 | Nhân viên (`nv_test`) | Loạt phép: `ANNUAL`, Từ ngày: `10/11/2026`, Đến ngày: `11/11/2026`, Lý do: "Nghỉ cá nhân" | Đơn tạo thành công, trạng thái `PENDING`. Trừ tạm tính 2 ngày phép. |
| **TC-02** | Tạo đơn bị từ chối do vượt quá số dư phép | BR-01 | Nhân viên (`nv_test`) | Số dư phép: 1 ngày. Đăng ký nghỉ 3 ngày `ANNUAL`. | Hệ thống báo lỗi: "Số dư phép không đủ" và không cho tạo đơn. |
| **TC-03** | Tạo đơn nghỉ qua ngày Lễ 30/4 - 1/5 | BR-03 | Nhân viên (`nv_test`) | Loạt phép: `ANNUAL`, Từ ngày: `29/04/2026` đến `04/05/2026` (bao gồm Lễ 30/4, 1/5 và T7, CN). | Đơn tạo thành công. Hệ thống tự động trừ đúng **2 ngày phép** (ngày 29/04 và 04/05). |
| **TC-04** | Tạo đơn bị từ chối do trùng vào ngày nghỉ bù 27/04/2026 | BR-03 | Nhân viên (`nv_test`) | Loạt phép: `ANNUAL`, Từ ngày: `27/04/2026` đến `27/04/2026`. | Hệ thống từ chối/báo lỗi: "Ngày đăng ký rơi vào ngày nghỉ lễ/nghỉ bù (Giỗ Tổ Hùng Vương)". |
| **TC-05** | Quản lý duyệt đơn hợp lệ | BR-04 | Quản lý (`ql_test`) | Chọn đơn `TC-01` (trạng thái `PENDING`), bấm "Duyệt". | Đơn chuyển trạng thái `APPROVED`. Gửi thông báo cho Nhân viên. |
| **TC-06** | Quản lý duyệt đơn không thuộc thẩm quyền | BR-04 | Quản lý phòng khác | Chọn đơn của nhân viên phòng khác, bấm "Duyệt". | Hệ thống báo lỗi phân quyền `403 Forbidden`. |
| **TC-07** | Quản lý từ chối đơn nghỉ phép | BR-04 | Quản lý (`ql_test`) | Bấm "Từ chối", nhập lý do: "Dự án đang gấp". | Đơn chuyển trạng thái `REJECTED`. Hoàn lại quỹ phép tạm tính cho nhân viên. |
| **TC-08** | Quản lý từ chối đơn nhưng không nhập lý do | BR-04 | Quản lý (`ql_test`) | Bấm "Từ chối", để trống ô lý do. | Hệ thống yêu cầu: "Vui lòng nhập lý do từ chối". |
| **TC-09** | Nhân viên hủy đơn khi đơn đang chờ duyệt | BR-05 | Nhân viên (`nv_test`) | Chọn đơn trạng thái `PENDING`, bấm "Hủy đơn". | Đơn chuyển trạng thái `CANCELLED`. Hoàn lại số ngày phép đã trừ tạm tính. |
| **TC-10** | Nhân viên cố gắng hủy đơn đã được duyệt | BR-05 | Nhân viên (`nv_test`) | Chọn đơn trạng thái `APPROVED`, bấm "Hủy đơn". | Nút "Hủy đơn" bị ẩn hoặc hệ thống báo lỗi không cho phép hủy trực tiếp. |
| **TC-11** | HR hoàn tất hồ sơ nghỉ ốm có đủ giấy tờ | BR-06 | HR Admin (`hr_test`) | Chọn đơn `SICK`, đính kèm xác nhận "Đã nhận giấy BHXH", bấm "Hoàn tất". | Đơn chuyển trạng thái `COMPLETED`. Lưu trữ thông tin hưởng BHXH. |
| **TC-12** | HR hoàn tất đơn khi thiếu chứng từ bắt buộc | BR-06 | HR Admin (`hr_test`) | Chọn đơn `SICK` không có file chứng từ BHXH, bấm "Hoàn tất". | Hệ thống báo lỗi: "Thiếu chứng từ bắt buộc cho loại phép Nghỉ ốm". |