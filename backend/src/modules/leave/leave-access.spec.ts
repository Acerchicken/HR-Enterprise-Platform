import { AuthUser } from '../identity/roles';
import { allowed, canCreateFor, canSeeReason, canView, relation, RequestFacts } from './leave-access';

const user = (employeeId: string | null, ...roles: AuthUser['roles']): AuthUser => ({ userId: 'u', subject: 's', email: 'e', employeeId, roles: ['EMPLOYEE', ...roles] });
const facts = (over: Partial<RequestFacts> = {}): RequestFacts => ({
  ownerId: 'a',
  ownerManagerId: 'm',
  ownerIsCeo: false,
  activeDelegateIds: [],
  requiresHrApproval: false,
  ...over,
});
const can = (who: AuthUser, action: Parameters<typeof allowed>[0], f = facts()) => allowed(action, relation(who, f), f);

describe('leave access (UC4 13.7)', () => {
  const owner = user('a');
  const manager = user('m', 'MANAGER');
  const delegate = user('d', 'MANAGER');
  const hr = user('h', 'HR');
  const other = user('x', 'MANAGER');

  it('xem chi tiết: chủ đơn, quản lý trực tiếp, người duyệt thay, HR; người khác (gián tiếp, phó, ADMIN) 403', () => {
    const f = facts({ activeDelegateIds: ['d'] });
    for (const who of [owner, manager, delegate, hr]) expect(canView(relation(who, f))).toBe(true);
    expect(canView(relation(other, f))).toBe(false);
    expect(canView(relation(user('z', 'ADMIN'), f))).toBe(false);
  });

  it('BR-05, BR-06: quản lý trực tiếp, người duyệt thay duyệt; HR chỉ đơn của CEO', () => {
    expect(can(manager, 'approve')).toBe(true);
    expect(can(delegate, 'approve', facts({ activeDelegateIds: ['d'] }))).toBe(true);
    expect(can(delegate, 'approve')).toBe(false);
    expect(can(hr, 'approve')).toBe(false);
    expect(can(hr, 'approve', facts({ ownerIsCeo: true, ownerManagerId: null }))).toBe(true);
    expect(can(owner, 'approve')).toBe(false);
  });

  it('BR-16: HR duyệt thêm nhưng không duyệt đơn của chính mình (AC-4.8.5)', () => {
    expect(can(hr, 'hrApprove')).toBe(true);
    expect(can(manager, 'hrApprove')).toBe(false);
    expect(can(user('a', 'HR'), 'hrApprove')).toBe(false);
  });

  it('hủy, đề nghị hủy: chỉ chủ đơn', () => {
    expect(can(owner, 'cancel')).toBe(true);
    expect(can(manager, 'cancel')).toBe(false);
    expect(can(hr, 'cancelRequest')).toBe(false);
  });

  it('xác nhận đề nghị hủy: quản lý, người duyệt thay, HR; đơn đã qua HR thì chỉ HR (AC-4.5.6)', () => {
    expect(can(manager, 'cancelRequestApprove')).toBe(true);
    expect(can(hr, 'cancelRequestApprove')).toBe(true);
    expect(can(manager, 'cancelRequestApprove', facts({ requiresHrApproval: true }))).toBe(false);
    expect(can(hr, 'cancelRequestApprove', facts({ requiresHrApproval: true }))).toBe(true);
    expect(can(owner, 'cancelRequestReject')).toBe(false);
  });

  it('hoàn tất, tính lại: HR không phải chủ đơn', () => {
    expect(can(hr, 'complete')).toBe(true);
    expect(can(manager, 'complete')).toBe(false);
    expect(can(user('a', 'HR'), 'recalculate')).toBe(false);
  });

  it('BR-14: lý do nghỉ ốm chỉ chủ đơn và HR', () => {
    expect(canSeeReason(relation(manager, facts()), 'SICK')).toBe(false);
    expect(canSeeReason(relation(hr, facts()), 'SICK')).toBe(true);
    expect(canSeeReason(relation(owner, facts()), 'MATERNITY')).toBe(true);
    expect(canSeeReason(relation(manager, facts()), 'ANNUAL')).toBe(true);
  });

  it('BR-12: tạo đơn hộ', () => {
    expect(canCreateFor(hr, 'a', 'm')).toBe(true);
    expect(canCreateFor(manager, 'a', 'm')).toBe(true);
    expect(canCreateFor(other, 'a', 'm')).toBe(false);
  });
});
