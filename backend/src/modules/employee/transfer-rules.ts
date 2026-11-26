import { EntityManager } from 'typeorm';

/** Ngày hôm nay theo giờ Việt Nam (UTC+7, không có giờ mùa hè). */
export function vnToday(now = new Date()): string {
  return new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

/**
 * Mốc xa nhất cho ngày hiệu lực điều chuyển (UC2 E18, TV2 chốt 25/11): cùng ngày lịch của năm kế tiếp, tính cả mốc.
 * 29/2 không có ở năm sau thì lấy 28/2.
 */
export function transferHorizon(today: string): string {
  const [y, m, d] = today.split('-').map(Number);
  const last = new Date(Date.UTC(y + 1, m, 0)).getUTCDate();
  return `${y + 1}-${String(m).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Điều chuyển chưa hiệu lực của người khác mà `employeeId` là quản lý mới (UC1 AC-1.7.3). */
export async function pendingAsNewManager(m: EntityManager, employeeId: string) {
  const rows: { id: string; parent_id: string | null; full_name: string; effective_from: string }[] = await m.query(
    `SELECT a.id, a.parent_id, e.full_name, to_char(a.effective_from, 'YYYY-MM-DD') AS effective_from
       FROM employee.employment_assignment a JOIN employee.employee e ON e.id = a.employee_id
      WHERE a.status = 'SCHEDULED' AND a.manager_id = $1 AND a.employee_id <> $1
      ORDER BY a.effective_from`,
    [employeeId],
  );
  return rows.map((r) => ({ transferId: r.parent_id ?? r.id, employeeName: r.full_name, effectiveDate: r.effective_from }));
}
