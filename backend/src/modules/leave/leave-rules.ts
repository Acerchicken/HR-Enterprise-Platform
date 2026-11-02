/**
 * Business rule của đơn nghỉ phép dạng hàm thuần (docs/business/leave-rules.md).
 * Ngày luôn ở dạng chuỗi 'YYYY-MM-DD' theo lịch, không dính múi giờ.
 */
export type HalfDay = 'AM' | 'PM';

export interface LeavePeriod {
  startDate: string;
  endDate: string;
  halfDay: HalfDay | null;
}

/** Chuỗi 'YYYY-MM-DD' là một ngày có thật (loại 2026-02-30). */
export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Ngày làm việc: không phải thứ Bảy, Chủ nhật hay ngày nghỉ lễ (BR-03). */
export function isWorkingDay(date: string, holidays: ReadonlySet<string>): boolean {
  const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
  return wd !== 0 && wd !== 6 && !holidays.has(date);
}

/**
 * Số ngày nghỉ của đơn (BR-03, BR-04): đếm ngày làm việc, tính cả hai đầu; nửa ngày tính 0,5.
 * Trả 0 khi khoảng ngày không hợp lệ hoặc không có ngày làm việc nào – tầng gọi phải từ chối đơn 0 ngày.
 */
export function leaveDays(p: LeavePeriod, holidays: ReadonlySet<string>): number {
  if (!isValidDate(p.startDate) || !isValidDate(p.endDate) || p.endDate < p.startDate) return 0;
  if (p.halfDay) {
    if (p.startDate !== p.endDate) return 0;
    return isWorkingDay(p.startDate, holidays) ? 0.5 : 0;
  }
  let count = 0;
  const end = new Date(`${p.endDate}T00:00:00Z`);
  for (const d = new Date(`${p.startDate}T00:00:00Z`); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    if (isWorkingDay(d.toISOString().slice(0, 10), holidays)) count++;
  }
  return count;
}

/**
 * Hai đơn có trùng lịch không (BR-02). Có chung một ngày là trùng,
 * trừ khi cả hai là nửa ngày khác buổi trong cùng một ngày (BR-04).
 */
export function overlaps(a: LeavePeriod, b: LeavePeriod): boolean {
  if (a.endDate < b.startDate || b.endDate < a.startDate) return false;
  if (a.halfDay && b.halfDay && a.halfDay !== b.halfDay) return false;
  return true;
}

/** Số dư khả dụng = entitled - used - pending (BR-01). */
export function availableDays(b: { entitled: number; used: number; pending: number }): number {
  return b.entitled - b.used - b.pending;
}
