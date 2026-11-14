import { AuthUser } from '../identity/roles';
import { canReveal, findSection, PROFILE_SECTIONS, relationTo, visibleSections } from './profile-sections';

const user = (employeeId: string, ...roles: AuthUser['roles']): AuthUser => ({
  userId: 'u-' + employeeId,
  subject: 's',
  email: `${employeeId}@hr.local`,
  employeeId,
  roles: ['EMPLOYEE', ...roles],
});

const codes = (relation: Parameters<typeof visibleSections>[0]) => visibleSections(relation).map((s) => s.code);

describe('profile sections (UC1 spec 9.1)', () => {
  const target = { id: 'e1', managerId: 'm1' };

  it('quan hệ với chủ hồ sơ: HR xét trước, rồi chủ hồ sơ, quản lý trực tiếp, người khác', () => {
    expect(relationTo(user('h1', 'HR'), target)).toBe('HR');
    expect(relationTo(user('e1', 'HR'), target)).toBe('HR');
    expect(relationTo(user('e1'), target)).toBe('OWNER');
    expect(relationTo(user('m1', 'MANAGER'), target)).toBe('MANAGER');
    expect(relationTo(user('m2', 'MANAGER'), target)).toBe('OTHER');
    expect(relationTo(user('a1', 'ADMIN'), target)).toBe('OTHER');
    expect(relationTo({ ...user('x'), employeeId: null }, target)).toBe('OTHER');
  });

  it('mức danh bạ không thấy mục nào (AC-1.8.4)', () => {
    expect(codes('OTHER')).toEqual([]);
  });

  it('quản lý trực tiếp chỉ thấy mục mức QL: cá nhân, công việc tự tính, chuyên môn', () => {
    expect(codes('MANAGER')).toEqual(['personal', 'career-history', 'long-leaves', 'milestones', 'qualifications']);
  });

  it('chủ hồ sơ và HR thấy mọi mục, đúng thứ tự trên trang', () => {
    const all = PROFILE_SECTIONS.map((s) => s.code);
    expect(codes('OWNER')).toEqual(all);
    expect(codes('HR')).toEqual(all);
  });

  it('chỉ chủ hồ sơ và HR giải mã lương, tài khoản; CCCD chỉ HR (AC-1.3.5, E2)', () => {
    expect(canReveal('OWNER', 'salary')).toBe(true);
    expect(canReveal('OWNER', 'bankAccount')).toBe(true);
    expect(canReveal('OWNER', 'nationalId')).toBe(false);
    expect(canReveal('MANAGER', 'salary')).toBe(false);
    expect(canReveal('OTHER', 'bankAccount')).toBe(false);
    expect(canReveal('HR', 'nationalId')).toBe(true);
  });

  it('mục đã làm: cá nhân, lương, tài khoản ngân hàng; mã mục không trùng', () => {
    expect(PROFILE_SECTIONS.filter((s) => s.available).map((s) => s.code)).toEqual(['personal', 'salary', 'bank-account']);
    expect(new Set(PROFILE_SECTIONS.map((s) => s.code)).size).toBe(PROFILE_SECTIONS.length);
    expect(findSection('salary')?.level).toBe('NC');
    expect(findSection('nope')).toBeUndefined();
  });
});
