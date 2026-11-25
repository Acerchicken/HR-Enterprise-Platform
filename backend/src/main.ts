import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { accessLog, JsonLogger, setMetricSink } from './common/json-logger';
import { loadConfig } from './config/config';

async function bootstrap() {
  const cfg = loadConfig();
  // NFR-8.1: log JSON có traceId khi chạy production (CloudWatch); dev giữ log dạng chữ của Nest.
  const json = cfg.logFormat === 'json' ? new JsonLogger('api', cfg.appVersion) : null;
  const app = await NestFactory.create(AppModule, json ? { logger: json } : {});
  if (json) {
    setMetricSink(json);
    app.use(accessLog(json));
  }
  configureApp(app, cfg);
  await app.listen(cfg.port);
  Logger.log(`API ${cfg.appVersion}: http://localhost:${cfg.port}/api/v1 · Swagger: http://localhost:${cfg.port}/api/docs · auth=${cfg.auth.mode}`, 'Bootstrap');
}
bootstrap();
