import { AuthUser } from '../identity/roles';
import { TodoCountsService } from './todo-counts';

const page = (ids: string[], total = ids.length) => ({ items: ids.map((id) => ({ id })), page: 1, size: 100, total });
const user = (roles: string[], employeeId: string | null = 'e1') => ({ userId: 'u1', subject: 's', email: 'a@b', employeeId, roles }) as unknown as AuthUser;

function setup(opts: { mine?: string[]; mineTotal?: number; hr?: string[]; approved?: number; pending?: number; rejected?: number; ownPending?: number } = {}) {
  const leave = {
    pendingApproval: jest.fn().mockResolvedValue(page(opts.mine ?? [], opts.mineTotal)),
    pendingHr: jest.fn().mockResolvedValue(page(opts.hr ?? [])),
    all: jest.fn().mockResolvedValue(page([], opts.approved ?? 0)),
  };
  const changes = {
    list: jest.fn().mockResolvedValue(page([], opts.pending ?? 0)),
    rejectedUnacknowledged: jest.fn().mockResolvedValue(opts.rejected ?? 0),
    ownPending: jest.fn().mockResolvedValue(opts.ownPending ?? 0),
  };
  return { svc: new TodoCountsService(leave as never, changes as never), leave, changes };
}

describe('TodoCountsService (AC-0.2.2, AC-0.6.1)', () => {
  it('nhân viên thường: không có tab nào, chuông chỉ đếm yêu cầu của mình bị từ chối', async () => {
    const { svc, leave, changes } = setup({ rejected: 2, ownPending: 3 });
    expect(await svc.counts(user(['EMPLOYEE']))).toEqual({ leave: null, leaveComplete: null, profile: null, myRejectedChanges: 2, myPendingChanges: 3, total: 2 });
    expect(leave.pendingApproval).not.toHaveBeenCalled();
    expect(changes.list).not.toHaveBeenCalled();
  });

  it('quản lý: chỉ tab đơn nghỉ, không gọi danh sách của HR', async () => {
    const { svc, leave } = setup({ mine: ['a', 'b', 'c'] });
    expect(await svc.counts(user(['EMPLOYEE', 'MANAGER']))).toMatchObject({ leave: 3, leaveComplete: null, profile: null, total: 3 });
    expect(leave.pendingHr).not.toHaveBeenCalled();
  });

  it('HR: đề nghị hủy nằm ở cả hai nguồn chỉ đếm một lần; chuông cộng mọi tab', async () => {
    const { svc } = setup({ mine: ['a', 'x'], hr: ['x', 'y'], approved: 4, pending: 2, rejected: 1 });
    expect(await svc.counts(user(['EMPLOYEE', 'HR']))).toMatchObject({ leave: 3, leaveComplete: 4, profile: 2, myRejectedChanges: 1, total: 10 });
  });

  it('danh sách dài hơn số dòng đọc thì cộng tổng hai nguồn', async () => {
    const { svc } = setup({ mine: ['a'], mineTotal: 150, hr: ['b'] });
    expect((await svc.counts(user(['HR']))).leave).toBe(151);
  });

  it('tài khoản chưa gắn hồ sơ: không có tab đơn nghỉ, không đếm yêu cầu của mình', async () => {
    const { svc, changes } = setup({ approved: 1 });
    expect(await svc.counts(user(['HR'], null))).toMatchObject({ leave: null, leaveComplete: 1, myRejectedChanges: 0, myPendingChanges: 0 });
    expect(changes.rejectedUnacknowledged).not.toHaveBeenCalled();
  });
});
