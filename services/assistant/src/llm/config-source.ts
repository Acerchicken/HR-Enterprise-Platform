/**
 * Nơi lấy cấu hình nhà cung cấp đang dùng: `DbConfigStore` (bảng `assistant.llm_config`, ADMIN cấu hình trên `/admin/assistant`,
 * khóa mã hóa, FR-6.4). `StaticConfigSource` chỉ cho test.
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

export class StaticConfigSource implements LlmConfigSource {
  constructor(public config: LlmConfig | null) {}
  async current() {
    return this.config;
  }
}
