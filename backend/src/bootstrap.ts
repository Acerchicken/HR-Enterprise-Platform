import { BadRequestException, INestApplication, ValidationError, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { ApiErrorFilter } from './common/api-error.filter';
import { AppConfig } from './config/config';

/** Cấu hình dùng chung cho main.ts, e2e test và script xuất OpenAPI. */
export function configureApp(app: INestApplication, cfg: AppConfig) {
  app.setGlobalPrefix('api/v1');
  // staging-readiness F5: sau App Runner/ALB, req.ip lấy từ X-Forwarded-For đúng số lớp proxy (cfg.trustProxy).
  if (cfg.trustProxy > 0) (app as NestExpressApplication).set('trust proxy', cfg.trustProxy);
  // UC1 E16, AC-1.14.6: body JSON tối đa 64 KiB, vượt thì 413.
  (app as NestExpressApplication).useBodyParser('json', { limit: '64kb' });
  app.enableCors({ origin: cfg.corsOrigin.split(','), exposedHeaders: ['X-Trace-Id', 'Retry-After'] });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, exceptionFactory: validationError }),
  );
  app.useGlobalFilters(new ApiErrorFilter());
  SwaggerModule.setup('api/docs', app, buildOpenApi(app));
}

/**
 * Lỗi validation: giữ `message` là danh sách lỗi như cũ, thêm `fields` (tên trường → lỗi đầu tiên) để form hiện lỗi đúng ô.
 */
export function validationError(errors: ValidationError[]) {
  const fields: Record<string, string> = {};
  const messages: string[] = [];
  const walk = (list: ValidationError[], prefix = '') => {
    for (const e of list) {
      const key = prefix + e.property;
      const msgs = Object.values(e.constraints ?? {});
      if (msgs.length) {
        fields[key] ??= msgs[0];
        messages.push(...msgs);
      }
      if (e.children?.length) walk(e.children, `${key}.`);
    }
  };
  walk(errors);
  return new BadRequestException({ message: messages, fields });
}

export function buildOpenApi(app: INestApplication): OpenAPIObject {
  const doc = new DocumentBuilder()
    .setTitle('HRHelper API (HR Enterprise Platform)')
    .setDescription('REST API /api/v1. Xác thực: Bearer JWT do Keycloak (OIDC) cấp. Lỗi: {code, message, traceId}.')
    .setVersion('0.1.0 (tuần 7)')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, doc);
}
