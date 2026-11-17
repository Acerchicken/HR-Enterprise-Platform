/**
 * Thông tin tự tính của hồ sơ (UC1 FR-1.13), viết thành hàm thuần để test: thâm niên và các mốc, quá trình công tác dựng từ
 * audit nhóm trường tổ chức (AC-1.4.3).
 */

export interface Seniority {
  hireDate: string;
  years: number;
  months: number;
  /** Các mốc 5 năm đã qua, cũ nhất trước. */
  milestones: string[];
  nextMilestone: string;
  /** Số ngày phép năm cộng thêm: cứ đủ 5 năm làm việc được thêm 1 ngày (Điều 114 BLLĐ 2019, UC3 AC-3.1.3). */
  annualLeaveBonus: number;
}

const addYears = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  // 29/2 sang năm không nhuận thành 28/2.
  const last = new Date(Date.UTC(y + n, m, 0)).getUTCDate();
  return `${String(y + n).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
};

/** AC-1.13.2: vào làm 1/3/2016, xem ngày 14/11/2026 → 10 năm 8 tháng, mốc 1/3/2021 và 1/3/2026, cộng 2 ngày phép. */
export function seniority(hireDate: string, today: string): Seniority {
  const [hy, hm, hd] = hireDate.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = today.split('-').map(Number) as [number, number, number];
  let total = (ty - hy) * 12 + (tm - hm) - (td < hd ? 1 : 0);
  if (total < 0) total = 0;
  const years = Math.floor(total / 12);
  const milestones: string[] = [];
  for (let n = 5; addYears(hireDate, n) <= today; n += 5) milestones.push(addYears(hireDate, n));
  return {
    hireDate,
    years,
    months: total % 12,
    milestones,
    nextMilestone: addYears(hireDate, (milestones.length + 1) * 5),
    annualLeaveBonus: Math.floor(years / 5),
  };
}

export interface OrgState {
  departmentId: string | null;
  positionId: string | null;
  managerId: string | null;
}

export interface OrgChange {
  at: string;
  changes: Partial<Record<keyof OrgState, { from: unknown; to: unknown }>>;
}

export interface CareerPeriod extends OrgState {
  from: string;
  to: string | null;
  reason: string;
}

const KEYS: (keyof OrgState)[] = ['departmentId', 'positionId', 'managerId'];

/**
 * AC-1.13.1: dựng các giai đoạn công tác từ ngày vào làm và các lần đổi phòng ban, chức danh, quản lý trong audit (cũ nhất
 * trước). Trạng thái ban đầu là giá trị `from` của lần đổi đầu tiên mỗi trường, nếu chưa đổi thì là giá trị hiện tại.
 */
export function careerTimeline(hireDate: string, current: OrgState, changes: OrgChange[]): CareerPeriod[] {
  const ordered = changes.filter((c) => KEYS.some((k) => c.changes[k])).sort((a, b) => a.at.localeCompare(b.at));
  const state: OrgState = { ...current };
  for (const k of KEYS) {
    const first = ordered.find((c) => c.changes[k]);
    if (first) state[k] = (first.changes[k]!.from as string | null) ?? null;
  }
  const periods: CareerPeriod[] = [{ ...state, from: hireDate, to: null, reason: 'Vào làm' }];
  for (const c of ordered) {
    const day = c.at.slice(0, 10);
    const next: OrgState = { ...periods[periods.length - 1]! };
    for (const k of KEYS) if (c.changes[k]) next[k] = (c.changes[k]!.to as string | null) ?? null;
    const reasons = [
      c.changes.departmentId && 'Điều chuyển phòng ban',
      c.changes.positionId && 'Đổi chức danh',
      c.changes.managerId && 'Đổi quản lý trực tiếp',
    ].filter(Boolean);
    const prev = periods[periods.length - 1]!;
    if (prev.from === day) {
      Object.assign(prev, next, { reason: prev.reason === 'Vào làm' ? prev.reason : reasons.join(', ') });
      continue;
    }
    prev.to = day;
    periods.push({ ...next, from: day, to: null, reason: reasons.join(', ') });
  }
  // Đổi rồi đổi lại (ví dụ sửa nhầm trong ngày) không tạo giai đoạn mới: gộp các giai đoạn liền nhau có cùng tổ chức.
  const merged: CareerPeriod[] = [];
  for (const p of periods) {
    const last = merged[merged.length - 1];
    if (last && KEYS.every((k) => last[k] === p[k])) last.to = p.to;
    else merged.push(p);
  }
  return merged.reverse();
}

/** Khoảng trạng thái `ON_LEAVE` từ các lần đổi trạng thái trong audit (AC-1.13.3). */
export function onLeavePeriods(changes: { at: string; from: unknown; to: unknown }[]): { from: string; to: string | null }[] {
  const out: { from: string; to: string | null }[] = [];
  for (const c of [...changes].sort((a, b) => a.at.localeCompare(b.at))) {
    if (c.to === 'ON_LEAVE') out.push({ from: c.at.slice(0, 10), to: null });
    else if (c.from === 'ON_LEAVE' && out.length && out[out.length - 1]!.to === null) out[out.length - 1]!.to = c.at.slice(0, 10);
  }
  return out;
}
