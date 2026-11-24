/**
 * Cấu hình nhà cung cấp LLM với PostgreSQL thật (FR-6.4: AC-6.4.1 → AC-6.4.5, NFR-5.17). Chỉ chạy khi có TEST_DB_URL
 * (database đã chạy migration của backend).
 */
import { randomBytes } from 'crypto';
import { IncomingMessage } from 'http';
import { Pool } from 'pg';
import { configRoutes } from './config-route';
import { DbConfigStore } from './config-store';
import { LlmError, LlmProvider } from './provider';
import { registerProvider } from './providers';
import { SecretBox } from './secret-box';

const url = process.env.TEST_DB_URL;
const d = url ? describe : describe.skip;
const TOKEN = 'test-internal-token-01';
const req = { headers: { authorization: `Bearer ${TOKEN}` } } as unknown as IncomingMessage;
const ADMIN = '11111111-2222-3333-4444-555555555555';

/** Adapter giả: khóa `good-key-…` hợp lệ, `slow-key-…` thì nhà cung cấp không phản hồi. */
class FakeAdapter implements LlmProvider {
  keys: string[] = [];
  private check(apiKey: string) {
    this.keys.push(apiKey);
    if (apiKey.startsWith('slow-key')) throw new LlmError('unavailable', 'down');
    if (!apiKey.startsWith('good-key')) throw new LlmError('auth', 'bad key');
  }
  async answer(): Promise<never> {
    throw new Error('không dùng');
  }
  async listModels(o: { apiKey: string }) {
    this.check(o.apiKey);
    return [{ id: 'm-1', name: 'Model 1' }];
  }
  async testConnection(o: { apiKey: string; model: string }) {
    this.check(o.apiKey);
    if (o.model === 'missing') throw new LlmError('bad_request', 'no model');
  }
}

