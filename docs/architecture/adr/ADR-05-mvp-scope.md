# ADR-05 – Phạm vi MVP: một luồng nghiệp vụ nghỉ phép end-to-end

| Mục | Nội dung |
|---|---|
| Trạng thái | **Đã chấp nhận** |
| Ngày quyết định | 5/10/2026 |
| Thời điểm | Tuần 4 (28/9 – 5/10/2026) |
| Người viết | Nhóm |
| Góc nhìn | Nghiệp vụ |
| ADR liên quan | ADR-12 |
| Nguồn gốc | Mục quyết định trong [kế hoạch tổng tuần 4](../../progress/tuan-04-ke-hoach-tong.md) |

## Lịch sử thay đổi

- 10/11/2026: tiêu chí "cuối tuần 10 demo được luồng nghỉ phép trên cloud" lùi sang cuối tuần 12, theo quyết định chạy staging ở tuần 12–13 ([tuần 10, mục 3](../../progress/tuan-10/README.md#lùi-thời-điểm-chạy-staging-trên-aws-sang-tuần-1213-10112026)).

## Nội dung quyết định

**Bối cảnh:** đề tài có 7 use case bắt buộc cộng phần AI mở rộng; nhóm 4 người, 10 tuần; môn học chấm nặng phần kiến trúc,
bảo mật, vận hành trên cloud chứ không chỉ số lượng chức năng.

**Các giải pháp:**

| # | Giải pháp | Mô tả |
|---|---|---|
| A | Làm rộng | Làm cả 7 use case + tính lương, chấm công ở mức cơ bản |
| B | Một luồng end-to-end sâu | Làm đủ 7 use case, trong đó luồng nghỉ phép làm kỹ (workflow, phân quyền, audit, thông báo); bỏ lương, chấm công, tuyển dụng |
| C | Chỉ phần lõi | Chỉ Employee profile + Leave, bỏ document, search |

**Tiêu chí lựa chọn:**

| Tiêu chí | A | B | C |
|---|---|---|---|
| Đáp ứng yêu cầu bắt buộc của đề tài | 5 | 5 | 2 |
| Khả năng hoàn thành trong 10 tuần với 4 người | 1 | 4 | 5 |
| Đủ "chiều sâu" để thể hiện kiến trúc (transaction, async, security) | 2 | 5 | 3 |
| Còn thời gian cho deploy, load test, AI | 1 | 4 | 5 |

**Giải pháp được chọn:** B.

**Trade-off:** bỏ tính lương, chấm công, tuyển dụng; Payroll chỉ là file export mô phỏng. Một số use case (search, document)
chỉ làm ở mức đủ dùng.

**Tiêu chí nghiệm thu:** cuối tuần 10, demo được luồng nghỉ phép từ tạo đơn đến hoàn tất trên môi trường cloud, có audit
từng bước và có ca bị từ chối quyền; 7 use case đều có ít nhất một màn hình hoặc API chạy được.

**Khi nào xem lại:** cuối tuần 8 nếu luồng nghỉ phép chưa chạy end-to-end ở local thì cắt AI assistant (tuần 12) để dồn sức.
