import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { TtlCache } from '../../common/ttl-cache';
import { APP_CONFIG, AppConfig } from '../../config/config';

/**
 * Token chỉ cho biết người gọi là ai. Vai trò không lấy từ token (nhóm trên IdP chỉ để IdP bắt MFA):
 * `IdentityService` đọc vai trò từ database (ADR-18).
 */
export interface VerifiedToken {
  subject: string;
  email: string;
  /**
   * IdP đã xác minh email (`email_verified`). Chỉ khi true mới được khớp tài khoản với hồ sơ theo email (threat model T-02):
   * nếu không, ai đó tự đặt email của người khác trên IdP có thể nhận hồ sơ của họ. Thiếu claim thì coi là chưa xác minh.
   */
  emailVerified: boolean;
}

/** Keycloak trả boolean; Cognito userinfo trả chuỗi "true"/"false". */
export function isVerified(v: unknown): boolean {
  return v === true || v === 'true';
}

type Claims = JWTPayload & Record<string, unknown>;

/** Đọc claim theo đường dẫn chấm, ví dụ `realm_access.roles`; tên có dấu hai chấm (`cognito:groups`) đọc nguyên. */
export function claimAt(payload: Claims, path: string): unknown {
  return path.split('.').reduce<unknown>((v, key) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[key] : undefined), payload);
}

/**
 * Lấy client, email từ payload đã kiểm chữ ký. Hàm thuần để test cả hai kiểu token:
 * - Keycloak: `azp`, `email`, `email_verified`
 * - Cognito access token: `client_id`, `token_use=access`, không có `email`
 * Claim nhóm (`realm_access.roles`, `cognito:groups`) cố ý không đọc (ADR-18, AC-8.1.10).
 */
export function readClaims(
  payload: Claims,
  auth: AppConfig['auth'],
): { client: string; email: string | null; emailVerified: boolean } {
  if (payload.token_use !== undefined && payload.token_use !== 'access') {
    throw new UnauthorizedException('Chỉ chấp nhận access token');
  }
  const client = claimAt(payload, auth.clientClaim);
  if (typeof client !== 'string' || !auth.allowedClients.includes(client)) {
    throw new UnauthorizedException('Token không cấp cho ứng dụng này');
  }
  const email = typeof payload.email === 'string' && payload.email ? payload.email.toLowerCase() : null;
  return { client, email, emailVerified: email ? isVerified(payload.email_verified) : false };
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
  private readonly emails = new TtlCache<{ email: string; emailVerified: boolean }>(10 * 60_000);

  constructor(@Inject(APP_CONFIG) private readonly cfg: AppConfig) {
    if (cfg.auth.mode === 'oidc') {
      this.jwks = createRemoteJWKSet(new URL(cfg.auth.jwksUri), { cooldownDuration: 30_000 });
    }
  }

  async verify(token: string): Promise<VerifiedToken> {
    if (this.cfg.auth.mode === 'dev') {
      if (!token.startsWith('dev:')) throw new UnauthorizedException('Token dev phải có dạng dev:<email>');
      const email = token.slice(4).trim().toLowerCase();
      return { subject: `dev|${email}`, email, emailVerified: true };
    }

    let payload: Claims;
    try {
      ({ payload } = await jwtVerify(token, this.jwks as any, { issuer: this.cfg.auth.issuer }));
    } catch {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }
    if (!payload.sub) throw new UnauthorizedException('Token thiếu sub');
    const claims = readClaims(payload, this.cfg.auth);
    if (claims.email) return { subject: payload.sub, email: claims.email, emailVerified: claims.emailVerified };
    return { subject: payload.sub, ...(await this.emailFromUserinfo(payload.sub, token)) };
  }

  private async emailFromUserinfo(sub: string, token: string): Promise<{ email: string; emailVerified: boolean }> {
    const url = this.cfg.auth.userinfoUrl;
    if (!url) throw new UnauthorizedException('Token thiếu email');
    return this.emails.getOrLoad(sub, async () => {
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
      if (!res?.ok) throw new UnauthorizedException('Không lấy được email từ IdP');
      const info = (await res.json()) as { sub?: string; email?: string; email_verified?: unknown };
      if (info.sub !== sub || !info.email) throw new UnauthorizedException('Userinfo không khớp token');
      return { email: info.email.toLowerCase(), emailVerified: isVerified(info.email_verified) };
    });
  }
}
