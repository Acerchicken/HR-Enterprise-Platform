/**
 * Notification service (ADR-15 bước 1):  npm run start:dev (dev) · node dist/main.js (Docker)
 * Nghe queue `notification.leave` (RabbitMQ local, SQS trên AWS), gửi email theo danh sách người nhận có sẵn trong event
 * (SMTP/Mailpit local, SES trên AWS), chống trùng trên schema `notification`. HTTP chỉ có `GET /health`.
 */
import { loadConfig } from './config';
import { createPool } from './db';
import { NotificationHandler } from './handler';
import { createHealthServer } from './health';
import { errorText, log } from './log';
import { createMailSender } from './mail/sender';
import { createConsumer } from './messaging/consumer';

async function main() {
  const cfg = loadConfig();
  const pool = createPool(cfg.db);
  const handler = new NotificationHandler(pool, createMailSender(cfg.mail), cfg.hrDigestMinutes);
  const consumer = createConsumer(cfg.queue);
  await consumer.start((e) => handler.handle(e).then(() => undefined));

  const server = createHealthServer(async () => {
    await pool.query('SELECT 1');
  });
  server.listen(cfg.port, () => log.info('Đang nghe healthcheck', { port: cfg.port, mailDriver: cfg.mail.driver, queue: cfg.queue.driver }));

  const stop = async () => {
    log.info('Đang dừng');
    server.close();
    await consumer.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

main().catch((e) => {
  log.error('Không khởi động được', { error: errorText(e) });
  process.exit(1);
});
