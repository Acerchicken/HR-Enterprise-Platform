/**
 * Toàn bộ cấu hình đọc từ biến môi trường (12-factor).
 * Xem .env.example ở thư mục backend để biết giá trị mặc định khi chạy local.
 */
export type AuthMode = 'oidc' | 'dev';
export type QueueDriver = 'rabbitmq' | 'sqs' | 'none';
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
    /** Các client được phép gọi API, ví dụ hr-web (SPA) và hr-api-test (curl/Postman). */
    allowedClients: string[];
    /** Claim chứa client id: `azp` (Keycloak) hoặc `client_id` (access token Cognito). */
    clientClaim: string;
    /** Endpoint userinfo của IdP; dùng khi access token không có email (Cognito). */
    userinfoUrl: string | null;
  };
  /** Khóa AES-256 (32 byte, base64) để mã hóa trường nhạy cảm ở tầng ứng dụng. */
  fieldEncryptionKey: string;
  /**
   * Queue cho outbox publisher và worker. QUEUE_DRIVER=rabbitmq (local) hoặc sqs (AWS); không đặt thì suy ra:
   * có RABBITMQ_URL → rabbitmq, có SQS_QUEUE_URL → sqs, không có gì → none (API không đẩy event, vd khi chạy test).
   */
  queue: {
    driver: QueueDriver;
    rabbitmqUrl: string | null;
    sqsQueueUrl: string | null;
    /** Queue SQS của assistant service (UC6); không đặt thì event tài liệu không được gửi đi. */
    sqsAssistantQueueUrl: string | null;
    awsRegion: string | null;
  };
  smtp: {
    host: string;
    port: number;
    from: string;
  };
  /**
   * Object storage cho kho tài liệu (S3 trên AWS, MinIO khi chạy local). `bucket` rỗng thì API tài liệu trả 503.
   * `publicEndpoint`: địa chỉ trình duyệt dùng để upload bằng presigned URL (khác `endpoint` khi API chạy trong Docker).
   */
  storage: {
    bucket: string | null;
    region: string;
    endpoint: string | null;
    publicEndpoint: string | null;
    accessKeyId: string | null;
    secretAccessKey: string | null;
  };
  /**
   * Bucket riêng cho file hồ sơ (UC1 FR-1.10): chặn public, SSE-KMS, lifecycle xóa object gắn tag `deleted=true` sau 30
   * ngày. Dùng chung endpoint và khóa của `storage`. Để trống thì thao tác file hồ sơ trả 503 (AC-1.10.9).
   */
  profileStorage: { bucket: string | null };
  /**
   * Giới hạn tần suất (NFR-5.21, UC1 FR-1.14). `overrides`: đổi ngưỡng của từng nhóm, ví dụ
   * RATE_LIMIT_OVERRIDES='{"global":{"minute":1000}}' khi chạy e2e hoặc load test. `enabled=false` tắt hẳn (chỉ dùng local).
   */
  rateLimit: {
    enabled: boolean;
    overrides: Record<string, Partial<Record<'minute' | 'hour' | 'day', number>>>;
  };
  /**
   * Tạo, khóa tài khoản và đồng bộ nhóm trên IdP (UC8 FR-8.3, 8.4, 8.7; ADR-17 mục 4). Worker dùng.
   * IDP_ADMIN_DRIVER=keycloak (local) | cognito (staging) | none (mặc định: chỉ ghi log, dùng cho AUTH_MODE=dev và test).
   */
  idpAdmin: {
    driver: IdpAdminDriver;
    /** Keycloak: gốc server (bỏ phần /realms/...), realm, client `hr-api-admin` (client credentials, role manage-users). */
    keycloak: { baseUrl: string; realm: string; clientId: string; clientSecret: string | null };
    cognito: { userPoolId: string | null; region: string };
    /** Số lần thử khi IdP lỗi tạm thời và thời gian chờ ban đầu (nhân đôi mỗi lần). */
    attempts: number;
    retryDelayMs: number;
  };
}

export type IdpAdminDriver = 'keycloak' | 'cognito' | 'none';

export interface LoadOptions {
  /** false cho process worker: worker không xác thực token nên không bắt buộc OIDC_ISSUER. */
  needsAuth?: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env, opts: LoadOptions = {}): AppConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const mode = (env.AUTH_MODE ?? 'oidc') as AuthMode;
  if (mode === 'dev' && nodeEnv === 'production') {
    throw new Error('AUTH_MODE=dev không được phép khi NODE_ENV=production');
  }
  const queue = loadQueue(env);
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
      clientClaim: env.OIDC_CLIENT_CLAIM ?? 'azp',
      userinfoUrl: env.OIDC_USERINFO_URL || null,
    },
    fieldEncryptionKey: env.FIELD_ENCRYPTION_KEY ?? DEV_FIELD_ENCRYPTION_KEY,
    queue,
    smtp: {
      host: env.SMTP_HOST ?? 'localhost',
      port: Number(env.SMTP_PORT ?? 1025),
      from: env.SMTP_FROM ?? 'no-reply@hr.local',
    },
    storage: {
      bucket: env.STORAGE_BUCKET || null,
      region: env.STORAGE_REGION || env.AWS_REGION || 'ap-southeast-1',
      endpoint: env.STORAGE_ENDPOINT || null,
      publicEndpoint: env.STORAGE_PUBLIC_ENDPOINT || env.STORAGE_ENDPOINT || null,
      accessKeyId: env.STORAGE_ACCESS_KEY_ID || null,
      secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY || null,
    },
    profileStorage: { bucket: env.PROFILE_STORAGE_BUCKET || null },
    rateLimit: {
      enabled: env.RATE_LIMIT_ENABLED !== 'false',
      overrides: parseOverrides(env.RATE_LIMIT_OVERRIDES),
    },
    idpAdmin: {
      driver: (env.IDP_ADMIN_DRIVER ?? 'none') as IdpAdminDriver,
      keycloak: {
        baseUrl: env.KEYCLOAK_ADMIN_URL ?? issuer.replace(/\/realms\/[^/]+\/?$/, ''),
        realm: env.KEYCLOAK_REALM ?? (/\/realms\/([^/]+)/.exec(issuer)?.[1] ?? 'hr'),
        clientId: env.KEYCLOAK_ADMIN_CLIENT_ID ?? 'hr-api-admin',
        clientSecret: env.KEYCLOAK_ADMIN_CLIENT_SECRET || null,
      },
      cognito: {
        userPoolId: env.COGNITO_USER_POOL_ID || null,
        region: env.AWS_REGION || 'ap-southeast-1',
      },
      attempts: Number(env.IDP_SYNC_ATTEMPTS ?? 5),
      retryDelayMs: Number(env.IDP_SYNC_RETRY_DELAY_MS ?? 1000),
    },
  };
  assertValid(cfg, env, opts.needsAuth ?? true);
  return cfg;
}

