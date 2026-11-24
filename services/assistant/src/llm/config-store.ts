import { Pool } from 'pg';
import { errorText, log } from '../log';
import { LlmConfig, LlmConfigSource } from './config-source';
import { providerOf } from './providers';
import { last4, SecretBox } from './secret-box';

/**
 * Cấu hình nhà cung cấp LLM trong bảng `assistant.llm_config` (FR-6.4, UC6 spec 13.4). Chỉ service này đọc, ghi bảng và giữ
 * `ASSISTANT_CONFIG_KEY`; API chỉ thấy bản xem (4 ký tự cuối của khóa), không bao giờ thấy khóa đầy đủ (AC-6.4.4).
 * Mỗi câu hỏi đọc lại dòng cấu hình nên đổi có hiệu lực ngay ở câu kế tiếp (AC-6.4.3).
 */
export interface LlmConfigView {
  provider: string;
  model: string;
  baseUrl: string | null;
  apiKeyLast4: string;
  enabled: boolean;
  version: number;
  updatedBy: string | null;
  updatedAt: string;
}

export interface SaveConfigInput {
  provider: string;
  model: string;
  apiKey?: string;
  enabled: boolean;
  /** `version` đang xem; chưa có cấu hình thì gửi 0. */
  version: number;
  updatedBy: string | null;
}

/** Lỗi trả về cho API: `status` HTTP, `fields` theo quy ước lỗi của dự án (error-codes.md). */
export class ConfigError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const MODEL_PATTERN = /^[\w.:\-/@]{1,100}$/;

export function validApiKey(apiKey: string | undefined): string | undefined {
  if (apiKey === undefined) return undefined;
  const k = apiKey.trim();
  if (k.length < 8 || k.length > 500 || /\s/.test(k)) throw new ConfigError(400, 'BAD_REQUEST', 'API key không hợp lệ', { apiKey: 'API key không hợp lệ' });
  return k;
}

interface Row {
  provider: string;
  model: string;
  base_url: string | null;
  api_key_ciphertext: string;
  api_key_last4: string;
  enabled: boolean;
  version: number;
  updated_by: string | null;
  updated_at: Date;
}

const toView = (r: Row): LlmConfigView => ({
  provider: r.provider,
  model: r.model,
  baseUrl: r.base_url,
  apiKeyLast4: r.api_key_last4,
  enabled: r.enabled,
  version: r.version,
  updatedBy: r.updated_by,
  updatedAt: r.updated_at.toISOString(),
});

const SELECT = `SELECT provider, model, base_url, api_key_ciphertext, api_key_last4, enabled, version, updated_by, updated_at FROM assistant.llm_config WHERE id = 1`;

export class DbConfigStore implements LlmConfigSource {
  constructor(
    private readonly pool: Pool,
    private readonly box: SecretBox,
  ) {}

  async view(): Promise<LlmConfigView | null> {
    const { rows } = await this.pool.query<Row>(SELECT);
    return rows[0] ? toView(rows[0]) : null;
  }

  /** Cho trả lời: giải mã khóa. Giải mã lỗi (đổi `ASSISTANT_CONFIG_KEY`) thì coi như chưa cấu hình, log để ADMIN dán lại khóa. */
  async current(): Promise<LlmConfig | null> {
    const { rows } = await this.pool.query<Row>(SELECT);
    const r = rows[0];
    if (!r) return null;
    try {
      return { provider: r.provider, model: r.model, baseUrl: r.base_url, apiKey: this.box.open(r.api_key_ciphertext, r.provider), enabled: r.enabled };
    } catch (e) {
      log.error('LLM_CONFIG_DECRYPT_FAILED: không giải mã được khóa API đã lưu, ADMIN cần dán lại khóa', { error: errorText(e) });
      return null;
    }
  }

  /** Khóa đã lưu, chỉ khi cùng nhà cung cấp (dùng cho "Tải danh sách model", "Kiểm tra kết nối" khi không dán khóa mới). */
  async storedKeyFor(provider: string): Promise<string | null> {
    const cfg = await this.current();
    return cfg && cfg.provider === provider ? cfg.apiKey : null;
  }

  async save(input: SaveConfigInput): Promise<{ before: LlmConfigView | null; after: LlmConfigView }> {
    if (!providerOf(input.provider)) throw new ConfigError(400, 'BAD_REQUEST', 'Nhà cung cấp không hỗ trợ', { provider: 'Nhà cung cấp không hỗ trợ' });
    if (!MODEL_PATTERN.test(input.model)) throw new ConfigError(400, 'BAD_REQUEST', 'Model không hợp lệ', { model: 'Chọn model' });
    const apiKey = validApiKey(input.apiKey);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query<Row>(`${SELECT} FOR UPDATE`);
      const old = rows[0];
      if ((old?.version ?? 0) !== input.version) throw new ConfigError(409, 'CONFLICT', 'Cấu hình vừa được người khác sửa, tải lại trang');
      // A6: đổi nhà cung cấp (hoặc lưu lần đầu) phải có khóa mới; chỉ đổi model thì giữ khóa cũ (AC-6.4.5).
      if (!apiKey && (!old || old.provider !== input.provider)) {
        throw new ConfigError(400, 'BAD_REQUEST', 'Đổi nhà cung cấp phải nhập API key mới', { apiKey: 'Nhập API key của nhà cung cấp này' });
      }
      const ciphertext = apiKey ? this.box.seal(apiKey, input.provider) : old!.api_key_ciphertext;
      const keyLast4 = apiKey ? last4(apiKey) : old!.api_key_last4;
      const { rows: saved } = await client.query<Row>(
        `INSERT INTO assistant.llm_config (id, provider, model, base_url, api_key_ciphertext, api_key_last4, enabled, version, updated_by, updated_at)
         VALUES (1, $1, $2, NULL, $3, $4, $5, 1, $6, now())
         ON CONFLICT (id) DO UPDATE SET provider = $1, model = $2, base_url = NULL, api_key_ciphertext = $3, api_key_last4 = $4,
           enabled = $5, version = assistant.llm_config.version + 1, updated_by = $6, updated_at = now()
         RETURNING provider, model, base_url, api_key_ciphertext, api_key_last4, enabled, version, updated_by, updated_at`,
        [input.provider, input.model, ciphertext, keyLast4, input.enabled, input.updatedBy],
      );
      await client.query('COMMIT');
      log.info('Đã lưu cấu hình LLM', { provider: input.provider, model: input.model, enabled: input.enabled, newKey: !!apiKey, version: saved[0].version });
      return { before: old ? toView(old) : null, after: toView(saved[0]) };
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  }
}
