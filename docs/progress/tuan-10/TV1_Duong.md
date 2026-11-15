# Tuần 10 – TV1 (Duong, nhóm trưởng): hoàn thiện chức năng

Vai trò: code chính, review PR, duyệt `terraform plan`, merge PR, báo cáo thứ 2.

## Cập nhật 14/11

Chưa chức năng nào xong, nên từ CN (15/11) làm xong từng chức năng một theo [kế hoạch tổng mục 7](../ke-hoach-tong.md#7-kế-hoạch-hoàn-thành-từng-chức-năng-tuần-10--13).
Mục 4, 5, 6 bên dưới không làm trong tuần 10 nữa, đã chuyển vào bước của UC tương ứng.

| Hạn | Việc |
|---|---|
| **CN (15/11)** | Mở PR `feat/profile-layout` (UC1, AC-1.8.x, AC-1.3.5), bước 1 của kế hoạch |
| CN (15/11) – T2 (16/11) | Review và merge `infra/idp-hardening`; review #68, #69, #70 của TV3 (góp ý trên PR) |
| T2 (16/11) | Báo cáo tuần 10: ghi đúng người viết. Tài liệu TV1 viết thay (#71, #74, #76) ghi là của TV1; thành viên được ghi phần review của họ ([mục 7.9](../ke-hoach-tong.md#79-phần-tv1-đã-làm-thay-thành-viên-đọc-review-và-góp-ý)) |
| Trước khi merge #76 | Xử lý góp ý "cần sửa" của TV2, TV3, TV4 trên #76 |

## Hạn chót

| Hạn | Việc |
|---|---|
| **T2 (9/11)** | Đóng issue #21; comment quyết định vào #22 |
| Trong 24 giờ kể từ khi PR mở | Review PR của TV2, TV3, TV4 trên GitHub |
| Ngay khi TV3 gửi plan (T5) | Đọc `terraform plan`, ghi lỗi cần sửa trước tuần 12 (không `apply`) |
| **T3 (10/11)** | Mở PR `feat/employee-manager-rule` |
| **T4 (11/11)** | Mở PR `feat/hr-employee-form` |
| **T5 (12/11)** | Mở PR `feat/documents-api` |
| **T6 (13/11)** | Mở PR `feat/document-search` |
| **T7 (14/11)** | Mở PR `feat/audit-ui`, `fix/auth-email-verified` |
| **CN (15/11), 12:00** | Mở PR `feat/leave-delegation` nếu còn thời gian |
| **T2 (16/11)** | Báo cáo tuần 10, tạo thư mục tuần 11, PR `dev` → `main` (merge commit), tag `week-10` |

## Việc cần làm

### 1. `feat/employee-manager-rule` – issue #22 (FR-2.5, FR-4.4)

- Tạo/sửa nhân viên: chức danh khác CEO mà thiếu quản lý thì trả 400; chỉ có một CEO.
- Quản lý được chọn phải đang làm việc.
- `POST /leave-requests/{id}/approve|reject`: HR được duyệt **chỉ** đơn của CEO. Danh sách cho HR có đơn CEO đang chờ.
- Kiểm tra seed đã đúng quy tắc.
- e2e: nhân viên thiếu quản lý → 400; HR duyệt đơn CEO → 200; HR duyệt đơn người khác vẫn 403.

### 2. `feat/hr-employee-form` – HR tạo và sửa hồ sơ (FR-1.4, FR-1.5)

Thiết kế chi tiết đã chốt ở [mục "Chuẩn bị cho tuần 10" của tuần 9](../tuan-09/TV1_Duong.md#chuẩn-bị-cho-tuần-10-đã-chốt-511-đưa-vào-kế-hoạch-tuần-10):
`/employees/new`, `/employees/:id/edit`, một nguồn mô tả trường `FieldDef`, `FieldInput` theo `type`, type sinh từ OpenAPI,
`ApiErrorFilter` trả `fields`, checklist thêm trường trong `CONVENTIONS.md`.

### 3. `feat/documents-api` – kho tài liệu (FR-5.1, 5.2, 5.3)

Làm theo `docs/business/document-rules.md` của TV2.

- Module `document`, schema riêng: tài liệu, phiên bản, phạm vi xem (toàn công ty, phòng ban, vai trò).
- HR xin presigned URL để tải file thẳng lên object storage (MinIO khi local, S3 trên AWS), API chỉ lưu metadata. Kiểm tra loại
  file (PDF, DOCX) và dung lượng.
- Danh sách và link tải lọc theo phạm vi ở service; tài liệu ngoài phạm vi trả 403/404.
- Mặc định hiện phiên bản mới nhất, đăng bản mới không mất bản cũ.
- Audit thao tác tải lên và sửa phạm vi.
- Viết ADR-13 (presigned URL, lọc phạm vi, full-text PostgreSQL thay vì dịch vụ search riêng) trong mục 3 `README.md` tuần 10.

### 4. `feat/document-search` – tìm kiếm và giao diện (FR-6.2)

- Sau khi tải lên, ghi event qua outbox; worker trích văn bản PDF/DOCX, lưu `tsvector`.
- `GET /documents/search?q=`: tìm trong tiêu đề và nội dung, **lọc phạm vi trong truy vấn**, không lọc sau phân trang.
- Màn hình: danh sách, tải lên (chỉ HR), tìm kiếm.
- e2e: nhân viên phòng A không tìm thấy tài liệu của phòng B.

### 5. `feat/audit-ui` và `fix/auth-email-verified`

- Màn hình xem audit cho HR, ADMIN theo đối tượng, người thực hiện, khoảng thời gian (FR-7.3).
- Threat model T-02: chỉ liên kết tài khoản khi email đã xác minh; có e2e hoặc unit test.

### 6. `feat/leave-delegation` – BR-06, BR-12 (mức 3)

Làm theo `docs/business/leave-rules.md`. Hết thời gian thì chuyển sang tuần 11 và ghi vào báo cáo.

- BR-06: bảng phân công người duyệt thay, không chồng lấn; danh sách chờ duyệt và quyền duyệt theo ngày thực hiện.
- BR-12: HR, quản lý tạo đơn hộ; lưu riêng người tạo và chủ đơn; email cho chủ đơn.

### 7. Việc của nhóm trưởng

- Đọc `terraform plan` của TV3: không mở port DB ra internet, không có secret trong code/output, IAM tối thiểu. Tuần 10 không
  `apply`; staging chạy ở tuần 12–13.
- Review trên PR; chỉ approve khi mọi góp ý "cần sửa" đã xử lý.

## Góp ý review

_Góp ý ghi trực tiếp trên PR._

## Việc đã làm

_Điền T2 (16/11)._
