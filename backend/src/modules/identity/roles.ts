export const ROLES = ['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

/** Người dùng đã xác thực, gắn vào request sau khi AuthGuard kiểm tra token. */
export interface AuthUser {
  userId: string;
  subject: string;
  email: string;
  employeeId: string | null;
  roles: Role[];
}

export function hasRole(user: AuthUser, ...roles: Role[]): boolean {
  return roles.some((r) => user.roles.includes(r));
}
