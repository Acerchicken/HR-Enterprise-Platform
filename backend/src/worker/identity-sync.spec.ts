import { loadConfig } from '../config/config';
import { IdpError, NoopIdpAdmin } from '../modules/identity/idp-admin/idp-admin';
import { IdentitySync } from './identity-sync';

const base = { employeeId: 'e1', accountId: 'a1', email: 'an@hr.local', fullName: 'Nguyễn Văn An' } as any;

function setup(idpOverrides: Partial<NoopIdpAdmin> = {}, account: Record<string, unknown> = {}) {
  const idp = Object.assign(new NoopIdpAdmin(), idpOverrides);
  const ds = {
    query: jest.fn(async (sql: string, _params?: unknown[]) => (sql.startsWith('SELECT') ? [account] : [])),
  };
  const cfg = loadConfig({ IDP_SYNC_ATTEMPTS: '3', IDP_SYNC_RETRY_DELAY_MS: '0' });
  const sync = new IdentitySync(cfg, ds as any, idp);
  const updates = () => ds.query.mock.calls.filter(([sql]) => sql.includes('UPDATE iam.user_account'));
  const audits = () => ds.query.mock.calls.filter(([sql]) => sql.includes('ACCOUNT_SYNC_FAILED'));
  return { sync, ds, idp, updates, audits };
}

describe('IdentitySync (UC8 FR-8.3, 8.4, 8.6)', () => {
  it('tạo hồ sơ: IdP tạo mới → INVITED, ghi thời điểm mời', async () => {
    const createUser = jest.fn(async () => ({ subject: 's', created: true }));
    const { sync, updates } = setup({ createUser });
    await sync.handle('EmployeeCreated', base);
    expect(createUser).toHaveBeenCalledWith({ email: 'an@hr.local', fullName: 'Nguyễn Văn An', groups: ['employee'] });
    expect(updates()[0][1]).toEqual(['a1', 'INVITED']);
  });

  it('email đã có trên IdP (E7) → gắn, ACTIVE, không gửi thư', async () => {
    const { sync, updates } = setup();
    await sync.handle('EmployeeCreated', base);
    expect(updates()[0][1]).toEqual(['a1', 'ACTIVE']);
  });

  it('mời lại khi đang INVITED → chỉ gửi lại thư (A6)', async () => {
    const resendInvite = jest.fn(async () => undefined);
    const createUser = jest.fn();
    const { sync, updates } = setup({ resendInvite, createUser } as any);
    await sync.handle('AccountInviteRequested', { ...base, previousStatus: 'INVITED' });
    expect(resendInvite).toHaveBeenCalledWith('an@hr.local');
    expect(createUser).not.toHaveBeenCalled();
    expect(updates()[0][1]).toEqual(['a1', 'INVITED']);
  });

  it('nghỉ việc → khóa và thu hồi phiên, DISABLED (AC-8.4.2)', async () => {
    const disableUser = jest.fn(async () => undefined);
    const signOutAll = jest.fn(async () => undefined);
    const { sync, updates } = setup({ disableUser, signOutAll });
    await sync.handle('EmployeeTerminated', base);
    expect(disableUser).toHaveBeenCalled();
    expect(signOutAll).toHaveBeenCalled();
    expect(updates()[0][1]).toEqual(['a1', 'DISABLED']);
  });

  it('khôi phục: chưa đăng nhập lần nào → INVITED, đã đăng nhập → ACTIVE', async () => {
    let s = setup({}, { subject: null, last_login_at: null });
    await s.sync.handle('EmployeeReinstated', base);
    expect(s.updates()[0][1]).toEqual(['a1', 'INVITED']);
    s = setup({}, { subject: 'sub', last_login_at: null });
    await s.sync.handle('EmployeeReinstated', base);
    expect(s.updates()[0][1]).toEqual(['a1', 'ACTIVE']);
  });

  it('cấp vai trò → thêm nhóm IdP chữ thường, giữ trạng thái', async () => {
    const addToGroup = jest.fn(async () => undefined);
    const { sync, updates } = setup({ addToGroup });
    await sync.handle('RoleGranted', { ...base, role: 'HR' });
    expect(addToGroup).toHaveBeenCalledWith('an@hr.local', 'hr');
    expect(updates()[0][1]).toEqual(['a1', null]);
  });

  it('lỗi tạm thời: thử lại rồi thành công', async () => {
    const createUser = jest
      .fn()
      .mockRejectedValueOnce(new IdpError('down', true))
      .mockResolvedValueOnce({ subject: 's', created: true });
    const { sync, audits } = setup({ createUser });
    await sync.handle('EmployeeCreated', base);
    expect(createUser).toHaveBeenCalledTimes(2);
    expect(audits()).toHaveLength(0);
  });

  it('hết lượt thử: tạo tài khoản ghi FAILED, audit, ném lỗi để vào DLQ (E6)', async () => {
    const createUser = jest.fn().mockRejectedValue(new IdpError('down', true));
    const { sync, updates, audits } = setup({ createUser });
    await expect(sync.handle('EmployeeCreated', base)).rejects.toThrow('down');
    expect(createUser).toHaveBeenCalledTimes(3);
    expect(updates()[0][1]).toEqual(['a1', 'IDP_UNAVAILABLE', true]);
    expect(audits()).toHaveLength(1);
  });

  it('lỗi cố định không thử lại; sự kiện khác không đổi trạng thái thành FAILED', async () => {
    const disableUser = jest.fn().mockRejectedValue(new IdpError('nope', false, 'IDP_USER_NOT_FOUND'));
    const { sync, updates } = setup({ disableUser });
    await expect(sync.handle('EmployeeTerminated', base)).rejects.toThrow();
    expect(disableUser).toHaveBeenCalledTimes(1);
    expect(updates()[0][1]).toEqual(['a1', 'IDP_USER_NOT_FOUND', false]);
  });
});
