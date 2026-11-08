import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { loadConfig } from '../../config/config';
import { claimAt, readClaims, TokenVerifier } from './token-verifier';

const ISSUER = 'https://cognito-idp.ap-southeast-1.amazonaws.com/ap-southeast-1_test';

const keycloak = loadConfig({ OIDC_ALLOWED_CLIENTS: 'hr-web' }).auth;
const cognito = loadConfig({
  OIDC_ISSUER: ISSUER,
  OIDC_ALLOWED_CLIENTS: 'web-client-123',
  OIDC_CLIENT_CLAIM: 'client_id',
  OIDC_ROLES_CLAIM: 'cognito:groups',
  OIDC_USERINFO_URL: 'https://hr.auth.ap-southeast-1.amazoncognito.com/oauth2/userInfo',
}).auth;

describe('readClaims', () => {
  it('token Keycloak: azp, realm_access.roles, email', () => {
    const p = { sub: 's', azp: 'hr-web', email: 'HR@hr.local', realm_access: { roles: ['hr', 'offline_access'] } };
    expect(readClaims(p, keycloak)).toEqual({ client: 'hr-web', roles: ['hr', 'offline_access'], email: 'hr@hr.local' });
  });

  it('access token Cognito: client_id, cognito:groups, không có email', () => {
    const p = { sub: 's', client_id: 'web-client-123', token_use: 'access', 'cognito:groups': ['manager'] };
    expect(readClaims(p, cognito)).toEqual({ client: 'web-client-123', roles: ['manager'], email: null });
  });

  it('từ chối ID token của Cognito và client lạ', () => {
    expect(() => readClaims({ sub: 's', client_id: 'web-client-123', token_use: 'id' }, cognito)).toThrow('access token');
    expect(() => readClaims({ sub: 's', azp: 'other-app' }, keycloak)).toThrow('ứng dụng');
    expect(() => readClaims({ sub: 's', client_id: 'web-client-123' }, keycloak)).toThrow('ứng dụng');
  });

  it('claimAt đọc đường dẫn chấm và tên có dấu hai chấm', () => {
    expect(claimAt({ a: { b: [1] } }, 'a.b')).toEqual([1]);
    expect(claimAt({ 'cognito:groups': ['hr'] }, 'cognito:groups')).toEqual(['hr']);
    expect(claimAt({ a: 1 }, 'a.b.c')).toBeUndefined();
  });
});

describe('TokenVerifier với Cognito', () => {
  let sign: (claims: Record<string, unknown>) => Promise<string>;
  let verifier: TokenVerifier;
  const fetchMock = jest.fn();

  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
    sign = (claims) =>
      new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer(ISSUER).setIssuedAt().setExpirationTime('5m').sign(privateKey);
    verifier = new TokenVerifier({ ...loadConfig({}), auth: { ...cognito, mode: 'oidc' } });
    (verifier as any).jwks = createLocalJWKSet({ keys: [jwk] });
    global.fetch = fetchMock as any;
  });

  beforeEach(() => fetchMock.mockReset());

  it('lấy email từ userinfo một lần rồi cache theo sub', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ sub: 'u-1', email: 'Manager@hr.local' }) });
    const token = await sign({ sub: 'u-1', client_id: 'web-client-123', token_use: 'access', 'cognito:groups': ['manager'] });
    await expect(verifier.verify(token)).resolves.toEqual({ subject: 'u-1', email: 'manager@hr.local', roles: ['manager'] });
    await verifier.verify(token);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${token}`);
  });

  it('userinfo trả sub khác token thì từ chối', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ sub: 'someone-else', email: 'x@hr.local' }) });
    const token = await sign({ sub: 'u-2', client_id: 'web-client-123', token_use: 'access' });
    await expect(verifier.verify(token)).rejects.toThrow('không khớp');
  });

  it('chữ ký sai thì từ chối', async () => {
    const forged = (await sign({ sub: 'u-3', client_id: 'web-client-123' })).slice(0, -4) + 'AAAA';
    await expect(verifier.verify(forged)).rejects.toThrow('không hợp lệ');
  });
});
