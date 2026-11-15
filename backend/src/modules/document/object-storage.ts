import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { APP_CONFIG, AppConfig } from '../../config/config';

/**
 * Object storage cho file tài liệu: S3 trên AWS, MinIO khi chạy local (cùng API S3).
 * Upload: trình duyệt PUT thẳng lên storage bằng presigned URL ngắn hạn, file không đi qua API (FR-5.1).
 * Download: luôn qua API sau khi kiểm quyền (DR-06), không phát presigned URL tải xuống.
 */
@Injectable()
export class ObjectStorage {
  private readonly client: S3Client | null;
  /** Client ký URL cho trình duyệt (endpoint công khai khác endpoint nội bộ khi chạy Docker). */
  private readonly signer: S3Client | null;
  private readonly bucket: string | null;

  constructor(@Inject(APP_CONFIG) cfg: AppConfig) {
    const s = cfg.storage;
    this.bucket = s.bucket;
    const make = (endpoint: string | null) =>
      new S3Client({
        region: s.region,
        ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
        ...(s.accessKeyId && s.secretAccessKey ? { credentials: { accessKeyId: s.accessKeyId, secretAccessKey: s.secretAccessKey } } : {}),
      });
    this.client = s.bucket ? make(s.endpoint) : null;
    this.signer = s.bucket ? make(s.publicEndpoint) : null;
  }

  private ready(): { client: S3Client; signer: S3Client; bucket: string } {
    if (!this.client || !this.signer || !this.bucket) throw new ServiceUnavailableException('Kho tài liệu chưa được cấu hình (STORAGE_BUCKET)');
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
