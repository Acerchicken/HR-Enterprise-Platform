/**
 * Worker (email thông báo, job áp dụng điều chuyển, job nghỉ phép):  npm run start:worker (dev) · node dist/worker/main.js (Docker)
 */
import { NestFactory } from '@nestjs/core';
import { JsonLogger, setMetricSink } from '../common/json-logger';
import { loadConfig } from '../config/config';
import { NotificationWorker } from './notification-worker';
import { LeaveJob } from './leave-job';
import { TransferJob } from './transfer-job';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const cfg = loadConfig(process.env, { needsAuth: false });
  const json = cfg.logFormat === 'json' ? new JsonLogger('worker', cfg.appVersion) : null;
  if (json) setMetricSink(json);
  const app = await NestFactory.createApplicationContext(WorkerModule, json ? { logger: json } : {});
  app.enableShutdownHooks();
  app.get(TransferJob).start();
  app.get(LeaveJob).start();
  await app.get(NotificationWorker).start();
}
bootstrap().catch((e) => {
  console.error(e);
  process.exit(1);
});
