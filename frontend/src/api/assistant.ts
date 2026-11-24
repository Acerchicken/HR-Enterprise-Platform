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
