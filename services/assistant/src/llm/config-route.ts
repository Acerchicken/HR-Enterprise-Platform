import { IncomingMessage } from 'http';
import { checkToken } from '../answer/route';
import { log } from '../log';
import { ConfigError, DbConfigStore, MODEL_PATTERN, validApiKey } from './config-store';
import { LlmError } from './provider';
import { PROVIDERS, providerOf, ProviderEntry } from './providers';

/**
 * HTTP nội bộ cho cấu hình nhà cung cấp LLM (FR-6.4, UC6 spec 9.2). Chỉ API gọi (token nội bộ); API kiểm quyền ADMIN và ghi audit.
 *
 * - `GET  /internal/config`        → `{ config, providers }`
 * - `PUT  /internal/config`        → `{ before, after }` (API dùng để ghi audit model cũ, mới)
 * - `POST /internal/config/models` → `{ models }`; khóa sai 400 `fields.apiKey` (E8); nhà cung cấp không phản hồi 503 (E9)
 * - `POST /internal/config/test`   → `{ ok, latencyMs, error? }`; lỗi của nhà cung cấp nằm trong `error`, HTTP vẫn 200
 */
type Result = { status: number; body: unknown };
type Handler = (req: IncomingMessage, body: unknown) => Promise<Result>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Thông báo dễ hiểu cho ADMIN theo loại lỗi (AC-6.4.2). */
export const LLM_ERROR_TEXT: Record<LlmError['kind'], string> = {
  auth: 'Khóa không hợp lệ hoặc không có quyền',
  timeout: 'Quá thời gian chờ nhà cung cấp trả lời',
  rate_limit: 'Hết hạn mức hoặc hết số dư ở nhà cung cấp',
  bad_request: 'Nhà cung cấp từ chối yêu cầu (model không tồn tại hoặc không dùng được)',
  unavailable: 'Nhà cung cấp AI không phản hồi, thử lại sau',
  refused: 'Model không trả lời',
};

export const providerList = () => [...PROVIDERS.values()].map((p) => ({ id: p.id, name: p.name, dataRegion: p.dataRegion }));

function guard(token: string, fn: Handler): Handler {
  return async (req, body) => {
    if (!checkToken(req, token)) return { status: 401, body: { code: 'UNAUTHENTICATED', message: 'Thiếu hoặc sai token nội bộ' } };
    try {
      return await fn(req, body);
    } catch (e) {
      if (e instanceof ConfigError) return { status: e.status, body: { code: e.code, message: e.message, ...(e.fields ? { fields: e.fields } : {}) } };
      throw e;
    }
  };
}

const obj = (body: unknown): Record<string, unknown> => (body && typeof body === 'object' ? (body as Record<string, unknown>) : {});

function providerParam(b: Record<string, unknown>): ProviderEntry {
  const entry = typeof b.provider === 'string' ? providerOf(b.provider) : undefined;
  if (!entry) throw new ConfigError(400, 'BAD_REQUEST', 'Nhà cung cấp không hỗ trợ', { provider: 'Chọn nhà cung cấp' });
  return entry;
}

function optionalKey(b: Record<string, unknown>): string | undefined {
  if (b.apiKey === undefined || b.apiKey === null || b.apiKey === '') return undefined;
  if (typeof b.apiKey !== 'string') throw new ConfigError(400, 'BAD_REQUEST', 'API key không hợp lệ', { apiKey: 'API key không hợp lệ' });
  return validApiKey(b.apiKey);
}

/** Khóa vừa dán, hoặc khóa đã lưu nếu cùng nhà cung cấp; không có thì 400. */
async function keyFor(store: DbConfigStore, entry: ProviderEntry, b: Record<string, unknown>): Promise<string> {
  const key = optionalKey(b) ?? (await store.storedKeyFor(entry.id));
  if (!key) throw new ConfigError(400, 'BAD_REQUEST', 'Nhập API key', { apiKey: 'Nhập API key của nhà cung cấp này' });
  return key;
}

export function configRoutes(store: DbConfigStore, token: string, timeoutMs: number): Record<string, Handler> {
  return {
    'GET /internal/config': guard(token, async () => ({ status: 200, body: { config: await store.view(), providers: providerList() } })),

    'PUT /internal/config': guard(token, async (_req, body) => {
      const b = obj(body);
      const entry = providerParam(b);
      if (typeof b.model !== 'string' || !MODEL_PATTERN.test(b.model)) throw new ConfigError(400, 'BAD_REQUEST', 'Model không hợp lệ', { model: 'Chọn model' });
      if (typeof b.enabled !== 'boolean') throw new ConfigError(400, 'BAD_REQUEST', 'enabled phải là true hoặc false', { enabled: 'Bắt buộc' });
      if (!Number.isInteger(b.version) || (b.version as number) < 0) throw new ConfigError(400, 'BAD_REQUEST', 'version không hợp lệ', { version: 'Bắt buộc' });
      const updatedBy = typeof b.updatedBy === 'string' && UUID.test(b.updatedBy) ? b.updatedBy : null;
      const r = await store.save({ provider: entry.id, model: b.model, apiKey: optionalKey(b), enabled: b.enabled, version: b.version as number, updatedBy });
      return { status: 200, body: r };
    }),

    'POST /internal/config/models': guard(token, async (_req, body) => {
      const b = obj(body);
      const entry = providerParam(b);
      const apiKey = await keyFor(store, entry, b);
      try {
        const models = await entry.adapter.listModels({ apiKey, baseUrl: entry.defaultBaseUrl, timeoutMs });
        return { status: 200, body: { models } };
      } catch (e) {
        if (!(e instanceof LlmError)) throw e;
        log.warn('Tải danh sách model lỗi', { provider: entry.id, kind: e.kind, status: e.status });
        if (e.kind === 'auth') throw new ConfigError(400, 'BAD_REQUEST', 'Khóa không hợp lệ', { apiKey: 'Khóa không hợp lệ' });
        if (e.kind === 'bad_request') throw new ConfigError(400, 'BAD_REQUEST', LLM_ERROR_TEXT.bad_request);
        throw new ConfigError(503, 'HTTP_503', LLM_ERROR_TEXT[e.kind]);
      }
    }),

    'POST /internal/config/test': guard(token, async (_req, body) => {
      const b = obj(body);
      const entry = providerParam(b);
      if (typeof b.model !== 'string' || !MODEL_PATTERN.test(b.model)) throw new ConfigError(400, 'BAD_REQUEST', 'Model không hợp lệ', { model: 'Chọn model' });
      const apiKey = await keyFor(store, entry, b);
      const started = Date.now();
      try {
        await entry.adapter.testConnection({ model: b.model, apiKey, baseUrl: entry.defaultBaseUrl, timeoutMs });
        return { status: 200, body: { ok: true, latencyMs: Date.now() - started } };
      } catch (e) {
        if (!(e instanceof LlmError)) throw e;
        log.warn('Kiểm tra kết nối LLM lỗi', { provider: entry.id, model: b.model, kind: e.kind, status: e.status });
        return { status: 200, body: { ok: false, latencyMs: Date.now() - started, error: { kind: e.kind, message: LLM_ERROR_TEXT[e.kind] } } };
      }
    }),
  };
}
