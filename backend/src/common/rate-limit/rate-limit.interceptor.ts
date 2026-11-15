import { CallHandler, ExecutionContext, Global, Injectable, Module, NestInterceptor, SetMetadata } from '@nestjs/common';
import { APP_INTERCEPTOR, Reflector } from '@nestjs/core';
import { from, Observable, switchMap } from 'rxjs';
import { AuthUser } from '../../modules/identity/roles';
import { RateGroup } from './rate-limit-rules';
import { RateLimitService } from './rate-limit.service';

export const RATE_LIMIT_GROUP = 'rateLimitGroup';

/** Gắn nhóm giới hạn riêng cho endpoint, ví dụ `@RateLimit('profile-write')`. Mọi request còn tính vào nhóm `global`. */
export const RateLimit = (group: RateGroup) => SetMetadata(RATE_LIMIT_GROUP, group);

/**
 * Chạy sau AuthGuard (interceptor luôn chạy sau mọi guard) nên đã biết người gọi. Request chưa đăng nhập (health) không tính.
 */
@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimitService,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const user: AuthUser | undefined = ctx.switchToHttp().getRequest().user;
    if (!user) return next.handle();
    const group = this.reflector.getAllAndOverride<RateGroup | undefined>(RATE_LIMIT_GROUP, [ctx.getHandler(), ctx.getClass()]);
    const run = async () => {
      await this.limiter.consume(user.userId, 'global');
      if (group) await this.limiter.consume(user.userId, group);
    };
    return from(run()).pipe(switchMap(() => next.handle()));
  }
}

@Global()
@Module({
  providers: [RateLimitService, { provide: APP_INTERCEPTOR, useClass: RateLimitInterceptor }],
  exports: [RateLimitService],
})
export class RateLimitModule {}
