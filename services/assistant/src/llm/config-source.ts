/**
 * Nơi lấy cấu hình nhà cung cấp đang dùng. `feat/assistant-config` thay bằng bảng `assistant.llm_config` (ADMIN cấu hình trên
 * `/admin/assistant`, khóa mã hóa). Trước đó dùng biến môi trường, **chỉ cho local và thử nghiệm**.
 */
export interface LlmConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string | null;
  enabled: boolean;
}

export interface LlmConfigSource {
  current(): Promise<LlmConfig | null>;
}

export class EnvConfigSource implements LlmConfigSource {
  constructor(private readonly env: NodeJS.ProcessEnv = process.env) {}

  async current(): Promise<LlmConfig | null> {
    const { ASSISTANT_LLM_PROVIDER: provider, ASSISTANT_LLM_MODEL: model, ASSISTANT_LLM_API_KEY: apiKey } = this.env;
    if (!provider || !model || !apiKey) return null;
    return { provider, model, apiKey, baseUrl: this.env.ASSISTANT_LLM_BASE_URL || null, enabled: true };
  }
}

export class StaticConfigSource implements LlmConfigSource {
  constructor(public config: LlmConfig | null) {}
  async current() {
    return this.config;
  }
}
