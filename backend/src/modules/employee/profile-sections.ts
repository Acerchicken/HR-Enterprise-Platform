import { AuthUser, hasRole } from '../identity/roles';

/**
 * Danh mục các mục của trang hồ sơ (UC1 spec mục 8, 9.1, 13.1). Một chỗ duy nhất mô tả mục thuộc nhóm nào, ai thấy, ai nhập
 * và đã làm hay chưa; `summary`, API từng mục và giao diện cùng đọc từ đây.
 */

/** Mức xem (UC1 spec mục 2): DB danh bạ, QL thêm quản lý trực tiếp, CN chủ hồ sơ và HR, NC như CN nhưng phải bấm mắt, HR chỉ HR. */
export type SectionLevel = 'DB' | 'QL' | 'CN' | 'NC' | 'HR';

/** Quan hệ của người xem với chủ hồ sơ. HR xét trước, nên HR xem hồ sơ của chính mình vẫn là HR. */
export type Relation = 'HR' | 'OWNER' | 'MANAGER' | 'OTHER';

export type SectionGroup = 'personal' | 'work' | 'finance' | 'benefits' | 'other';

export interface SectionDef {
  code: string;
  group: SectionGroup;
  title: string;
  level: SectionLevel;
  /** NV: nhân viên đề xuất (HR duyệt); HR: chỉ HR; AUTO: hệ thống tự tính. */
  input: 'NV' | 'HR' | 'AUTO';
  /** false: chưa làm, giao diện hiện tiêu đề đỏ "Chưa có", API của mục trả 404. */
  available: boolean;
}

export const PROFILE_SECTIONS: readonly SectionDef[] = [
  { code: 'personal', group: 'personal', title: 'Thông tin cá nhân', level: 'QL', input: 'NV', available: true },
  { code: 'emergency-contacts', group: 'personal', title: 'Thông tin liên hệ khẩn cấp', level: 'CN', input: 'NV', available: true },
  { code: 'relatives', group: 'personal', title: 'Thân nhân và người phụ thuộc', level: 'CN', input: 'NV', available: true },
  { code: 'career-history', group: 'work', title: 'Quá trình công tác', level: 'QL', input: 'AUTO', available: true },
  { code: 'contracts', group: 'work', title: 'Diện đối tượng', level: 'CN', input: 'HR', available: true },
  { code: 'long-leaves', group: 'work', title: 'Ngày nghỉ dài', level: 'QL', input: 'AUTO', available: true },
  { code: 'milestones', group: 'work', title: 'Các mốc trong công ty', level: 'QL', input: 'AUTO', available: true },
  { code: 'salary', group: 'finance', title: 'Lương mục tiêu', level: 'NC', input: 'HR', available: true },
  { code: 'insurance-salary', group: 'finance', title: 'Hệ số lương bảo hiểm', level: 'NC', input: 'HR', available: true },
  { code: 'bank-account', group: 'finance', title: 'Thông tin tài khoản ngân hàng', level: 'NC', input: 'NV', available: true },
  { code: 'tax', group: 'finance', title: 'Thông tin thuế TNCN', level: 'NC', input: 'HR', available: true },
  { code: 'social-insurance', group: 'benefits', title: 'Bảo hiểm xã hội', level: 'CN', input: 'HR', available: true },
  { code: 'health-insurance', group: 'benefits', title: 'Bảo hiểm y tế', level: 'CN', input: 'NV', available: true },
  { code: 'allowances', group: 'benefits', title: 'Phụ cấp', level: 'NC', input: 'HR', available: true },
  { code: 'rewards-discipline', group: 'other', title: 'Khen thưởng kỷ luật', level: 'CN', input: 'HR', available: true },
  { code: 'qualifications', group: 'other', title: 'Chuyên môn', level: 'QL', input: 'NV', available: true },
  { code: 'cv', group: 'other', title: 'Sơ yếu lý lịch', level: 'CN', input: 'NV', available: true },
  { code: 'history', group: 'other', title: 'Lịch sử thay đổi', level: 'CN', input: 'AUTO', available: true },
];

const BY_CODE = new Map(PROFILE_SECTIONS.map((s) => [s.code, s]));

export function findSection(code: string): SectionDef | undefined {
  return BY_CODE.get(code);
}

/** Quan hệ tính được không cần database: HR, chủ hồ sơ, quản lý trực tiếp. Quản lý gián tiếp dùng `resolveRelation`. */
export function relationTo(viewer: AuthUser, target: { id: string; managerId: string | null }): Relation {
  if (hasRole(viewer, 'HR')) return 'HR';
  if (viewer.employeeId && viewer.employeeId === target.id) return 'OWNER';
  if (viewer.employeeId && viewer.employeeId === target.managerId) return 'MANAGER';
  return 'OTHER';
}

/** Chuỗi quản lý dài nhất được dò; FR-2.5 không cho vòng nên chỉ là chốt an toàn. */
export const MAX_CHAIN_DEPTH = 20;

/**
 * Như `relationTo`, cộng quản lý gián tiếp (chốt 18/11/2026): người xem nằm trên chuỗi quản lý trực tiếp của target (quản lý
 * của quản lý…) cũng là `MANAGER`, xem được mục mức QL. Quyền duyệt đơn nghỉ không đổi, vẫn chỉ quản lý trực tiếp (BR-05).
 */
export async function resolveRelation(
  db: { query: (sql: string, params?: unknown[]) => Promise<unknown[]> },
  viewer: AuthUser,
  target: { id: string; managerId: string | null },
): Promise<Relation> {
  const direct = relationTo(viewer, target);
  if (direct !== 'OTHER' || !viewer.employeeId || !target.managerId) return direct;
  const rows = await db.query(
    `WITH RECURSIVE chain(id, depth) AS (
       SELECT manager_id, 1 FROM employee.employee WHERE id = $1 AND manager_id IS NOT NULL
       UNION ALL
       SELECT e.manager_id, c.depth + 1 FROM employee.employee e JOIN chain c ON e.id = c.id
        WHERE e.manager_id IS NOT NULL AND c.depth < $3
     )
     SELECT 1 FROM chain WHERE id = $2 LIMIT 1`,
    [target.managerId, viewer.employeeId, MAX_CHAIN_DEPTH],
  );
  return rows.length ? 'MANAGER' : 'OTHER';
}

const LEVEL_VIEWERS: Record<SectionLevel, readonly Relation[]> = {
  DB: ['HR', 'OWNER', 'MANAGER', 'OTHER'],
  QL: ['HR', 'OWNER', 'MANAGER'],
  CN: ['HR', 'OWNER'],
  NC: ['HR', 'OWNER'],
  HR: ['HR'],
};

export function canSeeLevel(relation: Relation, level: SectionLevel): boolean {
  return LEVEL_VIEWERS[level].includes(relation);
}

/** Mục người xem được thấy, theo đúng thứ tự trên trang. Mục không được xem thì không có trong danh sách (AC-1.8.6). */
export function visibleSections(relation: Relation): SectionDef[] {
  return PROFILE_SECTIONS.filter((s) => canSeeLevel(relation, s.level));
}

/**
 * Giá trị nhạy cảm (mức NC) chỉ chủ hồ sơ và HR được giải mã. CCCD (mức HR) chỉ HR, chủ hồ sơ không xem CCCD của mình qua
 * ứng dụng (UC1 E2).
 */
export function canReveal(relation: Relation, field: 'salary' | 'bankAccount' | 'nationalId'): boolean {
  if (field === 'nationalId') return relation === 'HR';
  return relation === 'HR' || relation === 'OWNER';
}
