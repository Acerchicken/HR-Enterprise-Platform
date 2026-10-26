# Tuần 7 – TV2

## Việc đã làm

Không có công việc hoàn thành trong tuần 7.

## Vai trò từ tuần 8: Nghiệp vụ và ca kiểm thử

Theo [QĐ-07](README.md#qđ-07--điều-chỉnh-phân-vai-cho-giai-đoạn-code), TV2 chịu trách nhiệm:
- Viết và giữ đúng **business rule** của từng use case (số dư phép, trùng lịch, ai được duyệt, quy định của công ty giả định).
- Biến mỗi business rule thành **ca kiểm thử nghiệp vụ** (đầu vào, điều kiện, kết quả mong đợi), làm căn cứ cho test tự động.
- Kiểm tra kết quả test tự động có phủ hết các ca đã viết chưa.

## Việc tuần 8

| Việc | Output |
|---|---|
| Bảng business rule cho luồng nghỉ phép: số dư, trùng lịch, nghỉ nửa ngày, ngày lễ, hủy đơn, quản lý vắng mặt | `docs/business/leave-rules.md` |
| Ca kiểm thử nghiệp vụ cho 5 bước của workflow, mỗi bước có ca hợp lệ và ca bị từ chối | `docs/business/leave-test-cases.md` |
| Rà soát business rule UC1, UC2 trong code tuần 7 với bảng functional requirements tuần 5, ghi các điểm lệch | Issue trên GitHub |
