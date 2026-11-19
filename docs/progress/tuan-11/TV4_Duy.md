# Tuần 11 – TV4 (Duy): ca kiểm thử đi trước code, biên bản chạy thật

Vai trò: viết ca kiểm thử trước khi TV1 code mỗi UC, chạy thật chức năng đã merge và ghi đúng kết quả quan sát được (nguyên tắc
ghi kết quả như [tuần 10](../tuan-10/TV4_Duy.md#nguyên-tắc-ghi-kết-quả-kiểm-thử-bắt-buộc)).

> **Cập nhật 16/11:** UC1 đã code xong; tuần này TV1 code UC3, UC4 (T3 → T6), UC7, UC2 loại đơn vị (T6), UC5 (T7). Ca kiểm thử
> dời lên sớm để có trước code. Biên bản tuần 10 (#91) chưa đạt vì không có ca nào chạy thật.

## Hạn chót

| Hạn | Việc |
|---|---|
| **T3 (17/11), 21:00** | Review `test.md` UC1 trên #76; mở PR `docs/test-cases-uc1` |
| **T4 (18/11), 21:00** | Sửa #91: viết ca cho #60, #63, #64 rồi chạy thật (mục 2) |
| **T4 (18/11), 21:00** | Chạy thử UC1 đã merge (#84, #86, #87, #89, #90), comment kết quả trên từng PR |
| **T5 (19/11)** | Review bản vẽ UC3, UC4 trên #81 |
| **T5 (19/11), 21:00** | Mở PR `docs/test-cases-uc3-uc4` |
| **T6 (20/11)** | Mở PR `test/load-k6` |
| **T6 (20/11), 21:00** | Mở PR `docs/security-test-cases-week11` |
| **T7 (21/11), 21:00** | Mở PR `docs/test-cases-uc2-uc5-uc7` |
| **CN (22/11), 12:00** | Mở PR `docs/test-report-uc1` |
| Trong 24 giờ kể từ khi PR mở | Review PR code UC3, UC4, UC7, UC5 của TV1: chạy thử theo ca đã viết, ghi request, kết quả |
| **T2 (23/11), 9:00** | Điền mục "Việc đã làm" |

## Việc cần làm

### 1. Review phần TV1 đã viết thay (#76, #81)

TV1 đã viết `test.md` của UC1 → UC7 và bản vẽ giao diện. Người viết là TV1. TV4 đọc, đối chiếu bảng phủ AC với test đang có trên
`dev` và góp ý bằng review trên PR; ca thiếu thì tự viết ở nhánh của mình. Báo cáo ghi "TV4 review", không ghi là người viết.

**Review PR code phải có kết quả chạy.** Comment "đề nghị approve" không kèm request, mã HTTP, ảnh màn hình, commit (như ở #80)
không tính là review kiểm thử.

### 2. Sửa #91 – biên bản tuần 10

Làm theo review trên #91: viết ca (mã ca, tài khoản, bước, mong đợi) cho tính năng tuần 10 (#60 một quản lý và HR duyệt đơn CEO,
#63 HR tạo và sửa hồ sơ, #64 API kho tài liệu), chạy trên `dev`, ghi kết quả thực tế, commit, ngày, mục "Phạm vi chưa kiểm".
Không ghi "Đã kiểm tra" chung chung.

### 3. Ca kiểm thử theo UC

- `docs/test-cases-uc1`: ca còn thiếu ở mục 7 `test.md` UC1, gồm yêu cầu cập nhật hồ sơ, file hồ sơ (loại, dung lượng, người khác
  không tải được), mục HR, thông tin tự tính, `version` (409), nghỉ việc khi còn cấp dưới.
- `docs/test-cases-uc3-uc4`: theo `leave-rules.md` và bản vẽ UC3, UC4: riêng tư lý do nghỉ ốm, người duyệt thay, tạo đơn hộ, số dư,
  hủy đơn đã duyệt, HR duyệt thêm, đổi quản lý khi đơn đang chờ.
- `docs/test-cases-uc2-uc5-uc7`: loại đơn vị và luật cha con, giao diện kho tài liệu (đúng và sai phạm vi), lọc audit, audit không
  chứa giá trị nhạy cảm.
- `docs/security-test-cases-week11`: tự đăng ký, mật khẩu yếu, khóa sau 5 lần sai, hết phiên, MFA, 429, header bảo mật.

### 4. `test/load-k6` (P4, TV1 hỗ trợ)

Chạy local: 50 request/giây trong 15 phút; đo NFR-1.1 → 1.3, NFR-2.1, NFR-2.4 (3,75 triệu bản ghi audit giả). Dùng nhiều tài khoản
hoặc nâng ngưỡng rate limit qua biến môi trường. Ghi máy chạy, commit, p95.

### 5. `docs/test-report-uc1`

Chạy mọi ca UC1 trên `dev` (local); ca chưa chạy đưa vào "Phạm vi chưa kiểm". Biên bản UC3, UC4, UC2, UC5, UC7 chạy tuần 12 trên
staging (kế hoạch tổng 7.5, 7.6).

## Góp ý review

_Góp ý ghi trực tiếp trên PR._

## Việc đã làm

_Điền T2 (23/11), 9:00._
