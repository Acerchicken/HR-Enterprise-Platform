/**
 * Toàn bộ cấu hình đọc từ biến môi trường (12-factor).
 * Xem .env.example ở thư mục backend để biết giá trị mặc định khi chạy local.
 */
export type AuthMode = 'oidc' | 'dev';

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
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const mode = (env.AUTH_MODE ?? 'oidc') as AuthMode;
  if (mode === 'dev' && nodeEnv === 'production') {
    throw new Error('AUTH_MODE=dev không được phép khi NODE_ENV=production');
  }
  const issuer = env.OIDC_ISSUER ?? 'http://localhost:8080/realms/hr';
  return {
    nodeEnv,
    port: Number(env.PORT ?? 3000),
    corsOrigin: env.CORS_ORIGIN ?? 'http://localhost:5173',
    db: {
      host: env.DB_HOST ?? 'localhost',
      port: Number(env.DB_PORT ?? 5432),
      user: env.DB_USER ?? 'hr',
      password: env.DB_PASSWORD ?? 'hr',
      database: env.DB_NAME ?? 'hr',
    },
    auth: {
      mode,
      issuer,
      jwksUri: env.OIDC_JWKS_URI ?? `${issuer}/protocol/openid-connect/certs`,
      allowedClients: (env.OIDC_ALLOWED_CLIENTS ?? 'hr-web').split(',').map((c) => c.trim()),
    },
    fieldEncryptionKey:
      env.FIELD_ENCRYPTION_KEY ?? 'ZGV2LW9ubHkta2V5LWRvLW5vdC11c2UtaW4tcHJvZCE=',
  };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
