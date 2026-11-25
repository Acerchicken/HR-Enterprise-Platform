import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { TooManyRequestsException } from './rate-limit/rate-limit.service';

const CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'UNPROCESSABLE',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL',
  503: 'SERVICE_UNAVAILABLE',
};

/**
 * Mọi lỗi trả về cùng một format {code, message, traceId} (quy ước API tuần 6).
 */
@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { traceId?: string }>();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Lỗi hệ thống';
    let fields: Record<string, string> | undefined;
    let details: Record<string, unknown> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message =
        typeof body === 'string' ? body : ((body as { message?: string | string[] }).message ?? exception.message);
      if (typeof body === 'object') {
        fields = (body as { fields?: Record<string, string> }).fields;
        // Số liệu kèm lỗi để giao diện nói rõ lý do, ví dụ E13 UC2 {members, activeChildren}.
        details = (body as { details?: Record<string, unknown> }).details;
      }
    } else if ((exception as { type?: string })?.type === 'entity.too.large') {
      // body-parser: body vượt 64 KiB (E16).
      status = HttpStatus.PAYLOAD_TOO_LARGE;
      message = 'Dữ liệu gửi lên quá lớn (tối đa 64 KiB)';
    } else if (exception instanceof QueryFailedError && (exception as any).code === '23505') {
      status = HttpStatus.CONFLICT;
      message = 'Dữ liệu bị trùng';
    } else if (isDbTimeout(exception)) {
      // SRS 6.14 "Database chậm hoặc hết kết nối": quá DB_STATEMENT_TIMEOUT_MS hoặc DB_CONNECT_TIMEOUT_MS thì trả 503, không treo.
      status = HttpStatus.SERVICE_UNAVAILABLE;
      message = 'Hệ thống đang bận, vui lòng thử lại sau ít phút';
      res.setHeader('Retry-After', '5');
      this.logger.warn(`Database quá thời gian chờ: ${(exception as Error).message}`, `traceId=${req.traceId}`);
    } else {
      // Chỉ log message + stack: QueryFailedError còn mang câu SQL và tham số (có thể chứa dữ liệu cá nhân).
      this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception), `traceId=${req.traceId}`);
    }

    if (exception instanceof TooManyRequestsException) res.setHeader('Retry-After', String(exception.retryAfter));
    res.status(status).json({
      code: CODE_BY_STATUS[status] ?? `HTTP_${status}`,
      message,
      ...(fields ? { fields } : {}),
      ...(details ? { details } : {}),
      traceId: req.traceId,
    });
  }
}

/** 57014 = query_canceled (statement_timeout); lỗi của pg Pool khi chờ kết nối quá connectionTimeoutMillis. */
export function isDbTimeout(e: unknown): boolean {
  if (e instanceof QueryFailedError && (e as { code?: string }).code === '57014') return true;
  const msg = e instanceof Error ? e.message : '';
  return /timeout exceeded when trying to connect|Connection terminated due to connection timeout/i.test(msg);
}
