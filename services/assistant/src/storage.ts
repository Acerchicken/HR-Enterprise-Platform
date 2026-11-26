import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { AssistantConfig } from './config';

/** Đọc file tài liệu từ object storage, quyền chỉ đọc (S3 trên AWS, S3Mock khi local). */
export interface FileReader {
  read(objectKey: string): Promise<Buffer>;
}

/** Giới hạn như UC5 (DR-01: tối đa 20 MiB), để file lạ không làm service hết bộ nhớ. */
const MAX_BYTES = 20 * 1024 * 1024;

export class S3FileReader implements FileReader {
  private readonly client: S3Client;

  constructor(private readonly cfg: AssistantConfig['storage']) {
    this.client = new S3Client({
      region: cfg.region,
      ...(cfg.endpoint ? { endpoint: cfg.endpoint, forcePathStyle: true } : {}),
      ...(cfg.accessKeyId && cfg.secretAccessKey
        ? { credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey } }
        : {}),
    });
  }

  async read(objectKey: string): Promise<Buffer> {
    const res = await this.client.send(new GetObjectCommand({ Bucket: this.cfg.bucket, Key: objectKey }));
    if ((res.ContentLength ?? 0) > MAX_BYTES) throw new Error(`File quá lớn (${res.ContentLength} byte)`);
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  }
}
