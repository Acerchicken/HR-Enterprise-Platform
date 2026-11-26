/**
 * Cấu hình assistant service (UC6, ADR-15, ADR-16), đọc từ biến môi trường. Service không import gì từ `backend/`
 * (tiêu chí nghiệm thu ADR-16), nên phần đọc cấu hình viết riêng.
 */
export type QueueDriver = 'rabbitmq' | 'sqs';
export type DbSslMode = 'off' | 'require' | 'verify';

export interface AssistantConfig {
  port: number;
  db: { url: string; ssl: DbSslMode; sslCaFile: string | null };
  queue: { driver: QueueDriver; rabbitmqUrl: string | null; sqsQueueUrl: string | null; awsRegion: string };
  storage: {
    bucket: string;
    region: string;
    endpoint: string | null;
    accessKeyId: string | null;
    secretAccessKey: string | null;
  };
  /** `id` trong registry embedder (ADR-16 mục 4). */
  embeddingModel: string;
  /** Thư mục chứa model đã tải sẵn khi build image. */
  modelCacheDir: string;
  /** Token API dùng khi gọi `POST /internal/answers` (header `Authorization: Bearer`). */
  internalToken: string;
  /** Timeout gọi LLM (NFR-3.5, mặc định 10 s, không thử lại). */
  llmTimeoutMs: number;
  /** Khóa AES-256-GCM (base64, 32 byte) mã hóa API key nhà cung cấp trong `assistant.llm_config` (FR-6.4, ADR-16 mục 7). */
  configKey: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AssistantConfig {
  const problems: string[] = [];
  const need = (name: string) => {
    const v = env[name];
    if (!v) problems.push(`Thiếu ${name}`);
    return v ?? '';
  };
  const rabbitmqUrl = env.RABBITMQ_URL || null;
  const sqsQueueUrl = env.SQS_ASSISTANT_QUEUE_URL || null;
  const driver = (env.QUEUE_DRIVER || (sqsQueueUrl ? 'sqs' : 'rabbitmq')) as QueueDriver;
  if (driver === 'rabbitmq' && !rabbitmqUrl) problems.push('QUEUE_DRIVER=rabbitmq cần RABBITMQ_URL');
  if (driver === 'sqs' && !sqsQueueUrl) problems.push('QUEUE_DRIVER=sqs cần SQS_ASSISTANT_QUEUE_URL');
  if (!['rabbitmq', 'sqs'].includes(driver)) problems.push(`QUEUE_DRIVER không hợp lệ: ${driver}`);
  const ssl = (env.DB_SSL ?? 'off') as DbSslMode;
  if (!['off', 'require', 'verify'].includes(ssl)) problems.push('DB_SSL phải là off, require hoặc verify');
  if (ssl === 'verify' && !env.DB_SSL_CA_FILE) problems.push('DB_SSL=verify cần DB_SSL_CA_FILE');

  const cfg: AssistantConfig = {
    port: Number(env.PORT || 3100),
    db: { url: need('ASSISTANT_DB_URL'), ssl, sslCaFile: env.DB_SSL_CA_FILE || null },
    queue: { driver, rabbitmqUrl, sqsQueueUrl, awsRegion: env.AWS_REGION || 'ap-southeast-1' },
    storage: {
      bucket: need('STORAGE_BUCKET'),
      region: env.STORAGE_REGION || env.AWS_REGION || 'ap-southeast-1',
      endpoint: env.STORAGE_ENDPOINT || null,
      accessKeyId: env.STORAGE_ACCESS_KEY_ID || null,
      secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY || null,
    },
    embeddingModel: env.ASSISTANT_EMBEDDING_MODEL || 'embeddinggemma-300m',
    modelCacheDir: env.ASSISTANT_MODEL_DIR || `${process.cwd()}/.model-cache`,
    internalToken: need('ASSISTANT_INTERNAL_TOKEN'),
    llmTimeoutMs: Number(env.ASSISTANT_LLM_TIMEOUT_MS || 10_000),
    configKey: need('ASSISTANT_CONFIG_KEY'),
  };
  if (cfg.configKey && Buffer.from(cfg.configKey, 'base64').length !== 32) problems.push('ASSISTANT_CONFIG_KEY phải là 32 byte mã hóa base64 (openssl rand -base64 32)');
  if (cfg.internalToken && cfg.internalToken.length < 16) problems.push('ASSISTANT_INTERNAL_TOKEN phải dài ít nhất 16 ký tự');
  if (!Number.isInteger(cfg.llmTimeoutMs) || cfg.llmTimeoutMs < 1000 || cfg.llmTimeoutMs > 60_000) problems.push('ASSISTANT_LLM_TIMEOUT_MS phải từ 1000 đến 60000');
  if (problems.length) throw new Error(`Cấu hình assistant service sai: ${problems.join('; ')}`);
  return cfg;
}
