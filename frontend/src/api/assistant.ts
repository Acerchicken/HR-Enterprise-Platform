import { api } from './client';

/** Trợ lý chính sách (UC6 FR-6.3, spec 9.2). Không lưu câu hỏi ở đâu cả, kể cả localStorage (frontend.md mục 6). */
export interface AssistantCitation {
  n: number;
  documentId: string;
  versionNo: number;
  title: string;
  section: string;
  citedText: string;
}

export interface AssistantAnswer {
  answer: string;
  citations: AssistantCitation[];
  fallback: boolean;
  masked: boolean;
  documents?: Array<{ documentId: string; title: string }>;
}

export const assistantApi = {
  ask: (question: string) => api<AssistantAnswer>('/assistant/questions', { method: 'POST', body: JSON.stringify({ question }) }),
};

/** Cấu hình nhà cung cấp AI (UC6 FR-6.4), chỉ ADMIN. Khóa API chỉ gửi đi, không bao giờ nhận về (AC-6.4.4). */
export interface AssistantProvider {
  id: string;
  name: string;
  dataRegion: string;
}

export interface AssistantConfig {
  provider: string | null;
  model: string | null;
  apiKeyLast4: string | null;
  enabled: boolean;
  version: number;
  updatedBy: string | null;
  updatedByName: string | null;
  updatedAt: string | null;
  providers: AssistantProvider[];
}

export interface AssistantModel {
  id: string;
  name: string;
}

export interface ConnectionTest {
  ok: boolean;
  latencyMs: number;
  error?: { kind: string; message: string };
}

export interface SaveAssistantConfig {
  provider: string;
  model: string;
  /** Bỏ trống: giữ khóa đã lưu (chỉ khi không đổi nhà cung cấp). */
  apiKey?: string;
  enabled: boolean;
  version: number;
}

export const assistantConfigApi = {
  get: () => api<AssistantConfig>('/admin/assistant-config'),
  save: (body: SaveAssistantConfig) => api<AssistantConfig>('/admin/assistant-config', { method: 'PUT', body: JSON.stringify(body) }),
  models: (provider: string, apiKey?: string) =>
    api<{ models: AssistantModel[] }>('/admin/assistant-config/models', { method: 'POST', body: JSON.stringify({ provider, apiKey }) }),
  test: (provider: string, model: string, apiKey?: string) =>
    api<ConnectionTest>('/admin/assistant-config/test', { method: 'POST', body: JSON.stringify({ provider, model, apiKey }) }),
};
