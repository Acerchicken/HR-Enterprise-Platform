/**
 * Xuất đặc tả OpenAPI từ code ra docs/openapi.yaml:  npm run openapi
 * (cần database đang chạy vì AppModule kết nối DB khi khởi tạo).
 */
import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { stringify } from 'yaml';
import { AppModule } from './app.module';
import { configureApp, buildOpenApi } from './bootstrap';
import { loadConfig } from './config/config';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: ['error'] });
  configureApp(app, loadConfig());
  await app.init();
  const out = join(__dirname, '..', '..', 'docs', 'openapi.yaml');
  writeFileSync(out, '# Sinh tự động từ code – không sửa tay. Cập nhật: npm run openapi (trong backend/)\n' + stringify(buildOpenApi(app)));
  console.log(`Đã ghi ${out}`);
  await app.close();
}
main();
