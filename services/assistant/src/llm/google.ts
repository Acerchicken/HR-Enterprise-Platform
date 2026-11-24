import { userMessage, Passage } from './prompt';
import { errorFromStatus, fetchWithTimeout, LlmAnswer, LlmCallOptions, LlmError, LlmModel, LlmProvider, redact } from './provider';

/**
 * Adapter Google Gemini qua REST API `generateContent` (ADR-16 mục 6). Trích dẫn qua prompt như DeepSeek: đoạn bọc `<doc n>` (G3),
 * service đọc `[n]`. Khóa gửi ở header `x-goog-api-key`, không để trong URL (không lọt vào log của proxy).
 */
export const GOOGLE_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
/** Gemini 2.5 trở lên tính cả phần suy nghĩ vào giới hạn này, nên để rộng hơn adapter OpenAI. */
export const GOOGLE_MAX_OUTPUT_TOKENS = 2048;

const MODEL_ID = /^[\w.\-]{1,100}$/;

export class GoogleProvider implements LlmProvider {
  constructor(private readonly defaultBaseUrl = GOOGLE_BASE_URL) {}

  private base(opts: { baseUrl?: string | null }) {
    return (opts.baseUrl || this.defaultBaseUrl).replace(/\/+$/, '');
  }

  private async request(opts: { apiKey: string; baseUrl?: string | null; timeoutMs: number }, path: string, body?: unknown): Promise<any> {
    const res = await fetchWithTimeout(
      `${this.base(opts)}${path}`,
      {
        method: body === undefined ? 'GET' : 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.apiKey },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      opts.timeoutMs,
    );
    if (!res.ok) throw await googleError(res, opts.apiKey);
    return res.json();
  }

  private generate(opts: LlmCallOptions, body: unknown) {
    if (!MODEL_ID.test(opts.model)) throw new LlmError('bad_request', 'Tên model không hợp lệ');
    return this.request(opts, `/models/${opts.model}:generateContent`, body);
  }

  async answer(input: { system: string; question: string; passages: Passage[] }, opts: LlmCallOptions): Promise<LlmAnswer> {
    const data = await this.generate(opts, {
      systemInstruction: { parts: [{ text: input.system }] },
      contents: [{ role: 'user', parts: [{ text: userMessage(input.question, input.passages) }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: GOOGLE_MAX_OUTPUT_TOKENS },
    });
    if (data?.promptFeedback?.blockReason) throw new LlmError('refused', `Gemini chặn câu hỏi (${data.promptFeedback.blockReason})`);
    const cand = data?.candidates?.[0];
    const parts: any[] = Array.isArray(cand?.content?.parts) ? cand.content.parts : [];
    // Bỏ phần suy nghĩ (`thought: true`) nếu model trả về.
    const text = parts
      .filter((p) => typeof p?.text === 'string' && !p.thought)
      .map((p) => p.text as string)
      .join('');
    if (['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION'].includes(cand?.finishReason)) {
      throw new LlmError('refused', `Gemini dừng vì ${cand.finishReason}`);
    }
    if (!text.trim()) throw new LlmError('refused', 'Model không trả lời');
    return {
      text,
      citedPassages: null,
      usage: { inputTokens: data?.usageMetadata?.promptTokenCount ?? 0, outputTokens: data?.usageMetadata?.candidatesTokenCount ?? 0 },
    };
  }

  async listModels(opts: Omit<LlmCallOptions, 'model'>): Promise<LlmModel[]> {
    const out: LlmModel[] = [];
    let token = '';
    for (let page = 0; page < 10; page++) {
      const data = await this.request(opts, `/models?pageSize=100${token ? `&pageToken=${encodeURIComponent(token)}` : ''}`);
      for (const m of Array.isArray(data?.models) ? data.models : []) {
        const id = typeof m?.name === 'string' ? m.name.replace(/^models\//, '') : '';
        const methods: unknown[] = Array.isArray(m?.supportedGenerationMethods) ? m.supportedGenerationMethods : [];
        if (id && methods.includes('generateContent')) out.push({ id, name: typeof m.displayName === 'string' ? m.displayName : id });
      }
      token = typeof data?.nextPageToken === 'string' ? data.nextPageToken : '';
      if (!token) break;
    }
    return out.sort((a, b) => a.id.localeCompare(b.id));
  }

  async testConnection(opts: LlmCallOptions): Promise<void> {
    await this.generate(opts, { contents: [{ role: 'user', parts: [{ text: 'ping' }] }], generationConfig: { maxOutputTokens: 16 } });
  }
}

/** Gemini trả 400 `API_KEY_INVALID` khi khóa sai (không phải 401), nên đọc thêm `reason`. */
async function googleError(res: Response, apiKey: string): Promise<LlmError> {
  let message = '';
  let invalidKey = false;
  try {
    const body: any = await res.json();
    message = String(body?.error?.message ?? '');
    const details: any[] = Array.isArray(body?.error?.details) ? body.error.details : [];
    invalidKey = details.some((d) => d?.reason === 'API_KEY_INVALID');
  } catch {
    /* body không phải JSON */
  }
  if (invalidKey) return new LlmError('auth', `Khóa không hợp lệ (${res.status})`, res.status);
  return errorFromStatus(res.status, redact(message, apiKey));
}
