# UC5 – Kho tài liệu chính sách: triển khai

> Cách chạy chung, staging, rollback chung: [README](../README.md#môi-trường). File này chỉ ghi phần riêng của UC5.
> Quyết định thiết kế: [ADR-13](../../architecture/adr/ADR-13-document-storage.md).

## 1. Thành phần

| Thành phần | Phần của UC5 |
|---|---|
| API | `backend/src/modules/document` (metadata, phạm vi, phiên bản, presigned URL tải lên, stream tải xuống; `object-storage.ts`) |
| Web | Đang làm (nhánh `feat/document-ui`) |
| Database | Schema `document` (`document`, `document_scope`, `document_version`); migration `1731300000000-Documents` |
| Dịch vụ ngoài | Object storage: S3Mock (local), S3 (staging) |
| Queue (sau ADR-15) | Event `document.*` qua outbox chung cho assistant service của UC6 (spec 13.2, ADR-16, `feat/assistant-service`); lần đầu chạy `npm run assistant:sync` |

## 2. Biến môi trường

| Biến | Local (S3Mock) | Staging (S3) | Thiếu thì sao |
|---|---|---|---|
| `STORAGE_BUCKET` | `hr-documents` | Bucket do Terraform tạo (`app_runner.tf` đã đặt) | Tạo, thêm phiên bản, xác nhận, tải xuống trả 503; danh sách, chi tiết, quản lý metadata vẫn 200; chức năng khác vẫn chạy |
| `STORAGE_ENDPOINT` | `http://s3mock:9090` (hoặc `http://localhost:9090` khi chạy ngoài Docker) | Để trống | – |
| `STORAGE_PUBLIC_ENDPOINT` | `http://localhost:9090` (trình duyệt PUT file vào đây) | Để trống | Trình duyệt không PUT được |
| `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY` | `test` / `test` (với S3Mock local) | Để trống, dùng IAM role của App Runner | – |
| `STORAGE_REGION` | Mặc định | `AWS_REGION` | – |

## 3. Hạ tầng

| Môi trường | Tài nguyên | File |
|---|---|---|
| Local | S3Mock trong docker-compose (cổng 9090, tự tạo sẵn bucket `hr-documents` và `hr-profile-files-local`) | `docker-compose.yml` (PR #68) |
| Staging | Bucket S3 tài liệu: chặn public (NFR-5.19), CORS cho domain CloudFront; IAM cho App Runner: `GetObject`, `PutObject`, `DeleteObject`, `ListBucket`; ECS worker: `GetObject` | `infra/staging/s3_cloudfront.tf`, `app_runner.tf` (PR #70, chưa apply) |

Lệch giữa Terraform đã merge và yêu cầu (kiểm chéo 22/11, TV3 sửa trước khi apply):

- Mã hóa đang là SSE-S3 (`sse_algorithm = "AES256"`); NFR-5.16 yêu cầu khóa KMS (`aws:kms` với `aws_kms_key.main`, kèm quyền
  `kms:GenerateDataKey`, `kms:Decrypt` cho App Runner đã có).
- CORS cho phép `PUT`, `GET`, `HEAD`; ADR-13 chỉ cần `PUT` (tải xuống đi qua API).
- `force_destroy = true` xóa cả file khi `terraform destroy`; chấp nhận được cho staging, ghi rõ để không mang lên môi trường thật.
- Chưa có bucket file hồ sơ (`PROFILE_STORAGE_BUCKET`, UC1; F3 trong [staging-readiness](../../cloud/staging-readiness.md)).
- Chưa có queue `assistant.document` và `SQS_ASSISTANT_QUEUE_URL` cho API: event tài liệu bị bỏ qua trên staging (F4).

## 4. Các bước

- **Local:** docker-compose đã có `s3mock` (cổng 9090) tự khởi tạo bucket `hr-documents` và `hr-profile-files-local`. API tự kết nối qua mạng nội bộ Docker (`http://s3mock:9090`) và cấp presigned URL với `http://localhost:9090` cho trình duyệt.
- **Staging:**
  1. Sửa các điểm lệch ở mục 3, `terraform plan` rồi TV1 duyệt, `apply` (tuần 12).
  2. Kiểm `STORAGE_BUCKET`, `STORAGE_REGION` đã có trong biến môi trường App Runner sau khi apply.
  3. Kiểm CORS bucket chỉ cho origin CloudFront của web.

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

- Terraform bucket đã merge nhưng chưa apply, còn lệch KMS và CORS (mục 3; [configuration.md mục 5](../../development/configuration.md#5-điểm-còn-thiếu-trên-staging)).
- Không dọn phiên bản `PENDING` bỏ dở (đánh đổi ADR-13); có thể đặt lifecycle rule xóa object chưa xác nhận sau 1 ngày.
