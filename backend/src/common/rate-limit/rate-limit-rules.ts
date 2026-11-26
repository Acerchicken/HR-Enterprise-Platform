/**
 * Ngưỡng giới hạn tần suất theo nhóm thao tác (SRS NFR-5.21, UC1 spec mục 7 "Giới hạn tần suất và hạn mức").
 * Tính theo từng người dùng, áp dụng cả với HR. Một request có thể thuộc nhiều nhóm: luôn thuộc `global`, cộng nhóm riêng của
 * endpoint (ví dụ `profile-write`).
 */
export type RateWindow = 'minute' | 'hour' | 'day';

export const WINDOW_MS: Record<RateWindow, number> = { minute: 60_000, hour: 3_600_000, day: 86_400_000 };

export const RATE_GROUPS = {
  global: { label: 'request', limits: { minute: 100 } },
  search: { label: 'lượt tìm kiếm', limits: { minute: 20 } },
  'profile-write': { label: 'lệnh ghi hồ sơ', limits: { minute: 30, day: 300 } },
  'profile-upload': { label: 'lượt xin URL tải lên', limits: { hour: 10, day: 30 } },
  'avatar-upload': { label: 'lần đổi ảnh đại diện', limits: { day: 5 } },
  'profile-download': { label: 'lượt tải file hồ sơ', limits: { hour: 60 } },
  'sensitive-view': { label: 'lượt xem thông tin nhạy cảm', limits: { hour: 100 } },
  assistant: { label: 'câu hỏi trợ lý', limits: { minute: 10, day: 100 } },
  'assistant-config': { label: 'lượt gọi thử nhà cung cấp AI', limits: { hour: 20 } },
} as const satisfies Record<string, { label: string; limits: Partial<Record<RateWindow, number>> }>;

export type RateGroup = keyof typeof RATE_GROUPS;

const WINDOW_LABEL: Record<RateWindow, string> = { minute: 'mỗi phút', hour: 'mỗi giờ', day: 'mỗi ngày' };

/** Ngưỡng thực tế sau khi áp `RATE_LIMIT_OVERRIDES`. */
export function limitsOf(group: RateGroup, overrides: Record<string, Partial<Record<RateWindow, number>>> = {}) {
  return { ...(RATE_GROUPS[group].limits as Partial<Record<RateWindow, number>>), ...(overrides[group] ?? {}) };
}

/** Đầu cửa sổ cố định chứa thời điểm `now`. */
export function windowStart(now: number, window: RateWindow): number {
  return now - (now % WINDOW_MS[window]);
}

/** Số giây tới khi cửa sổ mở lại (header `Retry-After`), tối thiểu 1. */
export function retryAfterSeconds(now: number, window: RateWindow): number {
  return Math.max(1, Math.ceil((windowStart(now, window) + WINDOW_MS[window] - now) / 1000));
}

/** Câu báo nêu đúng giới hạn bị vượt (AC-1.14.7). */
export function limitMessage(group: RateGroup, window: RateWindow, limit: number, retryAfter: number): string {
  return `Bạn thao tác quá nhanh: tối đa ${limit} ${RATE_GROUPS[group].label} ${WINDOW_LABEL[window]}. Thử lại sau ${retryAfter} giây.`;
}
