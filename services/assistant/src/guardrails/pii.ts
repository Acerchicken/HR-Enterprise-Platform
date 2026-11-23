/**
 * G1, G2 (ADR-16 mục 11): nhận diện dữ liệu cá nhân trong chữ. Hàm thuần, không log giá trị.
 * - Số điện thoại Việt Nam: `0` hoặc `+84`/`84` rồi 9 chữ số, cho phép dấu cách, chấm, gạch giữa các nhóm.
 * - Email.
 * - Mọi dãy từ 8 chữ số trở lên sau khi bỏ dấu cách, chấm, gạch (CCCD 12 số, CMND 9 số, số tài khoản, mã số thuế).
 * Ngày "01/12/2026", "Điều 115", "12 ngày" không bị che (dấu `/` ngắt dãy số, và ít hơn 8 chữ số).
 */
export const MASK = '[đã ẩn]';

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE = /(?<![\p{L}\p{N}])(?:\+?84|0)(?:[ .-]?\d){9}(?![\p{N}])/gu;
/** Dãy chữ số có thể chen dấu cách, chấm, gạch; giữ lại nếu ít hơn 8 chữ số. */
const DIGIT_RUN = /(?<![\p{L}\p{N}])\d(?:[ .-]?\d)+(?![\p{N}])/gu;

export interface PiiHit {
  kind: 'email' | 'phone' | 'number';
  value: string;
}

/** Tìm các chỗ là dữ liệu cá nhân, theo thứ tự email → điện thoại → dãy số dài. */
export function findPii(text: string): PiiHit[] {
  const hits: PiiHit[] = [];
  let rest = text;
  for (const m of rest.match(EMAIL) ?? []) hits.push({ kind: 'email', value: m });
  rest = rest.replace(EMAIL, ' ');
  for (const m of rest.match(PHONE) ?? []) hits.push({ kind: 'phone', value: m });
  rest = rest.replace(PHONE, ' ');
  for (const m of rest.match(DIGIT_RUN) ?? []) if (digits(m).length >= 8) hits.push({ kind: 'number', value: m });
  return hits;
}

export const digits = (s: string) => s.replace(/\D/g, '');

/** Che các chỗ `keep(hit)` trả false. Trả chữ đã che và số chỗ che. */
export function maskPii(text: string, keep: (h: PiiHit) => boolean = () => false): { text: string; count: number } {
  let count = 0;
  const replace = (kind: PiiHit['kind']) => (m: string) => {
    if (kind === 'number' && digits(m).length < 8) return m;
    if (keep({ kind, value: m })) return m;
    count++;
    return MASK;
  };
  const out = text.replace(EMAIL, replace('email')).replace(PHONE, replace('phone')).replace(DIGIT_RUN, replace('number'));
  return { text: out, count };
}
