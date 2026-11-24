import { OpenAiCompatibleProvider } from './openai-compatible';
import { LlmProvider } from './provider';

/**
 * Registry nhà cung cấp LLM (ADR-16 mục 6, UC6 spec 13.4). Thêm nhà cung cấp tương thích OpenAI = thêm một mục với `baseUrl`;
 * nhà cung cấp có API riêng = một file adapter cài `LlmProvider` rồi thêm mục. Không sửa truy hồi, API hay giao diện.
 */
export interface ProviderEntry {
  id: string;
  name: string;
  /** Nước nhận dữ liệu, hiện trên trang cấu hình (NFR-11.1). */
  dataRegion: string;
  defaultBaseUrl: string | null;
  adapter: LlmProvider;
}

const ENTRIES: ProviderEntry[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    dataRegion: 'Trung Quốc',
    defaultBaseUrl: 'https://api.deepseek.com',
    adapter: new OpenAiCompatibleProvider('https://api.deepseek.com'),
  },
];

export const PROVIDERS = new Map(ENTRIES.map((e) => [e.id, e]));

export function providerOf(id: string): ProviderEntry | undefined {
  return PROVIDERS.get(id);
}

/** Chỉ cho test: thêm nhà cung cấp giả. */
export function registerProvider(entry: ProviderEntry): void {
  PROVIDERS.set(entry.id, entry);
}
