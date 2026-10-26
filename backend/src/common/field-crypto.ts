import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Mã hóa trường nhạy cảm (CCCD, tài khoản ngân hàng, lương) bằng AES-256-GCM ở tầng ứng dụng.
 * Định dạng lưu: base64(iv[12] | authTag[16] | ciphertext).
 * Tuần 9 (P3) sẽ chuyển khóa sang secret manager / KMS của cloud provider.
 */
export class FieldCrypto {
  private readonly key: Buffer;

  constructor(base64Key: string) {
    this.key = Buffer.from(base64Key, 'base64');
    if (this.key.length !== 32) {
      throw new Error('FIELD_ENCRYPTION_KEY phải là 32 byte mã hóa base64');
    }
  }

  encrypt(plain: string | null | undefined): string | null {
    if (plain === null || plain === undefined) return null;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64');
  }

  decrypt(stored: string | null | undefined): string | null {
    if (!stored) return null;
    const buf = Buffer.from(stored, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.key, buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
  }
}
