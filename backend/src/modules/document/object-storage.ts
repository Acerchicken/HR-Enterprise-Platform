import { Inject, Injectable } from '@nestjs/common';
import { S3Bucket } from '../../common/s3-bucket';
import { APP_CONFIG, AppConfig } from '../../config/config';

/**
 * Object storage cho file tài liệu: S3 trên AWS, MinIO khi chạy local (cùng API S3).
 * Upload: trình duyệt PUT thẳng lên storage bằng presigned URL ngắn hạn, file không đi qua API (FR-5.1).
 * Download: luôn qua API sau khi kiểm quyền (DR-06), không phát presigned URL tải xuống.
 */
@Injectable()
export class ObjectStorage extends S3Bucket {
  constructor(@Inject(APP_CONFIG) cfg: AppConfig) {
    super(cfg.storage, cfg.storage.bucket, 'Kho tài liệu chưa được cấu hình (STORAGE_BUCKET)');
  }
}
