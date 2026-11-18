import { ServiceUnavailableException } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  PutObjectTaggingCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'crypto';
import { Readable } from 'stream';
import { AppConfig } from '../config/config';

/**
 * Một bucket S3 (MinIO khi chạy local). Dùng chung cho kho tài liệu (UC5) và file hồ sơ (UC1, bucket riêng vì quyền đọc và
 * thời hạn giữ khác nhau, spec UC1 13.3). Bucket chưa cấu hình thì mọi thao tác trả 503, phần còn lại của API vẫn chạy.
 */
export class S3Bucket {
  private readonly client: S3Client | null;
  /** Client ký URL cho trình duyệt (endpoint công khai khác endpoint nội bộ khi chạy Docker). */
  private readonly signer: S3Client | null;

  constructor(
    storage: AppConfig['storage'],
    private readonly bucket: string | null,
    private readonly notConfigured: string,
  ) {
    const make = (endpoint: string | null) =>
      new S3Client({
        region: storage.region,
        ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
        ...(storage.accessKeyId && storage.secretAccessKey
          ? { credentials: { accessKeyId: storage.accessKeyId, secretAccessKey: storage.secretAccessKey } }
          : {}),
      });
    this.client = bucket ? make(storage.endpoint) : null;
    this.signer = bucket ? make(storage.publicEndpoint) : null;
  }

  get configured(): boolean {
    return !!this.bucket;
  }

  protected ready(): { client: S3Client; signer: S3Client; bucket: string } {
    if (!this.client || !this.signer || !this.bucket) throw new ServiceUnavailableException(this.notConfigured);
    return { client: this.client, signer: this.signer, bucket: this.bucket };
  }

  /** URL PUT có hạn 10 phút; content type và dung lượng bị ràng buộc vào chữ ký. */
  async uploadUrl(key: string, contentType: string, size: number): Promise<{ url: string; method: 'PUT'; headers: Record<string, string>; expiresInSeconds: number }> {
    const { signer, bucket } = this.ready();
    const expiresIn = 600;
    const url = await getSignedUrl(signer, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ContentLength: size }), { expiresIn });
    return { url, method: 'PUT', headers: { 'Content-Type': contentType }, expiresInSeconds: expiresIn };
  }

  async head(key: string): Promise<{ size: number } | null> {
    const { client, bucket } = this.ready();
    try {
      const r = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return { size: Number(r.ContentLength ?? 0) };
    } catch (e: any) {
      if (e?.$metadata?.httpStatusCode === 404 || e?.name === 'NotFound') return null;
      throw e;
    }
  }

  /** Đọc vài KB đầu để kiểm định dạng thực của file. */
  async readHead(key: string, bytes = 4096): Promise<Uint8Array> {
    const { client, bucket } = this.ready();
    const r = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: `bytes=0-${bytes - 1}` }));
    return r.Body ? await r.Body.transformToByteArray() : new Uint8Array();
  }

  async read(key: string): Promise<Buffer> {
    const { client, bucket } = this.ready();
    const r = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return Buffer.from(r.Body ? await r.Body.transformToByteArray() : new Uint8Array());
  }

  /** SHA-256 tính lại từ object trên storage (không tin giá trị trình duyệt khai). */
  async sha256(key: string): Promise<string> {
    const hash = createHash('sha256');
    for await (const chunk of await this.stream(key)) hash.update(chunk as Buffer);
    return hash.digest('hex');
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const { client, bucket } = this.ready();
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
  }

  /** Gắn tag để lifecycle rule của bucket xóa object sau 30 ngày (spec UC1 mục 7). */
  async tag(key: string, tags: Record<string, string>): Promise<void> {
    const { client, bucket } = this.ready();
    await client.send(
      new PutObjectTaggingCommand({
        Bucket: bucket,
        Key: key,
        Tagging: { TagSet: Object.entries(tags).map(([Key, Value]) => ({ Key, Value })) },
      }),
    );
  }

  async stream(key: string): Promise<Readable> {
    const { client, bucket } = this.ready();
    const r = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return r.Body as Readable;
  }

  async remove(key: string): Promise<void> {
    const { client, bucket } = this.ready();
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }
}
