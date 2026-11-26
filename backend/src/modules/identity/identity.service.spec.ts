import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
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
  const token = { subject: 'sub-1', email: 'a@hr.local', emailVerified: true };

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

  describe('chỉ khớp theo email khi IdP đã xác minh email (threat model T-02, NFR-5.9)', () => {
    const build = (bySubject: object | null, byEmail: object | null, employee: object | null = { id: 'emp-9' }) => {
      const saved: any[] = [];
      const update = jest.fn(async () => undefined);
      const svc = new IdentityService(
        {
          findOneBy: async (w: { subject?: string; email?: string }) => ('subject' in w ? bySubject : byEmail),
          save: async (x: any) => (saved.push(x), { id: 'new', ...x }),
          create: (x: unknown) => x,
          update,
        } as any,
        { findBy: async () => [] } as any,
        { placementOf: async () => ({ status: 'ACTIVE' }), hasDirectReports: async () => false, findByWorkEmail: async () => employee } as any,
      );
      return { svc, saved, update };
    };
    const unverified = { subject: 'sub-x', email: 'victim@hr.local', emailVerified: false };

    it('lần đầu đăng nhập, email chưa xác minh: 401 (UC8 E3), không tạo tài khoản, không gắn hồ sơ', async () => {
      const { svc, saved } = build(null, null);
      await expect(svc.resolve(unverified)).rejects.toThrow(UnauthorizedException);
      expect(saved).toHaveLength(0);
    });

    it('tài khoản do HR tạo sẵn (chưa có subject), email chưa xác minh: 401, không gắn subject', async () => {
      const { svc, update } = build(null, { id: 'acc-2', subject: null, email: 'victim@hr.local', employeeId: 'emp-2', idpStatus: 'INVITED' });
      await expect(svc.resolve(unverified)).rejects.toThrow(UnauthorizedException);
      expect(update).not.toHaveBeenCalled();
    });

    it('email đã xác minh: tạo tài khoản và gắn hồ sơ theo email công ty', async () => {
      const { svc, saved } = build(null, null);
      const user = await svc.resolve({ ...unverified, emailVerified: true });
      expect(saved[0]).toMatchObject({ subject: 'sub-x', email: 'victim@hr.local', employeeId: 'emp-9' });
      expect(user.employeeId).toBe('emp-9');
    });

    it('tài khoản đã gắn subject: đăng nhập được dù token thiếu email_verified', async () => {
      const { svc } = build({ id: 'acc-3', subject: 'sub-x', email: 'victim@hr.local', employeeId: 'emp-3', idpStatus: 'ACTIVE' }, null);
      expect((await svc.resolve(unverified)).employeeId).toBe('emp-3');
    });
  });
});
