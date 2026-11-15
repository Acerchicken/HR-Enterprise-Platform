# Bộ ca kiểm thử chức năng – Tuần 10

- **Phạm vi:** Kho tài liệu (DOC), Tìm kiếm (SRCH), Hồ sơ nhân sự (EMP), Audit log (AUD).
- **Mục tiêu:** Kiểm tra quy tắc nghiệp vụ và phân quyền theo đặc tả Use Case.

## 1. Kho tài liệu (DOC)
- **TC-DOC-01:** HR tải lên file tài liệu đúng định dạng (`.pdf`, `.docx`) -> Kỳ vọng: HTTP 201, tạo thành công.
- **TC-DOC-02:** Tải lên file sai định dạng (file `.exe` đổi đuôi thành `.pdf`) -> Kỳ vọng: Hệ thống từ chối (400 Bad Request).
- **TC-DOC-03:** Nhân viên thường truy cập kho tài liệu quản lý -> Kỳ vọng: Bị chặn (403 Forbidden).

## 2. Tìm kiếm (SRCH)
- **TC-SRCH-01:** Tìm kiếm từ khóa trong phạm vi cho phép -> Kỳ vọng: Trả về kết quả đúng quyền.
- **TC-SRCH-02:** Tìm kiếm tài liệu ngoài phạm vi phân quyền -> Kỳ vọng: Trả 404 như không tồn tại.

## 3. Hồ sơ nhân sự (EMP)
- **TC-EMP-01:** HR tạo/sửa hồ sơ kèm quản lý trực tiếp -> Kỳ vọng: HTTP 200/201, audit ghi đúng tên trường nhạy cảm.
- **TC-EMP-02:** Nhân viên cố gắng sửa trường nhạy cảm của người khác -> Kỳ vọng: Bị chặn (403).
- **TC-EMP-03:** Gán quản lý tạo vòng lặp hoặc quản lý đã nghỉ việc -> Kỳ vọng: Trả lỗi 400.

## 4. Nhật ký hệ thống (Audit Log - AUD)
- **TC-AUD-01:** Lọc nhật ký thao tác theo đối tượng/khoảng thời gian -> Kỳ vọng: Hiển thị đúng, không lộ giá trị nhạy cảm.
- **TC-AUD-02:** Nhân viên thường gọi API audit log -> Kỳ vọng: Bị chặn (403).