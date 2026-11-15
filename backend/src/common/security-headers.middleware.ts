import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/**
 * Header bảo mật cho API (NFR-5.22). API chỉ trả JSON và file tải xuống, nên CSP chặn mọi thứ; riêng Swagger UI
 * (`/api/docs`) cần script và style của chính nó. HSTS chỉ bật khi chạy sau HTTPS (production).
 */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  private readonly hsts = process.env.NODE_ENV === 'production';

  use(req: Request, res: Response, next: NextFunction) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const docs = req.originalUrl.startsWith('/api/docs');
    res.setHeader(
      'Content-Security-Policy',
      docs
        ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'"
        : "default-src 'none'; frame-ancestors 'none'",
    );
    if (this.hsts) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.removeHeader('X-Powered-By');
    next();
  }
}
