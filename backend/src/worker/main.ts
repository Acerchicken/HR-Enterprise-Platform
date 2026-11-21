/**
 * Worker (email thông báo, job áp dụng điều chuyển, job nghỉ phép):  npm run start:worker (dev) · node dist/worker/main.js (Docker)
 */
import { NestFactory } from '@nestjs/core';
import { NotificationWorker } from './notification-worker';
import { LeaveJob } from './leave-job';
import { TransferJob } from './transfer-job';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  app.get(TransferJob).start();
  app.get(LeaveJob).start();
  await app.get(NotificationWorker).start();
}
bootstrap().catch((e) => {
  console.error(e);
  process.exit(1);
});
