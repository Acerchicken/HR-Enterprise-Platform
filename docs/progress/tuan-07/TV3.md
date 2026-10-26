# Tuần 7 – TV3 (Duy)

## Việc đã làm

Không có công việc hoàn thành trong tuần 7.

## Vai trò từ tuần 8: Một phần nghiệp vụ và ca kiểm thử

Theo [ADR-11](README.md#adr-11--điều-chỉnh-phân-vai-cho-giai-đoạn-code), TV3 chịu trách nhiệm:
- Một phần nghiệp vụ: các danh mục và quy định nhỏ (loại phép, ngày lễ, cách tính ngày nghỉ).
- Biến mỗi business rule (do TV2 viết) thành **ca kiểm thử**: đầu vào, điều kiện, kết quả mong đợi. Đây là căn cứ cho test tự động của TV1.
- **Kiểm thử chức năng** cuối mỗi tuần: dùng các tài khoản demo đi hết các màn hình, đối chiếu với ca kiểm thử, mở issue cho mỗi lỗi.

## Việc tuần 8

| Việc | Output |
|---|---|
| Danh mục loại phép (số ngày tối đa, có lương hay không, cần giấy tờ gì) và ngày lễ 2026 | `docs/business/leave-types-holidays.md` |
| Ca kiểm thử cho 5 bước workflow nghỉ phép, mỗi bước có ca hợp lệ và ca bị từ chối | `docs/business/leave-test-cases.md` |
| Kiểm thử chức năng các màn hình tuần 7 (đăng nhập, hồ sơ, danh bạ, chi tiết nhân viên, sơ đồ tổ chức) với 4 tài khoản demo | Biên bản kiểm thử, issue cho từng lỗi |
