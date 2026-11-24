import { cleanText } from '../ingest/text';
import { digits, maskPii, PiiHit } from './pii';

/**
 * Guardrail G1 → G4 (ADR-16 mục 11, UC6 spec 13.5). Mỗi lớp là một hàm thuần; `INPUT_GUARDS`, `OUTPUT_GUARDS` chạy theo thứ
 * tự. Thêm lớp mới = thêm một hàm vào danh sách. Kết quả mỗi lớp chỉ có tên, hành động, số chỗ để log (không có nội dung).
 */
export interface GuardEvent {
  guard: string;
  action: 'mask' | 'block' | 'clean';
  count: number;
}

export interface InputState {
  question: string;
  events: GuardEvent[];
}

export interface OutputState {
  answer: string;
  /** Nội dung các đoạn đã gửi LLM, để biết số điện thoại, email nào có trong tài liệu. */
  passages: string[];
  systemPrompt: string;
  blocked: boolean;
  events: GuardEvent[];
}

export type InputGuard = (s: InputState) => InputState;
export type OutputGuard = (s: OutputState) => OutputState;

/** G3 (phần câu hỏi): bỏ ký tự vô hình, điều khiển. */
export const stripInvisible: InputGuard = (s) => {
  const question = cleanText(s.question);
  return question === s.question.trim() ? s : { question, events: [...s.events, { guard: 'G3-invisible', action: 'clean', count: 1 }] };
};

/** G1: che số điện thoại, email, dãy số dài trong câu hỏi. */
export const maskQuestionPii: InputGuard = (s) => {
  const { text, count } = maskPii(s.question);
  return count ? { question: text, events: [...s.events, { guard: 'G1-pii', action: 'mask', count }] } : s;
};

export const INPUT_GUARDS: InputGuard[] = [stripInvisible, maskQuestionPii];

/** G2a: che dữ liệu cá nhân trong câu trả lời nếu không có trong các đoạn đã gửi (số hotline HR trong tài liệu thì giữ). */
export const maskAnswerPii: OutputGuard = (s) => {
  const source = s.passages.join('\n');
  const sourceDigits = digits(source);
  const sourceLower = source.toLowerCase();
  const inSource = (h: PiiHit) => (h.kind === 'email' ? sourceLower.includes(h.value.toLowerCase()) : sourceDigits.includes(digits(h.value)));
  const { text, count } = maskPii(s.answer, inSource);
  return count ? { ...s, answer: text, events: [...s.events, { guard: 'G2-pii', action: 'mask', count }] } : s;
};

/** Số ký tự liên tiếp trùng system prompt thì coi là lộ prompt. */
export const PROMPT_LEAK_CHARS = 40;

/** G2b: câu trả lời chứa một đoạn từ 40 ký tự trở lên trùng system prompt thì chặn. */
export const blockPromptLeak: OutputGuard = (s) => {
  const norm = (x: string) => x.toLowerCase().replace(/\s+/g, ' ');
  const prompt = norm(s.systemPrompt);
  const answer = norm(s.answer);
  for (let i = 0; i + PROMPT_LEAK_CHARS <= prompt.length; i++) {
    if (answer.includes(prompt.slice(i, i + PROMPT_LEAK_CHARS))) {
      return { ...s, blocked: true, events: [...s.events, { guard: 'G2-prompt-leak', action: 'block', count: 1 }] };
    }
  }
  return s;
};

export const OUTPUT_GUARDS: OutputGuard[] = [maskAnswerPii, blockPromptLeak];

export function runInput(question: string, guards = INPUT_GUARDS): InputState {
  return guards.reduce((s, g) => g(s), { question, events: [] } as InputState);
}

export function runOutput(init: Omit<OutputState, 'blocked' | 'events'>, guards = OUTPUT_GUARDS): OutputState {
  return guards.reduce((s, g) => (s.blocked ? s : g(s)), { ...init, blocked: false, events: [] } as OutputState);
}
