# UC5 – Kho tài liệu chính sách: kiểm thử

> Tiêu chí: [requirements.md](requirements.md). Cách chạy chung, tài khoản mẫu: [README](../README.md#kiểm-thử).
> Ca kiểm thử tay: [progress tuần 10 của TV4](../../progress/tuan-10/TV4_Duy.md); ca bổ sung ở nhánh `docs/test-cases-uc2-uc5-uc7` (#123).

## 1. Chiến lược

Rủi ro chính là **lộ tài liệu ngoài phạm vi**, kể cả gián tiếp qua tiêu đề, số lượng, mã lỗi khác nhau (DR-08), và file độc hại
đổi đuôi. Vì vậy:

- Unit test kiểm hàm phạm vi và kiểm loại file theo nội dung.
- e2e chạy với object storage S3 tương thích (S3Mock ở local): đăng, tải lên, xác nhận, tải xuống, ẩn, đổi phòng ban.
- Ca tay bắt buộc có: phòng ban con, nhiều phạm vi theo phép OR, đổi phòng ban rồi tải ngay, tài liệu ẩn, đoán ID tài liệu
  ngoài phạm vi, file đổi đuôi.

## 2. Test tự động đã có

| Mức | File | Nội dung |
|---|---|---|
| Unit | `backend/src/modules/document/document-rules.spec.ts` | PDF/DOCX, content type khớp đuôi, 20 MiB; ZIP đổi đuôi bị từ chối; phạm vi toàn công ty, phòng ban con, phép OR, tài liệu ẩn |
| e2e | `backend/test/app.e2e-spec.ts`, nhóm "kho tài liệu" | Đặt `STORAGE_BUCKET` thì chạy với S3Mock; không đặt thì dùng bucket giả trong bộ nhớ (`test/fake-storage.ts`). Liệt kê ở mục 3 |

## 3. Bảng phủ tiêu chí

| Tiêu chí | Test tự động (e2e, tên test) | Ca tay | Trạng thái |
|---|---|---|---|
| AC-5.1.1, AC-5.1.2 | Hàm `publish` dùng trong mọi test của nhóm | Tuần 10 | Có |
| AC-5.1.3 | "phạm vi theo vai trò; … chỉ HR quản lý kho" | Tuần 10 | Có |
| AC-5.1.4 | Unit `document-rules.spec.ts`; e2e "file sai định dạng hoặc chưa tải lên bị từ chối" (kiểm `fields`) | Tuần 10 | Có |
| AC-5.1.5, AC-5.1.6 | "file sai định dạng hoặc chưa tải lên bị từ chối (DR-01)" | File đổi đuôi | Có |
| AC-5.1.7 | "kho chưa cấu hình: danh sách vẫn 200, API đụng tới file trả 503" (chỉ chạy với bucket giả) | Chạy API không có `STORAGE_BUCKET`: `GET /documents` phải **200**, `POST /documents` và tải xuống phải 503 | Có |
| AC-5.1.9 | "phạm vi chỉ nhận đơn vị đang hoạt động; đơn vị đã có trong phạm vi thì giữ được" | Chọn đơn vị `INACTIVE` làm phạm vi | Có |
| AC-5.1.8, AC-5.2.7 | – (e2e "trang quản lý: tìm theo tiêu đề, lọc…" kiểm API của trang quản lý) | Đăng tài liệu trên giao diện, lỗi hiện đúng ô; trang `/documents` lọc loại, mở chi tiết, tải | Có giao diện; TV4 chạy ca tay |
| AC-5.2.1 | "phạm vi phòng ban gồm phòng ban con…" | Phòng ban con | Có |
| AC-5.2.10 | "nhân viên tìm tài liệu theo từ khóa, không cần dấu; không lộ tài liệu ngoài phạm vi" | Trang `/documents` gõ "nghi phep": kết quả đổi sau khoảng 0,3 s; từ khóa không khớp hiện gợi ý hỏi trợ lý | Có |
| AC-5.2.2 | Unit "nhiều phạm vi là phép cộng…" | Nhiều phạm vi | Có |
| AC-5.2.3 | "phạm vi theo vai trò; ngoài phạm vi trả 404 như không tồn tại…" | Đoán ID | Có |
| AC-5.2.4, AC-5.2.5 | "ẩn tài liệu thì không ai xem được, khôi phục thì xem lại được; đổi phòng ban mất quyền ngay" | Đổi phòng ban, tài liệu ẩn | Có |
| AC-5.2.6 | "… tải qua API đúng nội dung" | – | Có |
| AC-5.3.1, AC-5.3.2 | "phiên bản mới không ghi đè phiên bản cũ; mặc định tải bản mới nhất (DR-04)" | – | Có |
| AC-5.3.3 | "sửa metadata cần version đúng (optimistic locking)" | – | Có |
| AC-5.2.8, AC-5.2.9 | – | Trưởng đơn vị không có cấp dưới; tài khoản ADMIN không hồ sơ | Cần thêm |
| AC-5.4.1 → AC-5.4.4 | – | – | Chưa có code (spec 13.2) |

## 4. Dữ liệu và tài khoản

- Test tạo tài liệu có tiêu đề bắt đầu bằng `E2E ` và tự xóa sau khi chạy.
- File mẫu: PDF nhỏ sinh trong test; ZIP đổi đuôi `.pdf` để thử AC-5.1.6.
- Ca phòng ban con dùng khối Kỹ thuật và phòng Web trong seed.

## 5. Cách chạy

```bash
# S3Mock trong docker-compose ở localhost:9090, bucket hr-documents tạo sẵn
cd backend
export STORAGE_BUCKET=hr-documents STORAGE_ENDPOINT=http://localhost:9090 \
       STORAGE_ACCESS_KEY_ID=test STORAGE_SECRET_ACCESS_KEY=test
npm test -- document
npm run test:e2e        # test tự tạo bucket nếu chưa có
```

Không đặt `STORAGE_BUCKET` thì nhóm "kho tài liệu" chạy với bucket giả trong bộ nhớ (`test/fake-storage.ts`); đặt thì chạy với
S3Mock/MinIO thật. CI chạy e2e với bucket giả ở mọi PR (job `Backend (E2E & OpenAPI)`, từ 25/11); biên bản ghi rõ đã chạy với loại nào.

## 6. Kiểm thử phi chức năng

- NFR-5.19: mở URL object không chữ ký trên staging bị từ chối; URL tải lên hết hạn sau 10 phút (E8 trong spec).
- NFR-5.23: thử `.exe` đổi đuôi `.pdf`.
- Băng thông tải xuống qua API (đánh đổi ADR-13): đo trong load test tuần 11.

## 7. Ca còn thiếu (TV4)

- AC-5.1.7 (503 khi chưa cấu hình kho).
- URL tải lên quá 10 phút bị storage từ chối.
- Giao diện (AC-5.1.8, AC-5.2.7) khi `feat/document-ui` xong.
- Chạy lại toàn bộ trên staging tuần 12.
- Ngoại lệ bổ sung [spec mục 6.1](spec.md#61-ngoại-lệ-bổ-sung-rà-24112026) (E9 → E16): mỗi mã ít nhất một ca e2e hoặc unit. ca của E9, E11, E12, E13, E14 xác nhận code đã đúng, sai thì chuyển sang "Chưa đạt" trong spec.