/**
 * Kiểm tra cấu hình khi khởi động để lỗi hiện ngay, không đợi tới request đầu tiên.
 * Production (NODE_ENV=production) bắt buộc có secret thật; chỉ docker-compose local được bỏ qua bằng ALLOW_DEV_SECRETS=true.
 * Thông báo lỗi chỉ nêu tên biến, không in giá trị.
 */
function assertValid(cfg: AppConfig, env: NodeJS.ProcessEnv, needsAuth: boolean) {
  const problems: string[] = [];
  if (Buffer.from(cfg.fieldEncryptionKey, 'base64').length !== 32) {
    problems.push('FIELD_ENCRYPTION_KEY phải là 32 byte mã hóa base64');
  }
  if (!['off', 'require', 'verify'].includes(cfg.db.ssl)) problems.push('DB_SSL phải là off, require hoặc verify');
  if (cfg.db.ssl === 'verify' && !cfg.db.sslCaFile) problems.push('DB_SSL=verify cần DB_SSL_CA_FILE');
  const idp = cfg.idpAdmin;
  if (!['keycloak', 'cognito', 'none'].includes(idp.driver)) problems.push('IDP_ADMIN_DRIVER chỉ nhận keycloak, cognito, none');
  if (idp.driver === 'keycloak' && !idp.keycloak.clientSecret) problems.push('IDP_ADMIN_DRIVER=keycloak cần KEYCLOAK_ADMIN_CLIENT_SECRET');
  if (idp.driver === 'cognito' && !idp.cognito.userPoolId) problems.push('IDP_ADMIN_DRIVER=cognito cần COGNITO_USER_POOL_ID');

  if (cfg.nodeEnv === 'production' && env.ALLOW_DEV_SECRETS !== 'true') {
    if (!env.FIELD_ENCRYPTION_KEY) problems.push('thiếu FIELD_ENCRYPTION_KEY');
    else if (env.FIELD_ENCRYPTION_KEY === DEV_FIELD_ENCRYPTION_KEY) problems.push('FIELD_ENCRYPTION_KEY đang là khóa dev');
    if (!env.DB_PASSWORD) problems.push('thiếu DB_PASSWORD');
    if (needsAuth && cfg.auth.mode === 'oidc' && !env.OIDC_ISSUER) problems.push('thiếu OIDC_ISSUER');
  }
  if (problems.length) throw new Error(`Cấu hình không hợp lệ: ${problems.join('; ')}`);
}

function loadQueue(env: NodeJS.ProcessEnv): AppConfig['queue'] {
  const rabbitmqUrl = env.RABBITMQ_URL || null;
  const sqsQueueUrl = env.SQS_QUEUE_URL || null;
  const awsRegion = env.AWS_REGION || null;
  const driver = (env.QUEUE_DRIVER || (rabbitmqUrl ? 'rabbitmq' : sqsQueueUrl ? 'sqs' : 'none')) as QueueDriver;
  if (!['rabbitmq', 'sqs', 'none'].includes(driver)) {
    throw new Error(`QUEUE_DRIVER không hợp lệ: ${driver} (chỉ nhận rabbitmq, sqs, none)`);
  }
  if (driver === 'rabbitmq' && !rabbitmqUrl) throw new Error('QUEUE_DRIVER=rabbitmq cần RABBITMQ_URL');
  if (driver === 'sqs' && (!sqsQueueUrl || !awsRegion)) {
    throw new Error('QUEUE_DRIVER=sqs cần SQS_QUEUE_URL và AWS_REGION');
  }
  return { driver, rabbitmqUrl, sqsQueueUrl, sqsAssistantQueueUrl: env.SQS_ASSISTANT_QUEUE_URL || null, awsRegion };
}

export const APP_CONFIG = Symbol('APP_CONFIG');

function parseOverrides(raw: string | undefined): AppConfig['rateLimit']['overrides'] {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === 'object') return v;
  } catch {
    // Rơi xuống lỗi bên dưới.
  }
  throw new Error('RATE_LIMIT_OVERRIDES phải là JSON, ví dụ {"global":{"minute":1000}}');
}
