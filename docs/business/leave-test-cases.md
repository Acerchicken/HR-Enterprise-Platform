# Danh sách Ca kiểm thử Quản lý Nghỉ phép (Leave Management Test Cases)

Tài liệu này tổng hợp các ca kiểm thử cho quy trình workflow nghỉ phép dựa trên Business Rules (BR) và mã lỗi API chuẩn.

## 1. Danh sách Ca kiểm thử Workflow

| Mã TC | Tên ca kiểm thử | BR liên quan | Tài khoản | Đầu vào (Input) | Kết quả mong đợi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-01** | Tạo đơn xin nghỉ hợp lệ | BR-01 | `employee` | Loại phép: `ANNUAL`, 2 ngày. | Đơn tạo thành công, trạng thái `SUBMITTED`, HTTP `201 Created`. |
| **TC-02** | Tạo đơn vượt quá số dư phép | BR-01 | `employee` | Số dư 1 ngày, xin nghỉ 3 ngày. | API chặn, trả về HTTP `400 Bad Request` (Không đủ số dư). |
| **TC-03** | Tạo đơn trùng lịch nghỉ đã có | BR-02 | `employee` | Ngày nghỉ trùng với đơn đã tạo trước đó. | API chặn, trả về HTTP `409 Conflict` (Trùng lịch). |
| **TC-04** | Nghỉ nửa ngày hợp lệ | BR-04 | `employee` | Chọn nghỉ buổi Sáng và buổi Chiều cùng 1 ngày. | Đơn tạo thành công, trạng thái `SUBMITTED`, tính 1 ngày phép. |
| **TC-05** | Quản lý trực tiếp duyệt đơn | BR-05 | `manager` | Chọn đơn `SUBMITTED`, bấm Duyệt. | Trạng thái chuyển `APPROVED`, HTTP `200 OK`. |
| **TC-06** | Quản lý trực tiếp từ chối đơn | BR-05 | `manager` | Chọn đơn `SUBMITTED`, bấm Từ chối. | Trạng thái chuyển `REJECTED`, HTTP `200 OK`. |
| **TC-07** | Từ chối trả về để sửa | BR-09 | `manager` | Trả đơn về cho nhân viên bổ sung thông tin. | Đơn bị đẩy lại trạng thái chờ sửa, HTTP `200 OK`. |
| **TC-08** | Duyệt đơn 2 lần (Double click/Call API) | BR-11 | `manager` | Gọi API duyệt liên tiếp 2 lần cùng 1 đơn. | Lần 2 bị chặn, HTTP `409 Conflict` (Lệch version), số dư không bị trừ đúp. |
| **TC-09** | Tài khoản không quyền duyệt đơn | BR-05 | `hr` | Thử gọi API duyệt đơn của nhân viên phòng khác. | API chặn, trả về HTTP `403 Forbidden` (Sai quyền). |
| **TC-10** | Người duyệt thay (Delegation) duyệt đơn | BR-06 | `manager` | Tài khoản được ủy quyền thực hiện duyệt. | Trạng thái chuyển `APPROVED`, HTTP `200 OK`. |
| **TC-11** | Nhân viên hủy đơn chưa duyệt | BR-07 | `employee` | Chọn đơn `SUBMITTED`, bấm Hủy. | Trạng thái chuyển `CANCELLED`, HTTP `200 OK`. |
| **TC-12** | Nhân viên hủy đơn đã duyệt | BR-08 | `employee` | Chọn đơn `APPROVED`, yêu cầu hủy. | Chuyển sang quy trình xin hủy (phụ thuộc BR), HTTP `200 OK`. |
| **TC-13** | HR hoàn tất đơn đã duyệt | BR-10 | `hr` | Chọn đơn `APPROVED`, bấm Hoàn tất. | Trạng thái chuyển `COMPLETED`, HTTP `200 OK`. |
| **TC-14** | HR hoàn tất đơn chưa duyệt | BR-10 | `hr` | Cố gọi API hoàn tất trên đơn đang `SUBMITTED`. | API chặn, trả về HTTP `400 Bad Request` (Sai luồng trạng thái). |
| **TC-15** | Nhân viên tự hoàn tất đơn | BR-10 | `employee` | Cố gọi API hoàn tất đơn của chính mình. | API chặn, trả về HTTP `403 Forbidden` (Chỉ HR có quyền hoàn tất). |
