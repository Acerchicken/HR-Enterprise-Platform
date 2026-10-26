import { randomBytes } from 'crypto';
import { FieldCrypto } from './field-crypto';

describe('FieldCrypto', () => {
  const crypto = new FieldCrypto(randomBytes(32).toString('base64'));

  it('mã hóa rồi giải mã ra đúng giá trị', () => {
    const enc = crypto.encrypt('079201001234');
    expect(enc).not.toContain('079201001234');
    expect(crypto.decrypt(enc)).toBe('079201001234');
  });

  it('cùng giá trị cho ra ciphertext khác nhau (IV ngẫu nhiên)', () => {
    expect(crypto.encrypt('x')).not.toBe(crypto.encrypt('x'));
  });

  it('từ chối dữ liệu bị sửa', () => {
    const enc = Buffer.from(crypto.encrypt('secret')!, 'base64');
    enc[enc.length - 1] ^= 1;
    expect(() => crypto.decrypt(enc.toString('base64'))).toThrow();
  });

  it('từ chối khóa sai độ dài', () => {
    expect(() => new FieldCrypto(Buffer.from('short').toString('base64'))).toThrow();
  });
});
