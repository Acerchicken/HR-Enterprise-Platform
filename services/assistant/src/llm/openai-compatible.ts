import { Passage, userMessage } from './prompt';
import { errorFromStatus, fetchWithTimeout, LlmAnswer, LlmCallOptions, LlmError, LlmModel, LlmProvider, redact } from './provider';

/**
 * Adapter kiểu OpenAI Chat Completions (ADR-16 mục 6): DeepSeek, sau này OpenAI, Groq, Ollama… chỉ khác `baseUrl`.
 * Trích dẫn qua prompt: đoạn bọc `<doc n>` (G3), service đọc `[n]` trong câu trả lời.
 */
export const MAX_OUTPUT_TOKENS = 1024;

export class OpenAiCompatibleProvider implements LlmProvider {
  constructor(private readonly defaultBaseUrl: string) {}

  private url(opts: { baseUrl?: string | null }, path: string) {
    return `${(opts.baseUrl || this.defaultBaseUrl).replace(/\/+$/, '')}${path}`;
  }

  private async post(opts: LlmCallOptions, body: unknown): Promise<any> {
    const res = await fetchWithTimeout(
      this.url(opts, '/chat/completions'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
        body: JSON.stringify(body),
      },
      opts.timeoutMs,
    );
    if (!res.ok) throw errorFromStatus(res.status, redact(await errorDetail(res), opts.apiKey));
    return res.json();
  }

  async answer(input: { system: string; question: string; passages: Passage[] }, opts: LlmCallOptions): Promise<LlmAnswer> {
    const data = await this.post(opts, {
      model: opts.model,
      temperature: 0.1,
      max_tokens: MAX_OUTPUT_TOKENS,
      stream: false,
      messages: [
        { role: 'system', content: input.system },
        { role: 'user', content: userMessage(input.question, input.passages) },
      ],
    });
    const choice = data?.choices?.[0];
    const text = typeof choice?.message?.content === 'string' ? choice.message.content : '';
    if (!text.trim() || choice?.finish_reason === 'content_filter') throw new LlmError('refused', 'Model không trả lời');
    return {
      text,
      citedPassages: null,
      usage: { inputTokens: data?.usage?.prompt_tokens ?? 0, outputTokens: data?.usage?.completion_tokens ?? 0 },
    };
  }

  async listModels(opts: Omit<LlmCallOptions, 'model'>): Promise<LlmModel[]> {
    const res = await fetchWithTimeout(this.url(opts, '/models'), { headers: { Authorization: `Bearer ${opts.apiKey}` } }, opts.timeoutMs);
    if (!res.ok) throw errorFromStatus(res.status, redact(await errorDetail(res), opts.apiKey));
    const data: any = await res.json();
    const items: any[] = Array.isArray(data?.data) ? data.data : [];
    return items
      .filter((m) => typeof m?.id === 'string')
      .map((m) => ({ id: m.id as string, name: m.id as string }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  async testConnection(opts: LlmCallOptions): Promise<void> {
    await this.post(opts, { model: opts.model, max_tokens: 5, messages: [{ role: 'user', content: 'ping' }] });
  }
}

async function errorDetail(res: Response): Promise<string> {
  try {
    const body: any = await res.json();
    return String(body?.error?.message ?? '');
  } catch {
    return '';
  }
}

