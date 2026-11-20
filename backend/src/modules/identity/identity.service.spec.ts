import { ForbiddenException } from '@nestjs/common';
import { IdentityService } from './identity.service';

/** Vai trò chỉ lấy từ database và sơ đồ tổ chức, không từ token (ADR-18, AC-8.1.10). */
describe('IdentityService.resolve', () => {
  const account = { id: 'acc-1', subject: 'sub-1', email: 'a@hr.local', employeeId: 'emp-1' };
  let rows: { userId: string; role: string }[];
  let hasReports: boolean;
  let status: string;

  const service = () =>
    new IdentityService(
      { findOneBy: async () => ({ ...account }), save: async (x: unknown) => x, create: (x: unknown) => x, update: async () => undefined } as any,
      { findBy: async () => rows } as any,
      {
        placementOf: async () => ({ status }),
        hasDirectReports: async () => hasReports,
        findByWorkEmail: async () => null,
      } as any,
    );
  const token = { subject: 'sub-1', email: 'a@hr.local' };

  beforeEach(() => {
    rows = [];
    hasReports = false;
    status = 'ACTIVE';
  });

  it('nhân viên không có dòng nào: chỉ EMPLOYEE', async () => {
    expect((await service().resolve(token)).roles).toEqual(['EMPLOYEE']);
  });

  it('HR, ADMIN lấy từ iam.role_assignment', async () => {
    rows = [
      { userId: 'acc-1', role: 'HR' },
      { userId: 'acc-1', role: 'ADMIN' },
    ];
    expect((await service().resolve(token)).roles.sort()).toEqual(['ADMIN', 'EMPLOYEE', 'HR']);
  });

  it('token có nhóm hr, manager (Keycloak hoặc Cognito) nhưng database không có: không có quyền đó', async () => {
    const withGroups = { ...token, roles: ['hr', 'manager', 'admin'], realm_access: { roles: ['hr'] } } as any;
    expect((await service().resolve(withGroups)).roles).toEqual(['EMPLOYEE']);
  });

  it('dòng MANAGER, EMPLOYEE cũ trong database bị bỏ qua; MANAGER chỉ khi có cấp dưới trực tiếp (ADR-10)', async () => {
    rows = [{ userId: 'acc-1', role: 'MANAGER' }];
    expect((await service().resolve(token)).roles).toEqual(['EMPLOYEE']);
    hasReports = true;
    expect((await service().resolve(token)).roles).toEqual(['EMPLOYEE', 'MANAGER']);
  });

  it('người đã nghỉ việc bị 403 dù có vai trò HR', async () => {
    rows = [{ userId: 'acc-1', role: 'HR' }];
    status = 'TERMINATED';
    await expect(service().resolve(token)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
