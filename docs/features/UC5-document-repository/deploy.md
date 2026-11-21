# UC5 – Kho tài liệu chính sách: triển khai

> Cách chạy chung, staging, rollback chung: [README](../README.md#môi-trường). File này chỉ ghi phần riêng của UC5.
> Quyết định thiết kế: [ADR-13](../../architecture/adr/ADR-13-document-storage.md).

## 1. Thành phần

| Thành phần | Phần của UC5 |
|---|---|
| API | `backend/src/modules/document` (metadata, phạm vi, phiên bản, presigned URL tải lên, stream tải xuống; `object-storage.ts`) |
| Web | Chưa có (nhánh `feat/document-ui`) |
| Database | Schema `document` (`document`, `document_scope`, `document_version`); migration `1731300000000-Documents` |
| Dịch vụ ngoài | Object storage: MinIO (local), S3 (staging) |

## 2. Biến môi trường

| Biến | Local (S3Mock/MinIO) | Staging (S3) | Thiếu thì sao |
|---|---|---|---|
| `STORAGE_BUCKET` | Tên bucket, ví dụ `hr-documents` | Bucket do Terraform tạo | Mọi API tài liệu trả 503; chức năng khác vẫn chạy |
| `STORAGE_ENDPOINT` | `http://s3mock:9090` (hoặc `http://localhost:9090` khi chạy ngoài Docker) | Để trống | – |
| `STORAGE_PUBLIC_ENDPOINT` | `http://localhost:9090` (trình duyệt PUT file vào đây) | Để trống | Trình duyệt không PUT được |
| `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY` | `test` / `test` (với S3Mock local) | Để trống, dùng IAM role của App Runner | – |
| `STORAGE_REGION` | Mặc định | `AWS_REGION` | – |

## 3. Hạ tầng

| Môi trường | Tài nguyên | File |
|---|---|---|
| Local | S3Mock trong docker-compose (cổng 9090, tự tạo sẵn bucket `hr-documents` và `hr-profile-files-local`) | Nhánh `chore/minio-local` (chưa merge) |
| Staging | Bucket S3 tài liệu: chặn public (NFR-5.19), mã hóa KMS (NFR-5.16), CORS cho domain web với `PUT`; IAM cho App Runner: `GetObject`, `PutObject`, `DeleteObject` trên bucket | Nhánh `infra/documents-email` (chưa merge) |

## 4. Các bước

- **Local:** docker-compose đã có `s3mock` (cổng 9090) tự khởi tạo bucket `hr-documents` và `hr-profile-files-local`. API tự kết nối qua mạng nội bộ Docker (`http://s3mock:9090`) và cấp presigned URL với `http://localhost:9090` cho trình duyệt.
- **Staging:**
  1. Merge `infra/documents-email`, `terraform plan` rồi TV1 duyệt, `apply` (tuần 12).
  2. Thêm `STORAGE_BUCKET` vào biến môi trường App Runner (`app_runner.tf`).
  3. Kiểm CORS bucket cho phép origin CloudFront của web.

## 5. Kiểm tra sau deploy

1. `GET /documents` bằng nhân viên: 200 (không phải 503).
2. HR tạo tài liệu PDF nhỏ, PUT file theo URL nhận được, xác nhận: phiên bản `READY`.
3. Nhân viên trong phạm vi tải được đúng nội dung; nhân viên ngoài phạm vi nhận 404.
4. Mở thẳng URL object trên S3 không kèm chữ ký: bị từ chối (bucket không public).

## 6. Rollback và sự cố

- Storage lỗi: chỉ API tài liệu lỗi, chức năng khác chạy tiếp (NFR-3.4).
- Revert migration `Documents` xóa metadata tài liệu nhưng file vẫn còn trong bucket: chỉ revert khi chưa có dữ liệu thật.
- Rollback image không xóa file trong bucket.

## 7. Còn thiếu

- MinIO local và Terraform bucket đang ở hai nhánh chưa merge (xem [configuration.md mục 5](../../development/configuration.md#5-điểm-còn-thiếu-trên-staging-13112026)).
- Không dọn phiên bản `PENDING` bỏ dở (đánh đổi ADR-13); có thể đặt lifecycle rule xóa object chưa xác nhận sau 1 ngày.
