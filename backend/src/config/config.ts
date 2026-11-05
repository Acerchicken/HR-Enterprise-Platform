/**
 * Toàn bộ cấu hình đọc từ biến môi trường (12-factor).
 * Xem .env.example ở thư mục backend để biết giá trị mặc định khi chạy local.
 */
export type AuthMode = 'oidc' | 'dev';
/** off: không TLS (local) · require: mã hóa, không kiểm tra chứng chỉ · verify: mã hóa và kiểm tra theo CA trong DB_SSL_CA_FILE. */
export type DbSslMode = 'off' | 'require' | 'verify';

/** Khóa chỉ dùng cho dev/test; production dùng khóa này là lỗi (xem assertProductionSecrets). */
export const DEV_FIELD_ENCRYPTION_KEY = 'ZGV2LW9ubHkta2V5LWRvLW5vdC11c2UtaW4tcHJvZCE=';

export interface AppConfig {
  nodeEnv: string;
  port: number;
  corsOrigin: string;
  db: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    ssl: DbSslMode;
    sslCaFile: string | null;
  };
  auth: {
    mode: AuthMode;
    issuer: string;
    jwksUri: string;
    /** Các client (claim azp) được phép gọi API, ví dụ hr-web (SPA) và hr-api-test (curl/Postman). */
    allowedClients: string[];
  };
  /** Khóa AES-256 (32 byte, base64) để mã hóa trường nhạy cảm ở tầng ứng dụng. */
  fieldEncryptionKey: string;
  /** RabbitMQ cho outbox publisher và worker. Để trống thì API không đẩy event (vd khi chạy test). */
  rabbitmqUrl: string | null;
  smtp: {
    host: string;
    port: number;
    from: string;
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const mode = (env.AUTH_MODE ?? 'oidc') as AuthMode;
  if (mode === 'dev' && nodeEnv === 'production') {
    throw new Error('AUTH_MODE=dev không được phép khi NODE_ENV=production');
  }
  const issuer = env.OIDC_ISSUER ?? 'http://localhost:8080/realms/hr';
  const cfg: AppConfig = {
    nodeEnv,
    port: Number(env.PORT ?? 3000),
    corsOrigin: env.CORS_ORIGIN ?? 'http://localhost:5173',
    db: {
      host: env.DB_HOST ?? 'localhost',
      port: Number(env.DB_PORT ?? 5432),
      user: env.DB_USER ?? 'hr',
      password: env.DB_PASSWORD ?? 'hr',
      database: env.DB_NAME ?? 'hr',
      ssl: (env.DB_SSL ?? 'off') as DbSslMode,
      sslCaFile: env.DB_SSL_CA_FILE || null,
    },
    auth: {
      mode,
      issuer,
      jwksUri: env.OIDC_JWKS_URI ?? `${issuer}/protocol/openid-connect/certs`,
      allowedClients: (env.OIDC_ALLOWED_CLIENTS ?? 'hr-web').split(',').map((c) => c.trim()),
    },
    fieldEncryptionKey: env.FIELD_ENCRYPTION_KEY ?? DEV_FIELD_ENCRYPTION_KEY,
    rabbitmqUrl: env.RABBITMQ_URL || null,
    smtp: {
      host: env.SMTP_HOST ?? 'localhost',
      port: Number(env.SMTP_PORT ?? 1025),
      from: env.SMTP_FROM ?? 'no-reply@hr.local',
    },
  };
  assertValid(cfg, env);
  return cfg;
}

/**
 * Kiểm tra cấu hình khi khởi động để lỗi hiện ngay, không đợi tới request đầu tiên.
 * Production (NODE_ENV=production) bắt buộc có secret thật; chỉ docker-compose local được bỏ qua bằng ALLOW_DEV_SECRETS=true.
 * Thông báo lỗi chỉ nêu tên biến, không in giá trị.
 */
function assertValid(cfg: AppConfig, env: NodeJS.ProcessEnv) {
  const problems: string[] = [];
  if (Buffer.from(cfg.fieldEncryptionKey, 'base64').length !== 32) {
    problems.push('FIELD_ENCRYPTION_KEY phải là 32 byte mã hóa base64');
  }
  if (!['off', 'require', 'verify'].includes(cfg.db.ssl)) problems.push('DB_SSL phải là off, require hoặc verify');
  if (cfg.db.ssl === 'verify' && !cfg.db.sslCaFile) problems.push('DB_SSL=verify cần DB_SSL_CA_FILE');

  if (cfg.nodeEnv === 'production' && env.ALLOW_DEV_SECRETS !== 'true') {
    if (!env.FIELD_ENCRYPTION_KEY) problems.push('thiếu FIELD_ENCRYPTION_KEY');
    else if (env.FIELD_ENCRYPTION_KEY === DEV_FIELD_ENCRYPTION_KEY) problems.push('FIELD_ENCRYPTION_KEY đang là khóa dev');
    if (!env.DB_PASSWORD) problems.push('thiếu DB_PASSWORD');
    if (cfg.auth.mode === 'oidc' && !env.OIDC_ISSUER) problems.push('thiếu OIDC_ISSUER');
  }
  if (problems.length) throw new Error(`Cấu hình không hợp lệ: ${problems.join('; ')}`);
}

export const APP_CONFIG = Symbol('APP_CONFIG');
