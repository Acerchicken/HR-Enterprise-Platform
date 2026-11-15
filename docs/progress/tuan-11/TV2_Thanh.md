# Tuần 11 – TV2 (Thanh): review đặc tả UC1, quy tắc toàn vẹn và nghỉ phép

Vai trò: chốt quy tắc nghiệp vụ trước khi TV1 code và TV4 viết ca kiểm thử; review nghiệp vụ PR của TV1.

## Hạn chót

| Hạn | Việc |
|---|---|
| **T2 (16/11), 21:00** | Review `requirements.md`, `spec.md` UC1, UC2, bảng FR trong SRS, ma trận phân quyền trên #76 |
| **T2 (16/11), 21:00** | Mở PR `docs/org-integrity-rules` |
| T3 (17/11) | Sửa theo góp ý, được merge |
| Trong 24 giờ kể từ khi PR mở | Review nghiệp vụ `feat/profile-layout`, `fix/employee-org-integrity`, `feat/profile-change-requests` |
| **T5 (19/11), 21:00** | Mở PR `docs/leave-rules-week11` |
| **T6 (20/11)** | Review `requirements.md`, `spec.md` UC3, UC4 trên #76; `docs/leave-rules-week11` được merge |
| **T2 (23/11), 9:00** | Điền mục "Việc đã làm" |

## Việc cần làm

### 1. Review phần TV1 đã viết thay (#76, #71)

TV1 đã viết `requirements.md`, `spec.md` của UC1 → UC7, bảng FR/NFR trong SRS và phần cập nhật ma trận phân quyền. Người viết là
TV1. Việc của TV2 là **đọc và góp ý bằng review trên PR**:

- Mỗi AC: đúng với SRS, `leave-rules.md`, `document-rules.md` chưa; AC nào còn *chưa chốt* thì ghi đề xuất.
- Ma trận phân quyền: quyền khớp `@Roles` và service trên `dev`.
- Chọn Comment hoặc Request changes, chỉ rõ dòng và cách sửa. Không sửa thẳng vào nhánh của TV1.

Báo cáo tuần ghi "TV2 review ... trên #76", không ghi TV2 viết.

### 2. `docs/org-integrity-rules` (UC1, UC2, UC7)

Ghi vào `docs/business/` theo dạng quy tắc đánh số, có ví dụ:

1. Nhân viên còn cấp dưới thì có được chấm dứt không, ai nhận cấp dưới.
2. `headEmployeeId` của phòng ban nghĩa là gì, có phải trưởng phòng không.
3. Audit có ghi giá trị trường cá nhân không, hay chỉ tên nhóm trường.
4. Thời gian lưu audit: BR-13 (5 năm) hay NFR-6.3 (2 năm); sửa chỗ còn lại cho khớp.
5. Mục nhân viên được gửi yêu cầu sửa (FR-1.9), thời hạn HR xử lý (FR-1.14).

### 3. `docs/leave-rules-week11` (chuẩn bị UC3, UC4)

Bổ sung `leave-rules.md`: phép năm khi chưa đủ 12 tháng, thâm niên; nghỉ theo sự kiện; đơn qua hai năm; hủy đơn đã duyệt; chỉ
hoàn tất sau ngày kết thúc; nhắc đơn chờ lâu. Phải merge T6 (20/11) để TV4 viết ca kiểm thử và TV1 code từ T2 (23/11).

## Góp ý review

_Góp ý ghi trực tiếp trên PR._

## Việc đã làm

_Điền T2 (23/11), 9:00._
