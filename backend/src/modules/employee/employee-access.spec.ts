import { AuthUser } from '../identity/roles';
import { forbiddenFields, viewLevel } from './employee-access';

const user = (employeeId: string, ...roles: AuthUser['roles']): AuthUser => ({
  userId: 'u-' + employeeId,
  subject: 's',
  email: `${employeeId}@hr.local`,
  employeeId,
  roles: ['EMPLOYEE', ...roles],
});

describe('employee access rules', () => {
  const target = { id: 'e1', managerId: 'm1' };

  it('nhân viên xem hồ sơ người khác chỉ thấy thông tin danh bạ', () => {
    expect(viewLevel(user('e2'), target)).toBe('PUBLIC');
  });

  it('chính mình và quản lý trực tiếp thấy thông tin cá nhân', () => {
    expect(viewLevel(user('e1'), target)).toBe('PERSONAL');
    expect(viewLevel(user('m1', 'MANAGER'), target)).toBe('PERSONAL');
  });

  it('manager khác team không thấy thông tin cá nhân', () => {
    expect(viewLevel(user('m2', 'MANAGER'), target)).toBe('PUBLIC');
  });

  it('ADMIN mặc định không xem dữ liệu cá nhân', () => {
    expect(viewLevel(user('a1', 'ADMIN'), target)).toBe('PUBLIC');
  });

  it('HR có mức xem HR', () => {
    expect(viewLevel(user('h1', 'HR'), target)).toBe('HR');
  });

  it('nhân viên chỉ tự sửa phone, address', () => {
    expect(forbiddenFields(user('e1'), 'e1', { phone: '0912345678', version: 3 })).toEqual([]);
    expect(forbiddenFields(user('e1'), 'e1', { phone: '0912345678', salary: '1' })).toEqual(['salary']);
  });

  it('không sửa được hồ sơ người khác, trừ HR', () => {
    expect(forbiddenFields(user('e2'), 'e1', { phone: '0912345678' })).toEqual(['phone']);
    expect(forbiddenFields(user('m1', 'MANAGER'), 'e1', { address: 'x' })).toEqual(['address']);
    expect(forbiddenFields(user('h1', 'HR'), 'e1', { salary: '1', departmentId: 'd' })).toEqual([]);
  });
});
