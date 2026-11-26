import { ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'crypto';
import { Readable } from 'stream';

/**
 * Bucket giả trong bộ nhớ cho e2e (file hồ sơ UC1, kho tài liệu UC5) khi máy không có S3Mock. Cùng các hàm `S3Bucket` mà service dùng; URL tải lên có
 * dạng `memory://<key>`, test ghi nội dung bằng `upload(url, body)` thay cho trình duyệt PUT.
 */
export class FakeBucket {
  enabled = true;
  readonly objects = new Map<string, Buffer>();
  readonly tags = new Map<string, Record<string, string>>();

  constructor(private readonly notConfigured = 'Kho file hồ sơ chưa được cấu hình (PROFILE_STORAGE_BUCKET)') {}

  get configured() {
    return this.enabled;
  }

  private ready() {
    if (!this.enabled) throw new ServiceUnavailableException(this.notConfigured);
  }

  async uploadUrl(key: string, contentType: string, size: number) {
    this.ready();
    return { url: `memory://${key}`, method: 'PUT' as const, headers: { 'Content-Type': contentType }, expiresInSeconds: 600, size };
  }

  upload(url: string, body: Buffer) {
    this.objects.set(url.replace('memory://', ''), body);
  }

  async head(key: string) {
    this.ready();
    const b = this.objects.get(key);
    return b ? { size: b.length } : null;
  }

  async readHead(key: string, bytes = 4096) {
    return new Uint8Array((this.objects.get(key) ?? Buffer.alloc(0)).subarray(0, bytes));
  }

  async read(key: string) {
    return this.objects.get(key) ?? Buffer.alloc(0);
  }

  async sha256(key: string) {
    return createHash('sha256').update(this.objects.get(key) ?? Buffer.alloc(0)).digest('hex');
  }

  async put(key: string, body: Buffer) {
    this.objects.set(key, body);
  }

  async tag(key: string, tags: Record<string, string>) {
    this.tags.set(key, tags);
  }

  async stream(key: string) {
    this.ready();
    return Readable.from([this.objects.get(key) ?? Buffer.alloc(0)]);
  }

  async remove(key: string) {
    this.objects.delete(key);
  }
}

export const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');
