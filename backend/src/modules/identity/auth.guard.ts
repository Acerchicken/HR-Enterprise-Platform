import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC, REQUIRED_ROLES } from './auth.decorators';
import { IdentityService } from './identity.service';
import { hasRole, Role } from './roles';
import { TokenVerifier } from './token-verifier';

/** Guard toàn cục: mọi endpoint đều cần Bearer token, trừ endpoint có @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly verifier: TokenVerifier,
    private readonly identity: IdentityService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;

    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('Thiếu Bearer token');

    const token = await this.verifier.verify(header.slice(7));
    req.user = await this.identity.resolve(token);

    const required = this.reflector.getAllAndOverride<Role[] | undefined>(REQUIRED_ROLES, targets);
    if (required?.length && !hasRole(req.user, ...required)) {
      throw new ForbiddenException('Không đủ quyền');
    }
    return true;
  }
}
