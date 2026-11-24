import { createServer, Server } from 'http';
import { AddressInfo } from 'net';
import { DataSource } from 'typeorm';
import { AppConfig } from '../../config/config';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../identity/roles';
import { AssistantConfigService } from './assistant-config.service';

const ACCOUNT = 'aaaaaaaa-0000-4000-8000-000000000001';
/** Tài khoản chỉ có vai trò ADMIN, không có hồ sơ nhân viên (góp ý review #133). */
const admin = { userId: ACCOUNT, employeeId: null, email: 'it@hr.local', roles: ['ADMIN'] } as unknown as AuthUser;
const KEY = 'sk-unit-secret-key-4321';

describe('AssistantConfigService (UC6 FR-6.4)', () => {
  let server: Server;
  let base: string;
  const calls: Array<{ method: string; url: string; body: any }> = [];

  beforeAll(async () => {
    server = createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        const body = raw ? JSON.parse(raw) : undefined;
        calls.push({ method: req.method!, url: req.url!, body });
        const after = { provider: 'deepseek', model: 'deepseek-chat', apiKeyLast4: '4321', enabled: true, version: 1, updatedBy: body?.updatedBy ?? ACCOUNT, updatedAt: '2026-11-24T02:00:00Z' };
        const out =
          req.method === 'PUT'
            ? { before: null, after }
            : req.url === '/internal/config/test'
              ? { ok: true, latencyMs: 5 }
              : { config: after, providers: [{ id: 'deepseek', name: 'DeepSeek', dataRegion: 'Trung Quốc' }] };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(out));
      });
    });
    await new Promise<void>((ok) => server.listen(0, '127.0.0.1', () => ok()));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((ok) => server.close(() => ok())));
  beforeEach(() => (calls.length = 0));

  const make = (audit: Partial<AuditService>) => {
    const cfg = { assistant: { url: base, internalToken: 'token-token-token-1', timeoutMs: 1000 } } as AppConfig;
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const db = { query: async (sql: string, params: unknown[]) => (queries.push({ sql, params }), [{ name: 'it@hr.local' }]) } as unknown as DataSource;
    return { svc: new AssistantConfigService(cfg, audit as AuditService, db), queries };
  };

  it('người sửa lưu bằng id tài khoản; tài khoản không có hồ sơ hiện email', async () => {
    const records: any[] = [];
    const { svc, queries } = make({ record: async (e) => void records.push(e) });
    const view = await svc.save(admin, { provider: 'deepseek', model: 'deepseek-chat', apiKey: KEY, enabled: true, version: 0 });
    expect(calls.find((c) => c.method === 'PUT')!.body.updatedBy).toBe(ACCOUNT);
    expect(view).toMatchObject({ updatedBy: ACCOUNT, updatedByName: 'it@hr.local', apiKeyLast4: '4321' });
    expect(queries[0].sql).toContain('iam.user_account');
    expect(records[0]).toMatchObject({ action: 'ASSISTANT_CONFIG_UPDATE', actorId: null, changedFields: { accountId: ACCOUNT, version: 1 } });
    expect(JSON.stringify(records)).not.toContain(KEY);
  });

  it('ghi audit lỗi sau khi cấu hình đã lưu: không báo lỗi, log error kèm before/after, không có khóa', async () => {
    const { svc } = make({ record: async () => Promise.reject(new Error('db down')) });
    const errors: string[] = [];
    jest.spyOn((svc as any).logger, 'error').mockImplementation((m: unknown) => void errors.push(String(m)));
    await expect(svc.save(admin, { provider: 'deepseek', model: 'deepseek-chat', apiKey: KEY, enabled: true, version: 0 })).resolves.toMatchObject({ version: 1 });
    await expect(svc.test(admin, { provider: 'deepseek', model: 'deepseek-chat', apiKey: KEY })).resolves.toMatchObject({ ok: true });
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain('ASSISTANT_CONFIG_AUDIT_FAILED');
    expect(errors[0]).toContain('"to":"deepseek"');
    expect(errors.join()).not.toContain(KEY);
  });
});
