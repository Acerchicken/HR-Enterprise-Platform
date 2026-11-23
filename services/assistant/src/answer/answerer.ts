import { runInput, runOutput } from '../guardrails/guards';
import { log } from '../log';
import { LlmConfigSource } from '../llm/config-source';
import { NOT_FOUND_ANSWER, Passage, SYSTEM_PROMPT } from '../llm/prompt';
import { LlmError, LlmErrorKind } from '../llm/provider';
import { providerOf } from '../llm/providers';
import { Retriever, Scope } from '../rag/retriever';
import { Citation, extractCitations } from './citations';

/**
 * Trả lời một câu hỏi (UC6 spec 4.1, 13.5): G1 → truy hồi trong phạm vi → LLM (G3) → kiểm trích dẫn (A5) → G2.
 * Không lưu câu hỏi, câu trả lời; log chỉ có nhà cung cấp, model, số đoạn, độ trễ, số token, lý do fallback (ADR-16 mục 10).
 */
export interface AnswerResult {
  answer: string;
  citations: Citation[];
  fallback: boolean;
  masked: boolean;
  documents?: Array<{ documentId: string; title: string }>;
}

export type FallbackReason = 'not_configured' | 'disabled' | 'unknown_provider' | LlmErrorKind | 'error' | 'no_citation' | 'prompt_leak';

export const FALLBACK_ANSWER = 'Trợ lý đang bận, đây là các tài liệu liên quan.';

export class Answerer {
  constructor(
    private readonly retriever: Retriever,
    private readonly configs: LlmConfigSource,
    private readonly timeoutMs: number,
  ) {}

  async answer(question: string, scope: Scope, traceId?: string): Promise<AnswerResult> {
    const started = Date.now();
    const input = runInput(question);
    const masked = input.events.some((e) => e.guard === 'G1-pii');
    const meta: Record<string, unknown> = { traceId, guards: input.events };

    const passages = await this.retriever.retrieve(input.question, scope);
    meta.passages = passages.length;
    if (!passages.length) {
      log.info('Trả lời: không tìm thấy đoạn liên quan', { ...meta, ms: Date.now() - started });
      return { answer: NOT_FOUND_ANSWER, citations: [], fallback: false, masked };
    }

    const fallback = (reason: FallbackReason, extra: Record<string, unknown> = {}): AnswerResult => {
      log.warn('Trả lời: fallback', { ...meta, ...extra, reason, ms: Date.now() - started });
      return { answer: FALLBACK_ANSWER, citations: [], fallback: true, masked, documents: documentsOf(passages) };
    };

    const cfg = await this.configs.current();
    if (!cfg) return fallback('not_configured');
    if (!cfg.enabled) return fallback('disabled');
    const entry = providerOf(cfg.provider);
    if (!entry) return fallback('unknown_provider', { provider: cfg.provider });
    Object.assign(meta, { provider: cfg.provider, model: cfg.model });

    let llm;
    try {
      llm = await entry.adapter.answer(
        { system: SYSTEM_PROMPT, question: input.question, passages },
        { model: cfg.model, apiKey: cfg.apiKey, baseUrl: cfg.baseUrl ?? entry.defaultBaseUrl, timeoutMs: this.timeoutMs },
      );
    } catch (e) {
      if (e instanceof LlmError) {
        if (e.kind === 'auth') log.error('LLM_AUTH_FAILED: khóa API của nhà cung cấp sai hoặc hết quyền, ADMIN cần sửa cấu hình', { ...meta, status: e.status });
        return fallback(e.kind, { status: e.status });
      }
      return fallback('error', { error: e instanceof Error ? e.name : 'unknown' });
    }
    meta.usage = llm.usage;

    let text = llm.text;
    let citations: Citation[];
    if (llm.citedPassages) {
      const used = new Set(llm.citedPassages);
      citations = extractCitations(passages.filter((p) => used.has(p.n)).map((p) => `[${p.n}]`).join(''), passages).citations;
    } else {
      ({ answer: text, citations } = extractCitations(text, passages));
    }
    if (!citations.length) {
      // Model nói không tìm thấy (đúng hướng dẫn) thì trả câu chuẩn, không phải lỗi.
      if (/không tìm thấy/i.test(text)) {
        log.info('Trả lời: model báo không tìm thấy', { ...meta, ms: Date.now() - started });
        return { answer: NOT_FOUND_ANSWER, citations: [], fallback: false, masked };
      }
      return fallback('no_citation');
    }

    const out = runOutput({ answer: text, passages: passages.map((p) => `${p.title}\n${p.section}\n${p.content}`), systemPrompt: SYSTEM_PROMPT });
    meta.guards = [...input.events, ...out.events];
    if (out.blocked) return fallback('prompt_leak');
    log.info('Trả lời: xong', { ...meta, citations: citations.length, ms: Date.now() - started });
    return { answer: out.answer, citations, fallback: false, masked };
  }
}

function documentsOf(passages: Passage[]) {
  const seen = new Map<string, string>();
  for (const p of passages) if (!seen.has(p.documentId)) seen.set(p.documentId, p.title);
  return [...seen].map(([documentId, title]) => ({ documentId, title }));
}
