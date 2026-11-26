import { loadConfig } from './config';

describe('loadConfig', () => {
  const base = { NOTIFICATION_DB_URL: 'postgres://notification_svc:x@db:5432/hr', RABBITMQ_URL: 'amqp://mq' };

  it('mặc định: RabbitMQ, SMTP, chờ 10 s, thử 3 lần (NFR-3.5), gộp HR 60 phút (AC-1.9.13)', () => {
    const c = loadConfig(base);
    expect(c.queue.driver).toBe('rabbitmq');
    expect(c.mail).toMatchObject({ driver: 'smtp', timeoutMs: 10_000, attempts: 3, retryDelayMs: 1000 });
    expect(c.hrDigestMinutes).toBe(60);
    expect(c.port).toBe(3200);
  });

  it('có SQS_QUEUE_URL thì dùng SQS; MAIL_DRIVER=ses lấy vùng AWS_REGION khi không đặt SES_REGION', () => {
    const c = loadConfig({ NOTIFICATION_DB_URL: 'x', SQS_QUEUE_URL: 'https://sqs/q', MAIL_DRIVER: 'SES', AWS_REGION: 'us-east-1' });
    expect(c.queue.driver).toBe('sqs');
    expect(c.mail).toMatchObject({ driver: 'ses', sesRegion: 'us-east-1' });
  });

  it('báo mọi lỗi cùng lúc: thiếu database, thời gian chờ quá 10 s, driver lạ', () => {
    expect(() => loadConfig({ RABBITMQ_URL: 'amqp://mq', MAIL_TIMEOUT_MS: '30000', MAIL_DRIVER: 'pigeon' })).toThrow(
      /MAIL_TIMEOUT_MS.*MAIL_DRIVER.*NOTIFICATION_DB_URL|MAIL_DRIVER.*MAIL_TIMEOUT_MS.*NOTIFICATION_DB_URL/,
    );
  });

  it('QUEUE_DRIVER=sqs mà thiếu SQS_QUEUE_URL thì lỗi', () => {
    expect(() => loadConfig({ NOTIFICATION_DB_URL: 'x', QUEUE_DRIVER: 'sqs' })).toThrow(/SQS_QUEUE_URL/);
  });
});
