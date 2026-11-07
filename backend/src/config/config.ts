/**
 * Toàn bộ cấu hình đọc từ biến môi trường (12-factor).
 * Xem .env.example ở thư mục backend để biết giá trị mặc định khi chạy local.
 */
export type AuthMode = 'oidc' | 'dev';
export type QueueDriver = 'rabbitmq' | 'sqs' | 'none';

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
  /**
   * Queue cho outbox publisher và worker. QUEUE_DRIVER=rabbitmq (local) hoặc sqs (AWS); không đặt thì suy ra:
   * có RABBITMQ_URL → rabbitmq, có SQS_QUEUE_URL → sqs, không có gì → none (API không đẩy event, vd khi chạy test).
   */
  queue: {
    driver: QueueDriver;
    rabbitmqUrl: string | null;
    sqsQueueUrl: string | null;
    awsRegion: string | null;
  };
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
  const queue = loadQueue(env);
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
    queue,
    smtp: {
      host: env.SMTP_HOST ?? 'localhost',
      port: Number(env.SMTP_PORT ?? 1025),
      from: env.SMTP_FROM ?? 'no-reply@hr.local',
    },
  };
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
  return { driver, rabbitmqUrl, sqsQueueUrl, awsRegion };
}

export const APP_CONFIG = Symbol('APP_CONFIG');
