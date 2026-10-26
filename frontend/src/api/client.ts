import { getToken } from '../auth/auth';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public traceId?: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body) headers.set('Content-Type', 'application/json');

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const msg = Array.isArray(body?.message) ? body.message.join('; ') : (body?.message ?? res.statusText);
    throw new ApiError(res.status, body?.code ?? 'HTTP_ERROR', msg, body?.traceId);
  }
  return body as T;
}

// ----- Kiểu dữ liệu (khớp với backend) -----
export type Role = 'EMPLOYEE' | 'MANAGER' | 'HR' | 'ADMIN';

export interface DirectoryEntry {
  id: string;
  employeeCode: string;
  fullName: string;
  workEmail: string;
  phone: string | null;
  departmentId: string;
  departmentName: string | null;
  positionTitle: string | null;
  managerId: string | null;
  managerName: string | null;
}

export interface EmployeeProfile extends DirectoryEntry {
  visibility: 'PUBLIC' | 'PERSONAL' | 'HR';
  dateOfBirth?: string | null;
  address?: string | null;
  hireDate?: string;
  status?: string;
  version?: number;
  sensitive?: { nationalId: string | null; bankAccount: string | null; salary: string | null };
}

export interface Me {
  email: string;
  roles: Role[];
  employee: EmployeeProfile | null;
}

export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  office: string;
  parentId: string | null;
  headEmployeeId: string | null;
}

export interface DepartmentNode extends Department {
  children: DepartmentNode[];
}

export interface LeaveBalance {
  leaveType: string;
  leaveTypeName: string;
  year: number;
  entitled: number;
  used: number;
  pending: number;
  available: number;
}
