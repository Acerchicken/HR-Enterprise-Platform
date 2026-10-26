# Tuần 5 – TV3: User journey và NFR

## Việc đã làm

| Việc | Output | Trạng thái |
|---|---|---|
| Vẽ user journey đơn nghỉ phép | Mục 1 | Xong |
| Đặt NFR có target cụ thể cho 6 nhóm | Mục 2 | Xong |

## 1. User journey – đơn nghỉ phép

1. Employee đăng nhập (SSO) và xem số dư phép.
2. Tạo đơn → hệ thống kiểm tra số dư và trùng lịch → trạng thái Submitted, giữ chỗ số ngày ở trạng thái "pending".
3. Manager nhận thông báo → Approve hoặc Reject kèm lý do.
4. HR kiểm tra và ghi nhận → trừ số dư chính thức → Completed.
5. Employee nhận thông báo kết quả; mọi bước đều được ghi audit.

Nhận xét: bước 2–4 là các chuyển trạng thái cần transaction (đơn + số dư + audit), còn việc gửi thông báo không cần đồng bộ,
là ứng viên cho xử lý bất đồng bộ (quyết định ở tuần 6).

## 2. Non-functional requirements

| Nhóm | Target | Lý do |
|---|---|---|
| Performance | p95 < 300 ms cho API đọc, p95 < 500 ms cho API ghi, tìm kiếm p95 < 1 s | Ứng dụng nội bộ, thao tác tương tác trực tiếp |
| Scalability | 2,000 nhân viên, ~500 người dùng đồng thời lúc cao điểm; chịu được 5× (10,000 nhân viên) mà không đổi kiến trúc | Thiết kế theo tăng trưởng, không chỉ tải hiện tại |
| Availability | 99.5% / tháng (≈ 3.6 giờ downtime/tháng) | Hệ thống nội bộ, không phải thanh toán; 99.9% cần multi-AZ và tăng chi phí (QĐ-02) |
| Reliability | RPO ≤ 1 giờ, RTO ≤ 4 giờ; không mất đơn đã Submitted | Hồ sơ và đơn từ có giá trị pháp lý |
| Security | Employee không bao giờ đọc được hồ sơ người khác; Manager chỉ thấy đơn của nhân viên trực thuộc; trường nhạy cảm (CCCD, tài khoản ngân hàng, lương) mã hóa at rest và chỉ HR xem; 100% thao tác duyệt và đọc trường nhạy cảm được audit; TLS cho mọi kết nối | Dữ liệu cá nhân nhạy cảm; requirement viết ở dạng kiểm chứng được |
| Cost | MVP < 100 USD / tháng | Ngân sách đồ án |

Mỗi NFR đều viết thành con số hoặc câu kiểm chứng được, để tuần 11 load test và tuần 9 kiểm thử bảo mật đo trực tiếp.
