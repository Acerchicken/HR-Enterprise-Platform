import { DEV_FIELD_ENCRYPTION_KEY, loadConfig } from './config';

const REAL_KEY = Buffer.alloc(32, 7).toString('base64');
const prod = {
  NODE_ENV: 'production',
  FIELD_ENCRYPTION_KEY: REAL_KEY,
  DB_PASSWORD: 'secret',
  OIDC_ISSUER: 'https://cognito-idp.ap-southeast-1.amazonaws.com/pool',
};

describe('loadConfig', () => {
  it('dev không cần secret, dùng khóa dev', () => {
    expect(loadConfig({}).fieldEncryptionKey).toBe(DEV_FIELD_ENCRYPTION_KEY);
  });

  it('production đủ secret thì khởi động được', () => {
    expect(loadConfig(prod).db.password).toBe('secret');
  });

  it('production thiếu secret hoặc dùng khóa dev thì báo lỗi, chỉ nêu tên biến', () => {
    expect(() => loadConfig({ ...prod, FIELD_ENCRYPTION_KEY: undefined })).toThrow('thiếu FIELD_ENCRYPTION_KEY');
    expect(() => loadConfig({ ...prod, FIELD_ENCRYPTION_KEY: DEV_FIELD_ENCRYPTION_KEY })).toThrow('khóa dev');
    expect(() => loadConfig({ ...prod, DB_PASSWORD: undefined })).toThrow('thiếu DB_PASSWORD');
    expect(() => loadConfig({ ...prod, OIDC_ISSUER: undefined })).toThrow('thiếu OIDC_ISSUER');
    expect(() => loadConfig({ ...prod, DB_PASSWORD: undefined })).not.toThrow(/secret/);
  });

  it('docker-compose local được dùng khóa dev khi đặt ALLOW_DEV_SECRETS=true', () => {
    expect(() => loadConfig({ NODE_ENV: 'production', ALLOW_DEV_SECRETS: 'true' })).not.toThrow();
  });

  it('khóa mã hóa sai độ dài bị chặn ở mọi môi trường', () => {
    expect(() => loadConfig({ FIELD_ENCRYPTION_KEY: Buffer.alloc(16).toString('base64') })).toThrow('32 byte');
  });

  it('DB_SSL hợp lệ; verify cần file CA', () => {
    expect(loadConfig({ DB_SSL: 'require' }).db.ssl).toBe('require');
    expect(() => loadConfig({ DB_SSL: 'yes' })).toThrow('DB_SSL');
    expect(() => loadConfig({ DB_SSL: 'verify' })).toThrow('DB_SSL_CA_FILE');
  });

  it('AUTH_MODE=dev bị chặn ở production', () => {
    expect(() => loadConfig({ ...prod, AUTH_MODE: 'dev' })).toThrow('AUTH_MODE=dev');
  });
});
