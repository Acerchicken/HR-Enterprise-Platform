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
  { code: 'emergency-contacts', group: 'personal', title: 'Thông tin liên hệ khẩn cấp', level: 'CN', input: 'NV', available: false },
  { code: 'relatives', group: 'personal', title: 'Thân nhân và người phụ thuộc', level: 'CN', input: 'NV', available: false },
  { code: 'career-history', group: 'work', title: 'Quá trình công tác', level: 'QL', input: 'AUTO', available: false },
  { code: 'contracts', group: 'work', title: 'Diện đối tượng', level: 'CN', input: 'HR', available: false },
  { code: 'long-leaves', group: 'work', title: 'Ngày nghỉ dài', level: 'QL', input: 'AUTO', available: false },
  { code: 'milestones', group: 'work', title: 'Các mốc trong công ty', level: 'QL', input: 'AUTO', available: false },
  { code: 'salary', group: 'finance', title: 'Lương mục tiêu', level: 'NC', input: 'HR', available: true },
  { code: 'insurance-salary', group: 'finance', title: 'Hệ số lương bảo hiểm', level: 'NC', input: 'HR', available: false },
  { code: 'bank-account', group: 'finance', title: 'Thông tin tài khoản ngân hàng', level: 'NC', input: 'NV', available: true },
  { code: 'tax', group: 'finance', title: 'Thông tin thuế TNCN', level: 'NC', input: 'HR', available: false },
  { code: 'social-insurance', group: 'benefits', title: 'Bảo hiểm xã hội', level: 'CN', input: 'HR', available: false },
  { code: 'health-insurance', group: 'benefits', title: 'Bảo hiểm y tế', level: 'CN', input: 'NV', available: false },
  { code: 'allowances', group: 'benefits', title: 'Phụ cấp', level: 'NC', input: 'HR', available: false },
  { code: 'rewards-discipline', group: 'other', title: 'Khen thưởng kỷ luật', level: 'CN', input: 'HR', available: false },
  { code: 'qualifications', group: 'other', title: 'Chuyên môn', level: 'QL', input: 'NV', available: false },
  { code: 'cv', group: 'other', title: 'Sơ yếu lý lịch', level: 'CN', input: 'NV', available: false },
  { code: 'history', group: 'other', title: 'Lịch sử thay đổi', level: 'CN', input: 'AUTO', available: false },
];

const BY_CODE = new Map(PROFILE_SECTIONS.map((s) => [s.code, s]));

export function findSection(code: string): SectionDef | undefined {
  return BY_CODE.get(code);
}

export function relationTo(viewer: AuthUser, target: { id: string; managerId: string | null }): Relation {
  if (hasRole(viewer, 'HR')) return 'HR';
  if (viewer.employeeId && viewer.employeeId === target.id) return 'OWNER';
  if (viewer.employeeId && viewer.employeeId === target.managerId) return 'MANAGER';
  return 'OTHER';
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
