import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { TtlCache } from '../../common/ttl-cache';
import { APP_CONFIG, AppConfig } from '../../config/config';

export interface VerifiedToken {
  subject: string;
  email: string;
  roles: string[];
}

type Claims = JWTPayload & Record<string, unknown>;

/** Đọc claim theo đường dẫn chấm, ví dụ `realm_access.roles`; tên có dấu hai chấm (`cognito:groups`) đọc nguyên. */
export function claimAt(payload: Claims, path: string): unknown {
  return path.split('.').reduce<unknown>((v, key) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[key] : undefined), payload);
}

/**
 * Lấy client, role, email từ payload đã kiểm chữ ký. Hàm thuần để test cả hai kiểu token:
 * - Keycloak: `azp`, `realm_access.roles`, `email`
 * - Cognito access token: `client_id`, `cognito:groups`, `token_use=access`, không có `email`
 */
export function readClaims(payload: Claims, auth: AppConfig['auth']): { client: string; roles: string[]; email: string | null } {
  if (payload.token_use !== undefined && payload.token_use !== 'access') {
    throw new UnauthorizedException('Chỉ chấp nhận access token');
  }
  const client = claimAt(payload, auth.clientClaim);
  if (typeof client !== 'string' || !auth.allowedClients.includes(client)) {
    throw new UnauthorizedException('Token không cấp cho ứng dụng này');
  }
  const roles = claimAt(payload, auth.rolesClaim);
  const email = typeof payload.email === 'string' && payload.email ? payload.email.toLowerCase() : null;
  return { client, roles: Array.isArray(roles) ? roles.map(String) : [], email };
}

/**
 * Xác thực access token.
 * - AUTH_MODE=oidc: kiểm tra chữ ký JWT bằng JWKS của IdP (Keycloak local, Cognito trên staging), issuer, hạn dùng và client.
 *   JWKS được jose cache trong bộ nhớ, nên IdP lỗi tạm thời thì token còn hạn vẫn dùng được.
 *   Token không có email (Cognito) thì lấy email từ userinfo, cache theo `sub` 10 phút.
 * - AUTH_MODE=dev: token dạng "dev:<email>" để test nhanh không cần Keycloak; chỉ khớp tài khoản theo email, không ghi subject. Bị chặn khi NODE_ENV=production.
 */
@Injectable()
export class TokenVerifier {
  private jwks?: Parameters<typeof jwtVerify>[1];
  private readonly emails = new TtlCache<string>(10 * 60_000);

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

    let payload: Claims;
    try {
      ({ payload } = await jwtVerify(token, this.jwks as any, { issuer: this.cfg.auth.issuer }));
    } catch {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }
    if (!payload.sub) throw new UnauthorizedException('Token thiếu sub');
    const claims = readClaims(payload, this.cfg.auth);
    const email = claims.email ?? (await this.emailFromUserinfo(payload.sub, token));
    return { subject: payload.sub, email, roles: claims.roles };
  }

  private async emailFromUserinfo(sub: string, token: string): Promise<string> {
    const url = this.cfg.auth.userinfoUrl;
    if (!url) throw new UnauthorizedException('Token thiếu email');
    return this.emails.getOrLoad(sub, async () => {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
      if (!res?.ok) throw new UnauthorizedException('Không lấy được email từ IdP');
      const info = (await res.json()) as { sub?: string; email?: string };
      if (info.sub !== sub || !info.email) throw new UnauthorizedException('Userinfo không khớp token');
      return info.email.toLowerCase();
    });
  }
}