d('DbConfigStore + /internal/config (Postgres)', () => {
  let pool: Pool;
  let store: DbConfigStore;
  let routes: ReturnType<typeof configRoutes>;
  const fakeA = new FakeAdapter();
  const fakeB = new FakeAdapter();

  beforeAll(async () => {
    pool = new Pool({ connectionString: url });
    registerProvider({ id: 'fake-a', name: 'Fake A', dataRegion: 'Việt Nam', defaultBaseUrl: null, adapter: fakeA });
    registerProvider({ id: 'fake-b', name: 'Fake B', dataRegion: 'Việt Nam', defaultBaseUrl: null, adapter: fakeB });
    store = new DbConfigStore(pool, new SecretBox(randomBytes(32).toString('base64')));
    routes = configRoutes(store, TOKEN, 1000);
    await pool.query('DELETE FROM assistant.llm_config');
  });
  afterAll(async () => {
    await pool.query('DELETE FROM assistant.llm_config');
    await pool.end();
  });

  const put = (body: object) => routes['PUT /internal/config'](req, { updatedBy: ADMIN, enabled: true, ...body });

  it('chưa có cấu hình: GET trả config null kèm danh sách nhà cung cấp; current() null (AC-6.4.7)', async () => {
    const r = await routes['GET /internal/config'](req, undefined);
    expect(r.status).toBe(200);
    expect((r.body as any).config).toBeNull();
    expect((r.body as any).providers).toEqual(expect.arrayContaining([{ id: 'deepseek', name: 'DeepSeek', dataRegion: 'Trung Quốc' }]));
    expect(await store.current()).toBeNull();
  });

  it('sai token nội bộ thì 401', async () => {
    const r = await routes['GET /internal/config']({ headers: {} } as IncomingMessage, undefined);
    expect(r.status).toBe(401);
  });

  it('lưu lần đầu bắt buộc khóa; lưu xong database chỉ có bản mã hóa, GET chỉ thấy 4 ký tự cuối (AC-6.4.4)', async () => {
    expect((await put({ provider: 'fake-a', model: 'm-1', version: 0 })).status).toBe(400);
    const r = await put({ provider: 'fake-a', model: 'm-1', apiKey: 'good-key-AAAA1234', version: 0 });
    expect(r.status).toBe(200);
    expect((r.body as any).before).toBeNull();
    expect((r.body as any).after).toMatchObject({ provider: 'fake-a', model: 'm-1', apiKeyLast4: '1234', enabled: true, version: 1, updatedBy: ADMIN });
    expect(JSON.stringify(r.body)).not.toContain('good-key');

    const { rows } = await pool.query('SELECT api_key_ciphertext FROM assistant.llm_config');
    expect(rows[0].api_key_ciphertext).toMatch(/^v1:/);
    expect(rows[0].api_key_ciphertext).not.toContain('good-key');

    const view = await routes['GET /internal/config'](req, undefined);
    expect(JSON.stringify(view.body)).not.toContain('good-key');
    expect(await store.current()).toMatchObject({ provider: 'fake-a', model: 'm-1', apiKey: 'good-key-AAAA1234', enabled: true });
  });

  it('version cũ thì 409 (AC-6.4.6); chỉ đổi model, tắt trợ lý thì giữ khóa cũ (AC-6.4.5)', async () => {
    expect((await put({ provider: 'fake-a', model: 'm-2', version: 0 })).status).toBe(409);
    const r = await put({ provider: 'fake-a', model: 'm-2', enabled: false, version: 1 });
    expect(r.status).toBe(200);
    expect((r.body as any).before).toMatchObject({ model: 'm-1', version: 1 });
    expect((r.body as any).after).toMatchObject({ model: 'm-2', apiKeyLast4: '1234', enabled: false, version: 2 });
    expect(await store.current()).toMatchObject({ apiKey: 'good-key-AAAA1234', enabled: false });
  });

  it('đổi nhà cung cấp mà không nhập khóa mới thì 400 fields.apiKey (A6)', async () => {
    const r = await put({ provider: 'fake-b', model: 'm-1', version: 2 });
    expect(r).toMatchObject({ status: 400, body: { fields: { apiKey: expect.any(String) } } });
    const ok = await put({ provider: 'fake-b', model: 'm-1', apiKey: 'good-key-BBBB5678', version: 2 });
    expect((ok.body as any).after).toMatchObject({ provider: 'fake-b', apiKeyLast4: '5678', version: 3 });
  });

  it('nhà cung cấp không có trong registry, model rỗng, khóa có khoảng trắng thì 400', async () => {
    expect((await put({ provider: 'openai-x', model: 'm', apiKey: 'good-key-1', version: 3 })).status).toBe(400);
    expect((await put({ provider: 'fake-b', model: '', version: 3 })).status).toBe(400);
    expect((await put({ provider: 'fake-b', model: 'm', apiKey: 'good key 123', version: 3 })).status).toBe(400);
  });

  it('tải danh sách model: khóa vừa dán, hoặc khóa đã lưu nếu cùng nhà cung cấp; khóa sai 400 (E8); không phản hồi 503 (E9)', async () => {
    const models = routes['POST /internal/config/models'];
    expect(await models(req, { provider: 'fake-a', apiKey: 'good-key-new-0001' })).toEqual({ status: 200, body: { models: [{ id: 'm-1', name: 'Model 1' }] } });
    expect(await models(req, { provider: 'fake-b' })).toMatchObject({ status: 200 });
    expect(fakeB.keys.at(-1)).toBe('good-key-BBBB5678');
    // Không dùng khóa đã lưu của nhà cung cấp khác.
    expect(await models(req, { provider: 'fake-a' })).toMatchObject({ status: 400, body: { fields: { apiKey: expect.any(String) } } });
    expect(await models(req, { provider: 'fake-a', apiKey: 'wrong-key-0001' })).toMatchObject({ status: 400, body: { fields: { apiKey: 'Khóa không hợp lệ' } } });
    expect(await models(req, { provider: 'fake-a', apiKey: 'slow-key-0001' })).toMatchObject({ status: 503, body: { code: 'HTTP_503' } });
  });

  it('kiểm tra kết nối: lỗi của nhà cung cấp nằm trong error, HTTP vẫn 200 (AC-6.4.2)', async () => {
    const test = routes['POST /internal/config/test'];
    expect(await test(req, { provider: 'fake-b', model: 'm-1' })).toMatchObject({ status: 200, body: { ok: true, latencyMs: expect.any(Number) } });
    expect(await test(req, { provider: 'fake-b', model: 'missing' })).toMatchObject({ status: 200, body: { ok: false, error: { kind: 'bad_request' } } });
    expect(await test(req, { provider: 'fake-a', model: 'm-1', apiKey: 'wrong-key-0001' })).toMatchObject({ body: { ok: false, error: { kind: 'auth' } } });
  });

  it('khóa mã hóa đổi (mất ASSISTANT_CONFIG_KEY) thì current() null, không lỗi', async () => {
    const other = new DbConfigStore(pool, new SecretBox(randomBytes(32).toString('base64')));
    expect(await other.current()).toBeNull();
    expect(await other.view()).toMatchObject({ provider: 'fake-b' });
  });
});
