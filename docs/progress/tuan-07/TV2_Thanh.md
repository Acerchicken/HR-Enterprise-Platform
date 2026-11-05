# Tuần 7 – TV2 (Thanh)

## Việc đã làm

Không có công việc hoàn thành trong tuần 7.

## Vai trò từ tuần 8: Nghiệp vụ

Theo [ADR-11](README.md#adr-11--điều-chỉnh-phân-vai-cho-giai-đoạn-code), TV2 chịu trách nhiệm:
- Viết và giữ đúng **business rule** của từng use case trước khi TV1 code.
- Vẽ **quy trình nghiệp vụ** (ai làm gì, theo thứ tự nào, khi nào rẽ nhánh).
- Giữ requirements, NFR, user journey cập nhật; đối chiếu code với requirements và mở issue khi lệch.

## Việc tuần 8

| Việc | Output |
|---|---|
| Bảng business rule luồng nghỉ phép: kiểm tra số dư, trùng lịch, nghỉ nửa ngày, hủy đơn, quản lý vắng mặt, HR hoàn tất | `docs/business/leave-rules.md` (giao trước thứ 3) |
| Sơ đồ quy trình nghỉ phép từ tạo đơn đến hoàn tất, có các nhánh từ chối và hủy | Sơ đồ trong `docs/business/` |
| Đối chiếu business rule UC1, UC2 trong code tuần 7 với bảng functional requirements tuần 5 | Issue cho từng điểm lệch |
