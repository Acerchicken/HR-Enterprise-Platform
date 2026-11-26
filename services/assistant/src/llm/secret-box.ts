import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Mã hóa khóa API nhà cung cấp LLM (FR-6.4, ADR-16 mục 7, ADR-08): AES-256-GCM, khóa 32 byte từ `ASSISTANT_CONFIG_KEY` (base64).
 * Định dạng lưu: `v1:<base64(iv 12 byte | tag 16 byte | bản mã)>`. Tiền tố phiên bản để sau này đổi thuật toán hoặc xoay khóa.
 * AAD gắn với `provider` để không đem bản mã của nhà cung cấp này dùng cho nhà cung cấp khác.
 */
const PREFIX = 'v1:';

export class SecretBox {
  private readonly key: Buffer;

  constructor(base64Key: string) {
    const key = Buffer.from(base64Key, 'base64');
    if (key.length !== 32) throw new Error('ASSISTANT_CONFIG_KEY phải là 32 byte mã hóa base64 (openssl rand -base64 32)');
    this.key = key;
  }

  seal(plain: string, aad: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(aad, 'utf8'));
    const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
  }

  /** Ném lỗi nếu sai khóa, sai AAD hoặc bản mã bị sửa. */
  open(sealed: string, aad: string): string {
    if (!sealed.startsWith(PREFIX)) throw new Error('Bản mã không đúng định dạng');
    const raw = Buffer.from(sealed.slice(PREFIX.length), 'base64');
    if (raw.length < 29) throw new Error('Bản mã không đúng định dạng');
    const decipher = createDecipheriv('aes-256-gcm', this.key, raw.subarray(0, 12));
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
  }
}

/** 4 ký tự cuối để hiển thị (AC-6.4.4). Khóa ngắn hơn 8 ký tự thì không lộ gì. */
export const last4 = (apiKey: string) => (apiKey.length >= 8 ? apiKey.slice(-4) : '');
