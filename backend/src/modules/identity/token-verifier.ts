import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { APP_CONFIG, AppConfig } from '../../config/config';

export interface VerifiedToken {
  subject: string;
  email: string;
  roles: string[];
}

/**
 * Xác thực access token.
 * - AUTH_MODE=oidc: kiểm tra chữ ký JWT bằng JWKS của IdP (Keycloak), issuer, hạn dùng và client (azp).
 *   JWKS được jose cache trong bộ nhớ, nên IdP lỗi tạm thời thì token còn hạn vẫn dùng được.
 * - AUTH_MODE=dev: token dạng "dev:<email>" để test nhanh không cần Keycloak; chỉ khớp tài khoản theo email, không ghi subject. Bị chặn khi NODE_ENV=production.
 */
@Injectable()
export class TokenVerifier {
  private readonly jwks?: ReturnType<typeof createRemoteJWKSet>;

  constructor(@Inject(APP_CONFIG) private readonly cfg: AppConfig) {
    if (cfg.auth.mode === 'oidc') {
      this.jwks = createRemoteJWKSet(new URL(cfg.auth.jwksUri), { cooldownDuration: 30_000 });
    }
  }

  async verify(token: string): Promise<VerifiedToken> {
    if (this.cfg.auth.mode === 'dev') {
      if (!token.startsWith('dev:')) throw new UnauthorizedException('Token dev phải có dạng dev:<email>');
      const email = token.slice(4).trim().toLowerCase();
      return { subject: `dev|${email}`, email, roles: [] };
    }

    let payload: JWTPayload & Record<string, any>;
    try {
      ({ payload } = await jwtVerify(token, this.jwks!, { issuer: this.cfg.auth.issuer }));
    } catch {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }
    if (!this.cfg.auth.allowedClients.includes(String(payload.azp))) {
      throw new UnauthorizedException('Token không cấp cho ứng dụng này');
    }
    const email = String(payload.email ?? '').toLowerCase();
    if (!payload.sub || !email) throw new UnauthorizedException('Token thiếu sub hoặc email');
    return {
      subject: payload.sub,
      email,
      roles: (payload.realm_access?.roles as string[] | undefined) ?? [],
    };
  }
}
