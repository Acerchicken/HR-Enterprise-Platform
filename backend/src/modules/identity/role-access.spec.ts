import { isSelfChange, wouldRemoveLastAdmin } from './role-access';
import { AuthUser } from './roles';

const admin: AuthUser = { userId: 'a-1', subject: 's', email: 'admin@hr.local', employeeId: 'e-1', roles: ['EMPLOYEE', 'ADMIN'] };

describe('role-access (UC8 FR-8.7)', () => {
  it('tự cấp, tự thu hồi cho mình là E11 (AC-8.7.3)', () => {
    expect(isSelfChange(admin, 'a-1')).toBe(true);
    expect(isSelfChange(admin, 'a-2')).toBe(false);
  });

  it('thu hồi ADMIN cuối cùng là E12 (AC-8.7.4)', () => {
    expect(wouldRemoveLastAdmin(['a-2'], 'a-2')).toBe(true);
    expect(wouldRemoveLastAdmin([], 'a-2')).toBe(true);
    expect(wouldRemoveLastAdmin(['a-1', 'a-2'], 'a-2')).toBe(false);
  });
});
