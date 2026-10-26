import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { ApiErrorFilter } from './common/api-error.filter';
import { AppConfig } from './config/config';

/** Cấu hình dùng chung cho main.ts, e2e test và script xuất OpenAPI. */
export function configureApp(app: INestApplication, cfg: AppConfig) {
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: cfg.corsOrigin.split(','), exposedHeaders: ['X-Trace-Id'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new ApiErrorFilter());
  SwaggerModule.setup('api/docs', app, buildOpenApi(app));
}

export function buildOpenApi(app: INestApplication): OpenAPIObject {
  const doc = new DocumentBuilder()
    .setTitle('Enterprise HR Platform API')
    .setDescription('REST API /api/v1. Xác thực: Bearer JWT do Keycloak (OIDC) cấp. Lỗi: {code, message, traceId}.')
    .setVersion('0.1.0 (tuần 7)')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, doc);
}
