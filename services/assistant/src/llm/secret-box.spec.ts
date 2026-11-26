import { randomBytes } from 'crypto';
import { last4, SecretBox } from './secret-box';

describe('SecretBox (AES-256-GCM, FR-6.4)', () => {
  const key = randomBytes(32).toString('base64');

  it('mã hóa rồi giải mã đúng; mỗi lần mã hóa ra bản khác (iv ngẫu nhiên); bản mã không chứa khóa', () => {
    const box = new SecretBox(key);
    const a = box.seal('sk-ant-api03-SECRET', 'anthropic');
    const b = box.seal('sk-ant-api03-SECRET', 'anthropic');
    expect(a).toMatch(/^v1:/);
    expect(a).not.toBe(b);
    expect(a).not.toContain('SECRET');
    expect(box.open(a, 'anthropic')).toBe('sk-ant-api03-SECRET');
  });

  it('sai khóa, sai nhà cung cấp (AAD) hoặc bản mã bị sửa thì lỗi', () => {
    const box = new SecretBox(key);
    const sealed = box.seal('sk-123456789', 'deepseek');
    expect(() => new SecretBox(randomBytes(32).toString('base64')).open(sealed, 'deepseek')).toThrow();
    expect(() => box.open(sealed, 'google')).toThrow();
    const raw = Buffer.from(sealed.slice(3), 'base64');
    raw[raw.length - 1] ^= 1;
    expect(() => box.open(`v1:${raw.toString('base64')}`, 'deepseek')).toThrow();
    expect(() => box.open('plain', 'deepseek')).toThrow(/định dạng/);
  });

  it('khóa cấu hình phải đúng 32 byte', () => {
    expect(() => new SecretBox(randomBytes(16).toString('base64'))).toThrow(/32 byte/);
  });

  it('last4 chỉ lộ 4 ký tự cuối, khóa quá ngắn thì không lộ gì', () => {
    expect(last4('sk-abcdefgh1234')).toBe('1234');
    expect(last4('short')).toBe('');
  });
});
