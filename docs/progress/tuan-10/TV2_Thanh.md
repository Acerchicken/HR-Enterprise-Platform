# Tuần 10 – TV2 (Thanh): quy tắc kho tài liệu, các điểm nghiệp vụ còn mở

Vai trò: chốt quy tắc nghiệp vụ trước khi TV1 code và TV4 viết ca kiểm thử; review nghiệp vụ PR của TV1.

## Hạn chót

| Hạn | Việc |
|---|---|
| **T3 (10/11), 21:00** | Mở PR `docs/document-rules` (TV1 và TV4 cần để làm tiếp) |
| T4 (11/11) | Sửa theo góp ý, được merge |
| **T4 (11/11), 21:00** | Mở PR `docs/retention-leave-reason` |
| T5 (12/11) | Sửa theo góp ý, được merge |
| Trong 24 giờ kể từ khi PR mở | Review nghiệp vụ các PR `feat/*` của TV1 |
| **CN (15/11), 12:00** | Mở PR `docs/matrix-week10` |
| **T2 (16/11), 9:00** | Điền mục "Việc đã làm" |

**Review phải có trên GitHub.** Tuần 9 chưa có review nào của TV2 cho PR của TV1 (#46). Tuần này mỗi PR trong bảng phân công cần một
review trên PR, nêu đã đối chiếu quy tắc nào.

## Việc cần làm

### 1. `docs/document-rules` – quy tắc kho tài liệu (UC5, UC6)

Output: `docs/business/document-rules.md`, đánh số `DR-01…`, mỗi quy tắc có ví dụ như `leave-rules.md`.

1. Loại tài liệu, thông tin bắt buộc (tiêu đề, loại, phạm vi), định dạng PDF/DOCX, dung lượng tối đa.
2. Phạm vi xem: toàn công ty, phòng ban (có gồm phòng ban con không?), vai trò. Nhiều phạm vi thì cộng hay giao?
3. Phiên bản: ai đăng bản mới, nhân viên có xem được bản cũ không.
4. Gỡ tài liệu: xóa hẳn hay ẩn; nhân viên chuyển phòng ban thì mất quyền ngay không.
5. Tìm kiếm: tìm ở đâu, kết quả sắp xếp thế nào, không bao giờ lộ tài liệu ngoài phạm vi (kể cả tiêu đề).
6. Mục "Đối chiếu với hiện thực" như `leave-rules.md`.

### 2. `docs/retention-leave-reason` – các câu hỏi mở trong BRD

1. Thời gian lưu audit log và đơn nghỉ.
2. Ai được xem lý do nghỉ của đơn nghỉ ốm, thai sản.
3. Email nghỉ phép (threat model T-16): tiêu đề và nội dung được phép có gì, có nên bỏ loại phép và ghi chú không.

Ghi quyết định vào `leave-rules.md` và mục câu hỏi mở của `BRD.md`.

### 3. `docs/matrix-week10` – cập nhật cuối tuần

- Thêm API tài liệu, tìm kiếm vào `access-control-matrix.md`; đối chiếu `@Roles` và service như tuần 9.
- Cập nhật cột trạng thái FR trong `docs/requirements/SRS.md` theo code đã merge (từ 12/11 bảng FR nằm ở SRS, không còn trong `BRD.md`).
- Cập nhật `threat-model.md`: các dòng đã xử lý sau #43, #44, #45, thêm luồng tài liệu.

## Cách làm trên git

```bash
git checkout dev && git pull
git checkout -b docs/document-rules
# viết file, commit, rồi:
git push -u origin docs/document-rules
```

Mở PR vào `dev`. Người review góp ý trên PR; sửa trên cùng nhánh, `git push`, bấm "Re-request review".

## Góp ý review

_Góp ý ghi trực tiếp trên PR._

## Việc đã làm

_Điền T2 (16/11), 9:00._
