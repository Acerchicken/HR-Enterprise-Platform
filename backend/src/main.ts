import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { loadConfig } from './config/config';

async function bootstrap() {
  const cfg = loadConfig();
  const app = await NestFactory.create(AppModule);
  configureApp(app, cfg);
  await app.listen(cfg.port);
  Logger.log(`API: http://localhost:${cfg.port}/api/v1 · Swagger: http://localhost:${cfg.port}/api/docs · auth=${cfg.auth.mode}`, 'Bootstrap');
}
bootstrap();
