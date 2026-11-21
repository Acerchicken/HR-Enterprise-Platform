/**
 * Business rule của đơn nghỉ phép dạng hàm thuần (docs/business/leave-rules.md, UC3 spec 13.2 → 13.4, UC4 13.5).
 * Ngày luôn ở dạng chuỗi 'YYYY-MM-DD' theo lịch, không dính múi giờ; "hôm nay" do tầng gọi đưa vào theo giờ Việt Nam.
 */
export type HalfDay = 'AM' | 'PM';
export type QuotaKind = 'ACCRUED' | 'YEARLY' | 'PER_EVENT';
export type HrApproval = 'NEVER' | 'ALWAYS' | 'OVER_DAYS';

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

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function addMonths(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  const t = new Date(Date.UTC(y, m - 1 + n, Math.min(d, last)));
  return t.toISOString().slice(0, 10);
}

/** Ngày làm việc: không phải thứ Bảy, Chủ nhật hay ngày nghỉ lễ, nghỉ bù (BR-03). */
export function isWorkingDay(date: string, holidays: ReadonlySet<string>): boolean {
  const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
  return wd !== 0 && wd !== 6 && !holidays.has(date);
}

/** Số ngày làm việc trong [from, to], tính cả hai đầu. */
export function workingDaysBetween(from: string, to: string, holidays: ReadonlySet<string>): number {
  let count = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) if (isWorkingDay(d, holidays)) count++;
  return count;
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
  return workingDaysBetween(p.startDate, p.endDate, holidays);
}

