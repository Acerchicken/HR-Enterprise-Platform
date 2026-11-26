/**
 * Cấu hình notification service (ADR-15 bước 1), đọc từ biến môi trường. Service không import gì từ `backend/` (tiêu chí
 * nghiệm thu ADR-15, kiểm trong CI), nên phần đọc cấu hình viết riêng.
 */
export type QueueDriver = 'rabbitmq' | 'sqs';
export type DbSslMode = 'off' | 'require' | 'verify';
export type MailDriver = 'smtp' | 'ses';

export interface NotificationConfig {
  /** Cổng HTTP chỉ có `GET /health` (healthcheck của docker compose, ECS). */
  port: number;
  db: { url: string; ssl: DbSslMode; sslCaFile: string | null };
  queue: { driver: QueueDriver; rabbitmqUrl: string | null; sqsQueueUrl: string | null; awsRegion: string };
  mail: {
    driver: MailDriver;
    from: string;
    smtpHost: string;
    smtpPort: number;
    sesRegion: string;
    /** Thời gian chờ mỗi lần gửi (NFR-3.5: ≤ 10 s). */
    timeoutMs: number;
    /** Số lần gửi tối đa trong một lượt nhận event và thời gian chờ trước lần thử lại đầu tiên (nhân đôi mỗi lần, NFR-3.5). */
    attempts: number;
    retryDelayMs: number;
  };
  /** HR nhận tối đa một email báo có yêu cầu cập nhật hồ sơ mới trong khoảng này (AC-1.9.13). */
  hrDigestMinutes: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): NotificationConfig {
  const problems: string[] = [];
  const int = (name: string, def: number, min: number, max: number) => {
    const raw = env[name];
    const n = raw === undefined || raw === '' ? def : Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) problems.push(`${name} phải là số nguyên ${min}–${max}`);
    return n;
  };
  const rabbitmqUrl = env.RABBITMQ_URL || null;
  const sqsQueueUrl = env.SQS_QUEUE_URL || null;
  const driver = (env.QUEUE_DRIVER || (sqsQueueUrl ? 'sqs' : 'rabbitmq')) as QueueDriver;
  if (!['rabbitmq', 'sqs'].includes(driver)) problems.push(`QUEUE_DRIVER không hợp lệ: ${driver}`);
  if (driver === 'rabbitmq' && !rabbitmqUrl) problems.push('QUEUE_DRIVER=rabbitmq cần RABBITMQ_URL');
  if (driver === 'sqs' && !sqsQueueUrl) problems.push('QUEUE_DRIVER=sqs cần SQS_QUEUE_URL');
  const ssl = (env.DB_SSL ?? 'off') as DbSslMode;
  if (!['off', 'require', 'verify'].includes(ssl)) problems.push('DB_SSL phải là off, require hoặc verify');
  if (ssl === 'verify' && !env.DB_SSL_CA_FILE) problems.push('DB_SSL=verify cần DB_SSL_CA_FILE');
  const mailDriver = (env.MAIL_DRIVER || 'smtp').toLowerCase() as MailDriver;
  if (!['smtp', 'ses'].includes(mailDriver)) problems.push(`MAIL_DRIVER không hợp lệ: ${env.MAIL_DRIVER} (smtp | ses)`);
  const awsRegion = env.AWS_REGION || 'ap-southeast-1';

  const cfg: NotificationConfig = {
    port: int('PORT', 3200, 1, 65535),
    db: { url: env.NOTIFICATION_DB_URL ?? '', ssl, sslCaFile: env.DB_SSL_CA_FILE || null },
    queue: { driver, rabbitmqUrl, sqsQueueUrl, awsRegion },
    mail: {
      driver: mailDriver,
      from: env.SMTP_FROM || 'no-reply@hr.local',
      smtpHost: env.SMTP_HOST || 'localhost',
      smtpPort: int('SMTP_PORT', 1025, 1, 65535),
      sesRegion: env.SES_REGION || awsRegion,
      timeoutMs: int('MAIL_TIMEOUT_MS', 10_000, 1000, 10_000),
      attempts: int('MAIL_ATTEMPTS', 3, 1, 5),
      retryDelayMs: int('MAIL_RETRY_DELAY_MS', 1000, 0, 60_000),
    },
    hrDigestMinutes: int('HR_DIGEST_MINUTES', 60, 1, 1440),
  };
  if (!cfg.db.url) problems.push('Thiếu NOTIFICATION_DB_URL');
  if (problems.length) throw new Error(`Cấu hình notification service sai: ${problems.join('; ')}`);
  return cfg;
}
