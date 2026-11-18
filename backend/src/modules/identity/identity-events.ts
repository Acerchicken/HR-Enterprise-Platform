/**
 * Event của module Identity, ghi vào outbox chung (`leave.outbox`) trong cùng giao dịch (ADR-03, ADR-15).
 * Consumer `identity-sync` đồng bộ sang IdP (UC8 spec mục 9.2). Payload không có dữ liệu nhạy cảm.
 */
export const IDENTITY_EVENTS = [
  'RoleGranted',
  'RoleRevoked',
  'EmployeeCreated',
  'EmployeeTerminated',
  'EmployeeReinstated',
  'EmployeeEmailChanged',
  'AccountInviteRequested',
] as const;
export type IdentityEventType = (typeof IDENTITY_EVENTS)[number];

export interface RoleEventPayload {
  accountId: string;
  email: string;
  role: 'HR' | 'ADMIN';
}

export function isIdentityEvent(type: string): type is IdentityEventType {
  return (IDENTITY_EVENTS as readonly string[]).includes(type);
}
