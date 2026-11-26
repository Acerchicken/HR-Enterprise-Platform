/** Múi giờ doanh nghiệp (UC7 AC-7.3.5): ngày `YYYY-MM-DD` trong bộ lọc là ngày theo giờ Việt Nam. */
const VN_OFFSET = '+07:00';
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export interface AuditPeriod {
  /** Mốc dưới, tính cả mốc. */
  from?: Date;
  /** Mốc trên, không tính mốc. */
  toExclusive?: Date;
}

/** `true` nếu là ngày `YYYY-MM-DD` hoặc ngày giờ ISO 8601 hợp lệ. */
export function isAuditDate(value: string): boolean {
  if (DATE_ONLY.test(value)) return !Number.isNaN(Date.parse(`${value}T00:00:00${VN_OFFSET}`)) && validDay(value);
  return /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value));
}

function validDay(value: string): boolean {
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Đổi `from`, `to` của bộ lọc thành khoảng `[from, toExclusive)`.
 * - Ngày: `from` là 00:00 giờ Việt Nam; `to` tính cả ngày đó (00:00 ngày kế tiếp, không tính).
 * - Ngày giờ ISO: dùng đúng thời điểm; `to` tính cả mốc (cộng 1 ms).
 */
export function auditPeriod(from?: string, to?: string): AuditPeriod {
  const out: AuditPeriod = {};
  if (from) out.from = DATE_ONLY.test(from) ? new Date(`${from}T00:00:00${VN_OFFSET}`) : new Date(from);
  if (to) {
    if (DATE_ONLY.test(to)) {
      const start = new Date(`${to}T00:00:00${VN_OFFSET}`);
      out.toExclusive = new Date(start.getTime() + 24 * 3600 * 1000);
    } else {
      out.toExclusive = new Date(new Date(to).getTime() + 1);
    }
  }
  return out;
}
