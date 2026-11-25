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

  it('worker không xác thực token nên không bắt buộc OIDC_ISSUER, vẫn bắt buộc secret', () => {
    expect(() => loadConfig({ ...prod, OIDC_ISSUER: undefined }, { needsAuth: false })).not.toThrow();
    expect(() => loadConfig({ ...prod, DB_PASSWORD: undefined }, { needsAuth: false })).toThrow('thiếu DB_PASSWORD');
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

  it('MAIL_DRIVER mặc định smtp, nhận ses, giá trị lạ bị chặn (staging-readiness F1)', () => {
    expect(loadConfig({}).mail.driver).toBe('smtp');
    expect(loadConfig({ MAIL_DRIVER: 'ses', AWS_REGION: 'us-east-1' }).mail).toEqual({ driver: 'ses', sesRegion: 'us-east-1' });
    expect(() => loadConfig({ MAIL_DRIVER: 'sendgrid' })).toThrow('MAIL_DRIVER');
  });

  it('TRUST_PROXY mặc định 0, nhận số lớp proxy, chặn giá trị không hợp lệ (staging-readiness F5)', () => {
    expect(loadConfig({}).trustProxy).toBe(0);
    expect(loadConfig({ TRUST_PROXY: '1' }).trustProxy).toBe(1);
    expect(() => loadConfig({ TRUST_PROXY: 'true' })).toThrow('TRUST_PROXY');
    expect(() => loadConfig({ TRUST_PROXY: '-1' })).toThrow('TRUST_PROXY');
  });

  it('log JSON mặc định ở production, chữ khi dev; APP_VERSION mặc định dev (NFR-8.1, NFR-8.5)', () => {
    expect(loadConfig({}).logFormat).toBe('text');
    expect(loadConfig(prod).logFormat).toBe('json');
    expect(loadConfig({ LOG_FORMAT: 'json' }).logFormat).toBe('json');
    expect(() => loadConfig({ LOG_FORMAT: 'xml' })).toThrow('LOG_FORMAT');
    expect(loadConfig({}).appVersion).toBe('dev');
    expect(loadConfig({ APP_VERSION: 'abc123' }).appVersion).toBe('abc123');
  });

  it('pool và thời gian chờ database có mặc định, chặn giá trị sai (SRS 6.14)', () => {
    expect(loadConfig({}).db).toMatchObject({ poolMax: 10, connectTimeoutMs: 5000, statementTimeoutMs: 5000 });
    expect(loadConfig({ DB_STATEMENT_TIMEOUT_MS: '0' }).db.statementTimeoutMs).toBe(0);
    expect(() => loadConfig({ DB_POOL_MAX: '0' })).toThrow('DB_POOL_MAX');
    expect(() => loadConfig({ DB_CONNECT_TIMEOUT_MS: 'abc' })).toThrow('DB_CONNECT_TIMEOUT_MS');
  });
});
