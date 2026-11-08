/**
 * Notification worker:  npm run start:worker (dev) · node dist/worker/main.js (Docker)
 */
import { NestFactory } from '@nestjs/core';
import { NotificationWorker } from './notification-worker';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  await app.get(NotificationWorker).start();
}
bootstrap().catch((e) => {
  console.error(e);
  process.exit(1);
});