/** Số ngày của đơn theo từng năm lịch (A5, AC-3.2.4); năm không có ngày làm việc nào thì bỏ. */
export function allocateByYear(p: LeavePeriod, holidays: ReadonlySet<string>): { year: number; days: number }[] {
  const out: { year: number; days: number }[] = [];
  const y1 = Number(p.startDate.slice(0, 4));
  const y2 = Number(p.endDate.slice(0, 4));
  for (let y = y1; y <= y2; y++) {
    const from = y === y1 ? p.startDate : `${y}-01-01`;
    const to = y === y2 ? p.endDate : `${y}-12-31`;
    const days = leaveDays({ startDate: from, endDate: to, halfDay: p.halfDay }, holidays);
    if (days > 0) out.push({ year: y, days });
  }
  return out;
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

export interface BalanceAmounts {
  entitled: number;
  carriedIn: number;
  used: number;
  pending: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Số dư khả dụng = được hưởng + chuyển từ năm trước − đã dùng − đang chờ (BR-01, AC-3.1.8). */
export function availableDays(b: BalanceAmounts): number {
  return r2(b.entitled + b.carriedIn - b.used - b.pending);
}

/**
 * Số ngày phép năm chuyển sang năm sau (BR-01, chốt 21/11/2026): chỉ phần được hưởng của chính năm N còn lại; đơn trừ phần
 * chuyển sang trước nên phần chuyển sang không dùng hết thì hết hạn, không chuyển lần hai.
 */
export function carryOver(prev: BalanceAmounts): number {
  const fromOwn = Math.max(0, prev.used + prev.pending - prev.carriedIn);
  return r2(Math.max(0, prev.entitled - fromOwn));
}

/** Làm tròn lên 2 chữ số (BR-01 không làm tròn giảm). Trừ sai số dấu phẩy động trước khi làm tròn. */
export function ceil2(n: number): number {
  return Math.ceil(Math.round(n * 1e6) / 1e4) / 100;
}

export interface AnnualInput {
  year: number;
  hireDate: string;
  /** Ngày làm việc cuối cùng nếu đã nghỉ việc. */
  terminationDate: string | null;
  /** Mức nền 12, 14, 16 (FR-3.8); null là 12. */
  baseDays: number | null;
  /** Số ngày cộng theo thâm niên tính ở 31/12 của năm (UC1 `seniority()`, 13.2 (b)). */
  seniorityBonus: number;
  holidays: ReadonlySet<string>;
  /** Ngày nghỉ không lương đã duyệt, hoàn tất (từng ngày làm việc; nửa ngày tính 0,5), 13.2 (a). */
  unpaidDays: ReadonlyMap<string, number>;
}

/**
 * Phép năm được hưởng của một năm (BR-01, UC3 13.2, AC-3.1.3): đủ 12 tháng thì nền + thâm niên; ngược lại
 * (nền + thâm niên) / 12 × số tháng làm việc thực tế, làm tròn lên 2 chữ số. Tháng làm không trọn được tính khi
 * (ngày làm việc của người đó trong tháng − ngày không lương đã duyệt) ≥ 50% ngày làm việc của tháng.
 */
export function annualEntitlement(i: AnnualInput): number {
  const full = (i.baseDays ?? 12) + i.seniorityBonus;
  const from = i.hireDate > `${i.year}-01-01` ? i.hireDate : `${i.year}-01-01`;
  const end = i.terminationDate && i.terminationDate < `${i.year}-12-31` ? i.terminationDate : `${i.year}-12-31`;
  if (from > end) return 0;
  let months = 0;
  for (let m = 1; m <= 12; m++) {
    const mStart = `${i.year}-${String(m).padStart(2, '0')}-01`;
    const mEnd = addDays(addMonths(mStart, 1), -1);
    const a = from > mStart ? from : mStart;
    const b = end < mEnd ? end : mEnd;
    if (a > b) continue;
    const normal = workingDaysBetween(mStart, mEnd, i.holidays);
    let worked = 0;
    for (let d = a; d <= b; d = addDays(d, 1)) {
      if (isWorkingDay(d, i.holidays)) worked += 1 - (i.unpaidDays.get(d) ?? 0);
    }
    const whole = a === mStart && b === mEnd;
    const unpaidInMonth = [...i.unpaidDays.entries()].some(([d, v]) => d >= mStart && d <= mEnd && v > 0);
    if ((whole && !unpaidInMonth) || (normal > 0 && worked * 2 >= normal)) months++;
  }
  return months === 12 ? full : ceil2((full / 12) * months);
}

/** Loại phép cần HR duyệt thêm cho đơn này (BR-16): chụp lúc gửi; đơn của CEO không có bước HR thứ hai. */
export function needsHrApproval(t: { hrApproval: HrApproval; hrApprovalMinDays: number | null }, days: number, ownerIsCeo: boolean): boolean {
  if (ownerIsCeo) return false;
  if (t.hrApproval === 'ALWAYS') return true;
  return t.hrApproval === 'OVER_DAYS' && days > (t.hrApprovalMinDays ?? 0);
}

export interface EventLimits {
  maxDaysPerEvent: number | null;
  maxMonthsPerEvent: number | null;
}

/** Đơn nghỉ theo sự kiện vượt mức (AC-3.1.4): số ngày làm việc hoặc (thai sản) số tháng tính từ ngày bắt đầu. */
export function exceedsEventLimit(t: EventLimits, p: LeavePeriod, days: number): boolean {
  if (t.maxDaysPerEvent != null && days > t.maxDaysPerEvent) return true;
  if (t.maxMonthsPerEvent != null && p.endDate > addDays(addMonths(p.startDate, t.maxMonthsPerEvent), -1)) return true;
  return false;
}

/** `eventDate` không quá 1 năm trước hoặc sau ngày bắt đầu (UC3 mục 8). */
export function eventDateInRange(eventDate: string, startDate: string): boolean {
  return eventDate >= addMonths(startDate, -12) && eventDate <= addMonths(startDate, 12);
}

/** HR hoàn tất được từ ngày kế tiếp `endDate` theo giờ Việt Nam (BR-10). */
export function completableFrom(endDate: string): string {
  return addDays(endDate, 1);
}

/** Ngày làm việc kế tiếp sau `day`. */
export function nextWorkingDay(day: string, holidays: ReadonlySet<string>): string {
  let d = addDays(day, 1);
  while (!isWorkingDay(d, holidays)) d = addDays(d, 1);
  return d;
}

/**
 * Mốc nhắc đơn chờ (BR-17, UC4 13.5): vào giai đoạn chờ ngày N; ngày làm việc kế tiếp sau N là ngày đầy đủ đầu tiên; nhắc
 * lúc 08:00 ngày làm việc tiếp theo nữa (giờ Việt Nam). Trả về thời điểm UTC.
 */
export function reminderDueAt(stageEnteredAt: Date, holidays: ReadonlySet<string>): Date {
  const n = new Date(stageEnteredAt.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
  const due = nextWorkingDay(nextWorkingDay(n, holidays), holidays);
  return new Date(`${due}T01:00:00Z`); // 08:00 giờ Việt Nam
}
