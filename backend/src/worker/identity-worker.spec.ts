import { loadConfig } from '../config/config';
import { IdentityWorker } from './identity-worker';

function setup() {
  const processed = new Set<string>();
  const ds = {
    query: jest.fn(async (sql: string, params: string[]) => {
      if (sql.startsWith('SELECT')) return processed.has(params[0]) ? [{}] : [];
      processed.add(params[0]);
      return [];
    }),
  };
  const identity = { handle: jest.fn(async () => undefined) };
  return { worker: new IdentityWorker(loadConfig({}), ds as any, identity as any), identity };
}

describe('IdentityWorker', () => {
  const payload = { accountId: 'a-1', email: 'x@hr.local', role: 'HR' };

  it('event tài khoản: đồng bộ sang IdP một lần, nhận lại thì bỏ qua', async () => {
    const { worker, identity } = setup();
    expect(await worker.handle('1', 'RoleGranted', payload)).toBe(true);
    expect(await worker.handle('1', 'RoleGranted', payload)).toBe(false);
    expect(identity.handle).toHaveBeenCalledTimes(1);
  });

  it('event email (nghỉ phép) không xử lý ở đây: notification service làm (ADR-15)', async () => {
    const { worker, identity } = setup();
    expect(await worker.handle('2', 'LeaveApproved', {})).toBe(false);
    expect(identity.handle).not.toHaveBeenCalled();
  });

  it('IdP lỗi thì ném ra (vào DLQ) và không đánh dấu đã xử lý', async () => {
    const { worker, identity } = setup();
    identity.handle.mockRejectedValueOnce(new Error('IdP down'));
    await expect(worker.handle('3', 'EmployeeCreated', payload)).rejects.toThrow('IdP down');
    expect(await worker.handle('3', 'EmployeeCreated', payload)).toBe(true);
  });
});
