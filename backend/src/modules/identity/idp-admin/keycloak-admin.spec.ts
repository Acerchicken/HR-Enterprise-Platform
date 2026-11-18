import { IdpError } from './idp-admin';
import { KeycloakIdpAdmin, splitName } from './keycloak-admin';

const cfg = { baseUrl: 'http://kc', realm: 'hr', clientId: 'hr-api-admin', clientSecret: 'x' };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Giả lập Keycloak: `users` là danh sách người dùng hiện có; ghi lại mọi request. */
function fakeKeycloak(users: { id: string; email: string }[] = [], fail?: (method: string, url: string) => number | undefined) {
  const calls: { method: string; url: string; body?: unknown }[] = [];
  const http = jest.fn(async (url: string, init: RequestInit) => {
    const method = init.method ?? 'GET';
    calls.push({ method, url, body: init.body && typeof init.body === 'string' ? JSON.parse(init.body) : undefined });
    const status = fail?.(method, url);
    if (status) return new Response('', { status });
    if (url.endsWith('/token')) return json({ access_token: 't', expires_in: 300 });
    if (method === 'GET' && url.includes('/users?email=')) {
      const email = decodeURIComponent(url.split('email=')[1].split('&')[0]);
      return json(users.filter((u) => u.email === email));
    }
    if (method === 'GET' && url.includes('/roles/')) return json({ id: 'r', name: url.split('/roles/')[1] });
    if (method === 'POST' && url.endsWith('/users')) {
      users.push({ id: 'new-id', email: (calls.at(-1)!.body as { email: string }).email });
      return new Response(null, { status: 201 });
    }
    return new Response(null, { status: 204 });
  });
  return { kc: new KeycloakIdpAdmin(cfg, http as any), calls, http };
}

describe('KeycloakIdpAdmin', () => {
  it('tạo người dùng mới: gán role, gửi thư UPDATE_PASSWORD hạn 7 ngày', async () => {
    const { kc, calls } = fakeKeycloak();
    const r = await kc.createUser({ email: 'an@hr.local', fullName: 'Nguyễn Văn An', groups: ['employee'] });
    expect(r).toEqual({ subject: 'new-id', created: true });
    const create = calls.find((c) => c.method === 'POST' && c.url.endsWith('/users'))!;
    expect(create.body).toMatchObject({ email: 'an@hr.local', firstName: 'An', lastName: 'Nguyễn Văn', emailVerified: true });
    expect(calls.some((c) => c.url.endsWith('/users/new-id/role-mappings/realm'))).toBe(true);
    const mail = calls.find((c) => c.url.includes('execute-actions-email'))!;
    expect(mail.url).toContain('lifespan=604800');
    expect(mail.body).toEqual(['UPDATE_PASSWORD']);
  });

  it('người dùng đã có: không tạo, không gửi thư (idempotent)', async () => {
    const { kc, calls } = fakeKeycloak([{ id: 'u1', email: 'an@hr.local' }]);
    expect(await kc.createUser({ email: 'an@hr.local', fullName: 'An', groups: ['employee'] })).toEqual({ subject: 'u1', created: false });
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/users'))).toBe(false);
    expect(calls.some((c) => c.url.includes('execute-actions-email'))).toBe(false);
  });

  it('token quản trị được dùng lại giữa các lần gọi', async () => {
    const { kc, calls } = fakeKeycloak([{ id: 'u1', email: 'an@hr.local' }]);
    await kc.disableUser('an@hr.local');
    await kc.signOutAll('an@hr.local');
    expect(calls.filter((c) => c.url.endsWith('/token'))).toHaveLength(1);
  });

  it('khóa người không còn trên IdP: bỏ qua; mở khóa: lỗi cố định IDP_USER_NOT_FOUND', async () => {
    const { kc } = fakeKeycloak();
    await expect(kc.disableUser('x@hr.local')).resolves.toBeUndefined();
    await expect(kc.enableUser('x@hr.local')).rejects.toMatchObject({ transient: false, code: 'IDP_USER_NOT_FOUND' });
  });

  it('5xx, mất kết nối → lỗi tạm thời; 400 → lỗi cố định', async () => {
    let { kc } = fakeKeycloak([{ id: 'u1', email: 'an@hr.local' }], (m) => (m === 'PUT' ? 503 : undefined));
    await expect(kc.disableUser('an@hr.local')).rejects.toMatchObject({ transient: true });
    ({ kc } = fakeKeycloak([{ id: 'u1', email: 'an@hr.local' }], (m) => (m === 'PUT' ? 400 : undefined)));
    await expect(kc.disableUser('an@hr.local')).rejects.toMatchObject({ transient: false, code: 'IDP_REJECTED' });
    const down = new KeycloakIdpAdmin(cfg, (async () => {
      throw new Error('ECONNREFUSED');
    }) as any);
    await expect(down.disableUser('an@hr.local')).rejects.toBeInstanceOf(IdpError);
  });

  it('splitName tách tên cuối làm firstName', () => {
    expect(splitName('  Trần   Thị Nhân ')).toEqual({ firstName: 'Nhân', lastName: 'Trần Thị' });
    expect(splitName('An')).toEqual({ firstName: 'An', lastName: '' });
  });
});
