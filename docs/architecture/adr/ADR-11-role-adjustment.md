# ADR-11 – Điều chỉnh phân vai cho giai đoạn code

| Mục | Nội dung |
|---|---|
| Trạng thái | **Đã chấp nhận** |
| Ngày quyết định | 26/10/2026 |
| Thời điểm | Tuần 7 (19/10 – 26/10/2026) |
| Người viết | TV1 (Dương) |
| Góc nhìn | Dự án |
| ADR liên quan | – |
| Nguồn gốc | Mục quyết định trong [tuần 7](../../progress/tuan-07/README.md) |

## Lịch sử thay đổi

- Không có.

## Nội dung quyết định

**Bối cảnh:** kế hoạch tuần 6 chia phần code tuần 7 cho cả 4 người theo module. Thực tế tuần 7 chỉ TV1 code; TV4, TV2, TV3
chưa có công việc hoàn thành. Còn 6 tuần, phần code đã có khung thống nhất, và mỗi thành viên vẫn cần có đóng góp rõ ràng,
kiểm chứng được trên repo.

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | Giữ phân vai cũ | Mỗi người code module của mình như kế hoạch tuần 4 |
| B | Một người code chính, ba người theo chuyên môn | TV1 code; TV2 nghiệp vụ; TV3 cloud, IaC, CI/CD; TV4 một phần nghiệp vụ + ca kiểm thử |
| C | Code theo cặp | Hai cặp, mỗi cặp một nửa số module |

**Tiêu chí lựa chọn:**

| Tiêu chí | A | B | C |
|---|---|---|---|
| Khả thi với thực tế tham gia của nhóm | 1 | 5 | 2 |
| Kiến trúc và code nhất quán | 2 | 5 | 3 |
| Mỗi thành viên có output riêng, kiểm chứng được | 4 | 4 | 3 |
| Không dồn rủi ro vào một người | 4 | 2 | 4 |
| Bám kế hoạch tổng 10 tuần (output từng tuần) | 3 | 4 | 3 |

**Giải pháp được chọn:** B. Output từng tuần của kế hoạch tổng giữ nguyên; chỉ đổi người làm.

**Trade-off:** TV1 gánh toàn bộ code ứng dụng, là điểm nghẽn: TV1 vắng hoặc chậm thì cả nhóm chậm. Ba thành viên còn lại ít
trực tiếp với code ứng dụng, nên phải chủ động đọc code để trả lời được ở phần Architecture Defense.

**Tiêu chí nghiệm thu:**
- Mỗi tuần, mỗi thành viên có ít nhất một PR hoặc issue bằng tài khoản GitHub của chính mình.
- TV2: mỗi use case có bảng business rule trước khi TV1 code; mọi điểm lệch giữa code và requirements được mở issue.
- TV3: CI chạy trên mọi PR từ tuần 8; IaC tạo lại được môi trường staging từ tuần 9.
- TV4: mỗi business rule có ít nhất một ca kiểm thử; mỗi ca có test tự động tương ứng; có biên bản kiểm thử chức năng hàng tuần.

**Khi nào xem lại:** TV1 trễ kế hoạch 2 tuần liên tiếp thì chuyển một phần code (ví dụ module Document hoặc màn hình frontend) cho thành viên khác.
