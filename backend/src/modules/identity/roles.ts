export const ROLES = ['EMPLOYEE', 'MANAGER', 'HR', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

/** Vai trò được cấp tay và lưu ở `iam.role_assignment`. EMPLOYEE, MANAGER luôn suy ra (ADR-10, ADR-18). */
export const GRANTED_ROLES: readonly Role[] = ['HR', 'ADMIN'];

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
