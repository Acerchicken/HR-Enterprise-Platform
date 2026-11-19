# Tuần 11 – TV2 (Thanh): quy tắc đi trước code, review nghiệp vụ mỗi PR

Vai trò: chốt quy tắc nghiệp vụ trước khi TV1 code và TV4 viết ca kiểm thử; review nghiệp vụ PR của TV1.

> **Cập nhật 16/11:** UC1 đã code xong; tuần này TV1 code tiếp UC3, UC4 (T3 → T6), UC7, UC2 loại đơn vị (T6), UC5 (T7). Các hạn
> của TV2 dời lên sớm hơn để quy tắc có trước khi code. Các hạn ngày 16/11 chưa làm được dời sang T3 (17/11).

## Hạn chót

| Hạn | Việc |
|---|---|
| **T3 (17/11), 21:00** | Review `requirements.md`, `spec.md` UC1, UC2, bảng FR trong SRS, ma trận phân quyền trên #76 (hạn cũ 16/11) |
| **T3 (17/11), 21:00** | Mở PR `docs/org-integrity-rules` (rà lại quy tắc TV1 đã code, mục 2) |
| **T4 (18/11), 12:00** | Mở PR `docs/leave-rules-week11`; review `requirements.md`, `spec.md` UC3, UC4 trên #76 |
| **T4 (18/11), 21:00** | Review bản vẽ UC2 → UC7 trên #81 (ý kiến từng đề xuất ở `frontend.md` mục 10.8); comment nghiệp vụ trên #84, #86, #89, #90 (UC1 đã merge) |
| **T5 (19/11), 21:00** | Việc tuần 10 còn tồn: mở PR `docs/matrix-week10` (threat model, API tài liệu nếu thiếu) |
| **T6 (20/11)** | Review `requirements.md`, `spec.md` UC5, UC7 trên #76 |
| Trong 24 giờ kể từ khi PR mở | Review nghiệp vụ `feat/leave-privacy`, `feat/leave-delegation`, `fix/leave-balance-rules`, `feat/leave-hr-approval`, `feat/audit-ui`, `feat/org-unit-types`, `feat/document-ui` |
| **T2 (23/11), 9:00** | Điền mục "Việc đã làm" |

## Việc cần làm

### 1. Review phần TV1 đã viết thay (#76, #71, #81)

TV1 đã viết `requirements.md`, `spec.md` của UC1 → UC7, bảng FR/NFR trong SRS, phần cập nhật ma trận phân quyền và bản vẽ giao
diện. Người viết là TV1. Việc của TV2 là **đọc và góp ý bằng review trên PR** (Comment hoặc Request changes, chỉ rõ dòng sai và
cách sửa). Báo cáo tuần ghi "TV2 review ... trên #76", không ghi TV2 là người viết.

### 2. `docs/org-integrity-rules` (UC1, UC2, UC7)

TV1 đã code các quy tắc này ở #84, #86 và viết ADR-14 (#83). TV2 đọc code và tài liệu, rồi chốt bằng văn bản trong `docs/business/`:

1. Nhân viên còn cấp dưới thì có được chấm dứt không, ai nhận cấp dưới (code hiện chặn).
2. `headEmployeeId` và trưởng, phó đơn vị theo loại đơn vị (ADR-14).
3. Audit ghi tên nhóm trường hay giá trị trường cá nhân.
4. Thời gian lưu audit: BR-13 (5 năm) hay NFR-6.3 (2 năm).
5. Mục nhân viên được gửi yêu cầu sửa (FR-1.9), thời hạn HR xử lý (FR-1.14).

Điểm nào khác với code thì ghi rõ, TV1 sửa ở PR mới.

### 3. `docs/leave-rules-week11` (UC3, UC4, cần trước T5)

Bổ sung `leave-rules.md`: phép năm khi chưa đủ 12 tháng, thâm niên; nghỉ theo sự kiện; đơn qua hai năm; hủy đơn đã duyệt; chỉ
hoàn tất sau ngày kết thúc; nhắc đơn chờ lâu. TV1 code `fix/leave-balance-rules` từ T5 (19/11); quá hạn thì TV1 làm theo đề xuất
trong `requirements.md` và TV2 góp ý trên PR code.

### 4. Review nghiệp vụ PR code

Mỗi PR code ở bảng trên một review trên GitHub trong 24 giờ, nêu đã đối chiếu quy tắc nào (BR, DR, AC). Tuần 10 chưa có review
nào; TV1 merge sau 24 giờ dù chưa có review, và báo cáo ghi PR nào thiếu.

## Góp ý review

_Góp ý ghi trực tiếp trên PR._

## Việc đã làm

_Điền T2 (23/11), 9:00._
