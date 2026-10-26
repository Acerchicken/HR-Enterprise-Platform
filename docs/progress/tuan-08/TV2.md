# Tuần 8 – TV2 (Thanh): nghiệp vụ luồng nghỉ phép

Vai trò: viết business rule trước khi TV1 code, vẽ quy trình nghiệp vụ, đối chiếu code với requirements.

## Việc cần làm

Nhánh: `docs/leave-rules`, hạn PR vào `dev` **thứ 3 (27/10)**. TV1 và TV3 cần file này để code và viết ca kiểm thử.

| Việc | Output |
|---|---|
| Bảng business rule luồng nghỉ phép. Mỗi rule có mã (BR-01, BR-02…), mô tả, ví dụ. Tối thiểu: kiểm tra số dư, đơn trùng lịch, nghỉ nửa ngày, hủy đơn (trước/sau khi duyệt), quản lý vắng mặt thì ai duyệt, HR hoàn tất | `docs/business/leave-rules.md` |
| Sơ đồ quy trình nghỉ phép từ tạo đơn đến hoàn tất, có nhánh từ chối và hủy (Mermaid hoặc ảnh) | Sơ đồ trong `docs/business/leave-rules.md` |
| Đối chiếu business rule UC1 (hồ sơ nhân viên), UC2 (thông tin tổ chức) trong code tuần 7 với bảng functional requirements tuần 5 | Issue trên GitHub cho từng điểm lệch |

Trong tuần:
- Review PR `feat/leave-workflow-api`, `feat/leave-outbox-worker`, `feat/leave-ui` của TV1 về mặt nghiệp vụ: code có đúng các BR không.
- Review PR ca kiểm thử của TV3: mỗi BR đã có ca kiểm thử chưa.

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
