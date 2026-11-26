import { errorText, log } from '../log';

export interface RetryOptions {
  /** Số lần thử tối đa, tính cả lần đầu. */
  attempts: number;
  /** Chờ trước lần thử lại đầu tiên; mỗi lần sau gấp đôi (1 s, 2 s, 4 s...). */
  delayMs: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Thử lại có giãn cách (NFR-3.5): dịch vụ email lỗi tạm thời (mạng, SES throttling, SMTP 4xx) thì gửi lại sau 1 s, 2 s...
 * Hết số lần thì ném lỗi cuối cùng ra để event vào DLQ, không lặp vô hạn.
 */
export async function withRetry<T>(what: string, fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const sleep = opts.sleep ?? defaultSleep;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= opts.attempts) throw e;
      const waitMs = opts.delayMs * 2 ** (attempt - 1);
      log.warn('Gửi email lỗi, thử lại', { what, attempt, waitMs, error: errorText(e) });
      await sleep(waitMs);
    }
  }
}
