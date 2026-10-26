import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

/** Gắn traceId cho mỗi request (nhận từ header X-Trace-Id nếu có) để đối chiếu log. */
@Injectable()
export class TraceIdMiddleware implements NestMiddleware {
  use(req: Request & { traceId?: string }, res: Response, next: NextFunction) {
    const incoming = req.header('x-trace-id');
    req.traceId = incoming && incoming.length <= 64 ? incoming : randomUUID();
    res.setHeader('X-Trace-Id', req.traceId);
    next();
  }
}
