import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { requestContext } from './request-context';

/**
 * Gắn traceId cho mỗi request (nhận từ header X-Trace-Id nếu có) để đối chiếu log. Lưu cả traceId, IP vào request context để
 * mọi bản ghi audit của request có hai giá trị này (UC7 AC-7.1.4), kể cả module không truyền `meta`.
 */
@Injectable()
export class TraceIdMiddleware implements NestMiddleware {
  use(req: Request & { traceId?: string }, res: Response, next: NextFunction) {
    const incoming = req.header('x-trace-id');
    const traceId = incoming && incoming.length <= 64 ? incoming : randomUUID();
    req.traceId = traceId;
    res.setHeader('X-Trace-Id', traceId);
    requestContext.run({ traceId, ip: req.ip ?? null }, next);
  }
}
