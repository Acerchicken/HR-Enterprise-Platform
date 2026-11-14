# UC5 – Kho tài liệu chính sách: yêu cầu và tiêu chí chấp nhận

> Đọc file này trước khi mở nhánh làm UC5. Luồng chi tiết: [spec.md](spec.md). Nguồn FR: [SRS mục 4.5](../../requirements/SRS.md#45-uc5--kho-tài-liệu-chính-sách-fr-5x).
> Quy tắc: [document-rules.md](../../business/document-rules.md), [ADR-13](../../architecture/adr/ADR-13-document-storage.md).
> Mỗi tiêu chí `AC-x.y.z` là một ca kiểm thử.

## 1. User story

| Mã | Là | Tôi muốn | Để | FR |
|---|---|---|---|---|
| US-5.1 | HR | Đăng tài liệu PDF, DOCX và chọn ai được xem | Đúng người thấy đúng chính sách | FR-5.1 |
| US-5.2 | Nhân viên | Xem và tải tài liệu áp dụng cho mình | Tự tra chính sách, không hỏi HR | FR-5.2 |
| US-5.3 | HR | Đăng bản mới mà vẫn giữ bản cũ | Nhân viên thấy bản mới nhất, vẫn tra lại được bản cũ | FR-5.3 |
| US-5.4 | HR | Ẩn tài liệu thay vì xóa | Gỡ tài liệu sai mà không mất lịch sử | FR-5.2 (DR-05) |

## 2. Tiêu chí chấp nhận

### FR-5.1 HR đăng tài liệu (M, có API, chưa có giao diện)

- **AC-5.1.1** Khi HR tạo tài liệu với tiêu đề, loại, ít nhất một phạm vi, file PDF hoặc DOCX từ 1 byte đến 20 MiB. Thì trả
  tài liệu, phiên bản 1 `PENDING` và URL tải lên hết hạn sau 10 phút; có audit `DOCUMENT_CREATE`.
- **AC-5.1.2** Khi trình duyệt PUT file lên storage rồi gọi xác nhận. Thì phiên bản `READY`, audit `DOCUMENT_PUBLISH`; file
  không đi qua API.
- **AC-5.1.3** Khi vai trò khác HR tạo, sửa, ẩn tài liệu. Thì trả 403.
- **AC-5.1.4** Khi thiếu tiêu đề, phạm vi rỗng, loại sai, file không phải PDF/DOCX hoặc quá 20 MiB. Thì trả 400 kèm `fields`.
- **AC-5.1.5** Khi xác nhận lúc chưa tải file. Thì trả 400, phiên bản vẫn `PENDING`.
- **AC-5.1.6** Khi file sai dung lượng khai báo hoặc nội dung không khớp đuôi (ZIP đổi đuôi `.pdf`). Thì phiên bản `REJECTED`,
  file bị xóa, trả 400. Xác nhận lại phiên bản đó thì trả 409. Xác nhận lại phiên bản đã `READY` thì trả
  lại tài liệu, không đổi gì.
- **AC-5.1.7** Khi chưa cấu hình `STORAGE_BUCKET`. Thì tạo, thêm phiên bản, xác nhận, tải xuống trả 503; danh sách, chi tiết
  vẫn 200; chức năng khác vẫn chạy.
- **AC-5.1.8** *(chưa có)* HR đăng tài liệu trên giao diện: chọn file, nhập metadata, thấy tiến độ tải lên, lỗi hiện đúng ô.

### FR-5.2 Nhân viên xem, tải trong phạm vi (M, có API, chưa có giao diện)

- **AC-5.2.1** Giả sử tài liệu có phạm vi phòng ban P. Khi nhân viên thuộc phòng ban con của P mở danh sách. Thì thấy tài liệu
  (DR-02).
- **AC-5.2.2** Giả sử tài liệu có hai phạm vi (phòng ban P, vai trò `MANAGER`). Khi người khớp một trong hai mở. Thì thấy (phép
  OR).
- **AC-5.2.3** Khi người ngoài phạm vi gọi chi tiết hoặc tải theo ID. Thì trả 404 giống hệt ID không tồn tại; danh sách không
  có tiêu đề hay số lượng của tài liệu đó (DR-08).
- **AC-5.2.4** Giả sử nhân viên vừa chuyển khỏi phòng ban P. Khi tải ngay tài liệu của P. Thì trả 404 (DR-06).
- **AC-5.2.5** Khi HR ẩn tài liệu. Thì mọi nhân viên nhận 404; HR vẫn thấy ở trang quản lý; khôi phục thì xem lại được (DR-05).
- **AC-5.2.6** Khi tải. Thì API kiểm lại phạm vi rồi stream file; response không chứa link storage.
- **AC-5.2.7** *(chưa có)* Trang "Tài liệu": danh sách mới cập nhật trước, lọc theo loại, mở chi tiết, tải bản mới nhất.

### FR-5.3 Phiên bản (S, có API, chưa có giao diện)

- **AC-5.3.1** Khi HR thêm phiên bản. Thì số phiên bản tăng 1, bản cũ giữ nguyên, tải mặc định trả bản mới nhất (DR-04).
- **AC-5.3.2** Khi tải bản cũ qua `versions/{versionId}/download`. Thì nhận đúng nội dung bản cũ.
- **AC-5.3.3** Khi HR đổi phạm vi. Thì phạm vi mới áp dụng cho mọi phiên bản. Sửa metadata với `version` cũ thì trả 409.

## 3. Yêu cầu phi chức năng liên quan

NFR-5.16 (mã hóa file khi lưu); NFR-5.19 (bucket chặn public); NFR-5.23 (kiểm loại file theo nội dung); NFR-3.4 (storage lỗi
không ảnh hưởng chức năng khác). Băng thông tải xuống qua API (đánh đổi của ADR-13) đo trong load test tuần 11.

## 4. Việc còn lại

Lịch làm theo [kế hoạch hoàn thành từng chức năng](../../progress/ke-hoach-tong.md#7-kế-hoạch-hoàn-thành-từng-chức-năng-tuần-10--13).

| Việc | Tiêu chí | Người | Nhánh | Tuần |
|---|---|---|---|---|
| MinIO trong docker-compose | AC-5.1.2 chạy được ở local | TV3 | `chore/minio-local` | 10 |
| Giao diện kho tài liệu (HR và nhân viên) | AC-5.1.8, AC-5.2.7 | TV1 | `feat/document-ui` | 12 |
| Bucket tài liệu, `STORAGE_*` cho staging | AC-5.1.7 trên staging | TV3 | `infra/documents-email` | 10 (code), 12 (apply) |
| Chạy ca kiểm thử UC5 trên staging | Mọi AC-5.x | TV4 | `docs/test-report-uc5-uc6-uc7` | 13 |
| Dọn phiên bản `PENDING` bỏ dở | – | – | – | Không làm, đánh đổi ghi ở ADR-13 |
