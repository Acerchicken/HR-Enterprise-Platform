# Tuần 5 – TV2 (Thanh): Functional requirements

## Việc đã làm

| Việc | Output | Trạng thái |
|---|---|---|
| Viết functional requirements cho 7 use case theo actor – action – input – output – business rule | Bảng bên dưới | Xong |

## Functional requirements

| UC | Actor | Action | Input | Output | Business rule |
|---|---|---|---|---|---|
| UC1 Employee profile | Employee, HR | Xem, cập nhật hồ sơ | Thông tin cá nhân | Hồ sơ đã cập nhật | Employee chỉ sửa trường liên hệ; trường nhạy cảm chỉ HR sửa |
| UC2 Organizational info | Mọi vai trò | Xem phòng ban, sơ đồ tổ chức, quản lý trực tiếp | Mã phòng ban | Cây tổ chức | Mỗi nhân viên có đúng 1 quản lý trực tiếp |
| UC3 Leave request | Employee | Tạo và gửi đơn nghỉ | Loại phép, ngày bắt đầu/kết thúc, lý do | Mã đơn, trạng thái Submitted | Số ngày ≤ số dư phép; không trùng đơn khác |
| UC4 Manager approval | Manager | Duyệt / từ chối | Mã đơn, quyết định, ghi chú | Trạng thái Approved / Rejected | Chỉ quản lý trực tiếp của người tạo; mỗi đơn chỉ được quyết định 1 lần |
| UC5 Document repository | HR (đăng), Employee (đọc) | Tải lên, phân quyền, xem tài liệu | File PDF/DOCX + metadata + phạm vi truy cập | Tài liệu có version | Nhân viên chỉ thấy tài liệu thuộc phạm vi của mình |
| UC6 Self-service search | Employee | Tìm đồng nghiệp, tài liệu | Từ khóa | Danh sách kết quả | Kết quả được lọc theo quyền |
| UC7 Audit history | HR, Admin | Xem lịch sử thao tác | Đối tượng, người thực hiện, khoảng thời gian | Danh sách log | Log chỉ được thêm (append-only), không ai sửa/xóa |

## Ghi chú cho tuần sau

- Mỗi business rule ở cột cuối sẽ thành một ca test tự động khi code (tuần 7–8).
- UC6 dùng chung quyền của UC1 và UC5, không có quy tắc phân quyền riêng.
