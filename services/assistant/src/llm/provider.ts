import { Passage } from './prompt';

/**
 * Giao diện nhà cung cấp LLM (ADR-16 mục 6). Mỗi nhà cung cấp một adapter, đăng ký ở `providers.ts`. Adapter không tự thử lại
 * (NFR-3.5 áp dụng cho việc chạy nền), không log nội dung, không đưa khóa vào thông báo lỗi.
 */
export interface LlmCallOptions {
  model: string;
  apiKey: string;
  baseUrl?: string | null;
  timeoutMs: number;
}

export interface LlmAnswer {
  text: string;
  /**
   * Trích dẫn có cấu trúc (adapter `anthropic`): số đoạn đã dùng. `null` nghĩa là trích dẫn qua prompt, service tự đọc `[n]`.
   */
  citedPassages: number[] | null;
  usage: { inputTokens: number; outputTokens: number };
}

export interface LlmModel {
  id: string;
  name: string;
}

export interface LlmProvider {
  answer(input: { system: string; question: string; passages: Passage[] }, opts: LlmCallOptions): Promise<LlmAnswer>;
  listModels(opts: Omit<LlmCallOptions, 'model'>): Promise<LlmModel[]>;
  testConnection(opts: LlmCallOptions): Promise<void>;
}

/** Lỗi gọi nhà cung cấp, đã phân loại để chọn lý do fallback và thông báo (không chứa khóa). */
export type LlmErrorKind = 'auth' | 'timeout' | 'rate_limit' | 'bad_request' | 'unavailable' | 'refused';

export class LlmError extends Error {
  constructor(
    readonly kind: LlmErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export function errorFromStatus(status: number, detail = ''): LlmError {
  const tail = detail ? `: ${detail.slice(0, 200)}` : '';
  if (status === 401 || status === 403) return new LlmError('auth', `Khóa không hợp lệ hoặc không có quyền (${status})`, status);
  if (status === 429) return new LlmError('rate_limit', `Nhà cung cấp từ chối vì quá hạn mức (429)${tail}`, status);
  if (status === 402) return new LlmError('rate_limit', 'Tài khoản nhà cung cấp hết số dư (402)', status);
  if (status >= 400 && status < 500) return new LlmError('bad_request', `Nhà cung cấp trả lỗi ${status}${tail}`, status);
  return new LlmError('unavailable', `Nhà cung cấp không phản hồi đúng (${status})`, status);
}

/** fetch có timeout; hết giờ thì ném LlmError('timeout'). */
export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } catch (e) {
    if (ctl.signal.aborted) throw new LlmError('timeout', `Quá ${timeoutMs} ms không có phản hồi`);
    throw new LlmError('unavailable', 'Không kết nối được tới nhà cung cấp');
  } finally {
    clearTimeout(timer);
  }
}

/** Gỡ khóa khỏi chuỗi lỗi phòng khi nhà cung cấp lặp lại nó. */
export const redact = (s: string, apiKey: string) => (apiKey ? s.split(apiKey).join('***') : s);
