# Tuần 8 – TV2 (Thanh): nghiệp vụ luồng nghỉ phép

Vai trò: viết business rule trước khi TV1 code, vẽ quy trình nghiệp vụ, đối chiếu code với requirements.

## Hạn chót

| Hạn | Việc |
|---|---|
| **Thứ 3 (27/10), 21:00** | Mở PR `docs/leave-rules` vào `dev`: bảng business rule + sơ đồ quy trình |
| **Thứ 4 (28/10)** | Sửa theo góp ý review, PR được merge vào `dev` |
| **Thứ 6 (30/10)** | Mở xong issue cho các điểm lệch UC1, UC2 |
| Trong 24 giờ kể từ khi được gán | Review PR của TV1 và TV4 |
| **Thứ 2 (2/11), 9:00** | Điền mục "Việc đã làm" ở cuối file này |

## Việc cần làm

Nhánh: `docs/leave-rules`, hạn PR vào `dev` **thứ 3 (27/10)**. TV1 và TV4 cần file này để code và viết ca kiểm thử.

| Việc | Output | Hạn |
|---|---|---|
| Bảng business rule luồng nghỉ phép. Mỗi rule có mã (BR-01, BR-02…), mô tả, ví dụ. Tối thiểu: kiểm tra số dư, đơn trùng lịch, nghỉ nửa ngày, hủy đơn (trước/sau khi duyệt), quản lý vắng mặt thì ai duyệt, HR hoàn tất | `docs/business/leave-rules.md` | Thứ 3 (27/10) |
| Sơ đồ quy trình nghỉ phép từ tạo đơn đến hoàn tất, có nhánh từ chối và hủy (Mermaid hoặc ảnh) | Sơ đồ trong `docs/business/leave-rules.md` | Thứ 3 (27/10) |
| Đối chiếu business rule UC1 (hồ sơ nhân viên), UC2 (thông tin tổ chức) trong code tuần 7 với bảng functional requirements tuần 5 | Issue trên GitHub cho từng điểm lệch | Thứ 6 (30/10) |

Trong tuần:
- Review PR `feat/leave-workflow-api`, `feat/leave-outbox-worker`, `feat/leave-ui` của TV1 về mặt nghiệp vụ: code có đúng các BR không.
- Review PR ca kiểm thử của TV4: mỗi BR đã có ca kiểm thử chưa.

## Cách làm trên git

```bash
git checkout dev && git pull
git checkout -b docs/leave-rules
# viết file, rồi:
git add docs/business/leave-rules.md
git commit -m "docs(business): add leave workflow rules"
git push -u origin docs/leave-rules
# lên GitHub mở PR: base = dev, compare = docs/leave-rules
```

## Việc đã làm

_Điền cuối tuần._
