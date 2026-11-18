import { getToken } from '../auth/auth';

export const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';
const BASE = BASE_URL;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public traceId?: string,
    /** Lỗi validation theo từng trường (tên trường → lỗi), để form hiện lỗi đúng ô. */
    public fields?: Record<string, string>,
    /** 429: số giây phải chờ (header Retry-After), để khóa nút gửi (frontend.md mục 6). */
    public retryAfter?: number,
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
    const retry = Number(res.headers.get('Retry-After')) || undefined;
    throw new ApiError(res.status, body?.code ?? 'HTTP_ERROR', msg, body?.traceId, body?.fields, retry);
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
  positionId: string;
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

/** `GET /me`: chỉ tài khoản, vai trò, mã và tên hồ sơ (UC1 AC-1.8.7). Dữ liệu hồ sơ lấy qua `summary`. */
export interface Me {
  email: string;
  roles: Role[];
  employee: { id: string; employeeCode: string; fullName: string } | null;
}

// ----- Trang hồ sơ theo mục (UC1 spec 9.1) -----
export type Relation = 'HR' | 'OWNER' | 'MANAGER' | 'OTHER';
export type SectionGroup = 'personal' | 'work' | 'finance' | 'benefits' | 'other';

export interface SectionSummary {
  code: string;
  group: SectionGroup;
  title: string;
  available: boolean;
  pendingRequests: number;
}

export interface ProfileSummary {
  id: string;
  employeeCode: string;
  fullName: string;
  positionTitle: string | null;
  departmentId: string;
  departmentName: string | null;
  managerId: string | null;
  managerName: string | null;
  phone: string | null;
  workEmail: string;
  relation: Relation;
  canEdit: boolean;
  hasAvatar: boolean;
  /** Không có ở mức danh bạ; null là chưa có dữ liệu hợp đồng. */
  contractType?: string | null;
  sections: SectionSummary[];
}

export interface MaskedField {
  hasValue: boolean;
  value: string | null;
}

export interface PersonalSection {
  section: 'personal';
  version: number;
  phone: string | null;
  workEmail: string;
  address: string | null;
  dateOfBirth: string | null;
  hireDate: string;
  status: string;
  nationalId?: MaskedField;
  relation: Relation;
  fields: FieldSpec[];
  canPropose: boolean;
  requests: ChangeRequest[];
}
export interface SalarySection { section: 'salary'; salary: MaskedField }

// ----- Yêu cầu cập nhật hồ sơ (UC1 FR-1.9) -----
export type FieldType = 'text' | 'phone' | 'date' | 'month' | 'year' | 'select' | 'boolean' | 'digits' | 'upper' | 'money';
export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  requiredIf?: { key: string; equals: unknown };
  showIf?: { key: string; equals: unknown };
  options?: { value: string; label: string }[];
  sensitive?: boolean;
  min?: number;
  max?: number;
  hint?: string;
  hrOnly?: boolean;
  requiredUnless?: { key: string; equals: unknown };
}
export type ChangeAction = 'CREATE' | 'UPDATE' | 'DELETE';
export interface ChangeRequest {
  id: string;
  employeeId: string;
  section: string;
  action: ChangeAction;
  itemId: string | null;
  baseVersion: number | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  proposed: Record<string, unknown>;
  proposedSensitive: Record<string, MaskedField>;
  submittedAt: string;
  reviewedAt: string | null;
  rejectReason?: string | null;
  fileIds: string[];
  files?: import('../components/files').FileView[];
}
export interface ProfileRow {
  id: string | null;
  version: number;
  data: Record<string, unknown>;
  sensitive: Record<string, MaskedField>;
  files?: import('../components/files').FileView[];
}
export interface RowSection {
  section: string;
  kind: 'single' | 'rows' | 'files';
  maxRows: number;
  notice: string | null;
  fields: FieldSpec[];
  canPropose: boolean;
  canEdit: boolean;
  rows: ProfileRow[];
  files?: import('../components/files').FileView[];
  requests: ChangeRequest[];
  /** Lương, lương đóng BHXH: mức đang hiệu lực. */
  current?: MaskedField;
  currentEffectiveDate?: string | null;
  /** Thuế TNCN: số người phụ thuộc đang giảm trừ. */
  dependents?: number;
}
export interface ChangeListItem extends ChangeRequest {
  employeeName: string;
  employeeCode: string;
  departmentName: string | null;
  overdue: boolean;
}
export interface ChangeDetail extends ChangeRequest {
  employee: { id: string; fullName: string; employeeCode: string; departmentName: string | null };
  fields: FieldSpec[];
  current: Record<string, unknown>;
  currentSensitive: Record<string, MaskedField>;
  overdue: boolean;
}
export interface HistoryEntry {
  at: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  section: string | null;
  fields: string[];
}

export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  total: number;
}

export type UnitType = 'COMPANY' | 'CENTER' | 'DEPARTMENT' | 'TEAM';

/** Tên loại đơn vị và vai trò trưởng theo loại (ADR-14). */
export const UNIT_LABEL: Record<UnitType, { name: string; head: string }> = {
  COMPANY: { name: 'Công ty', head: 'Tổng Giám đốc' },
  CENTER: { name: 'Trung tâm', head: 'Giám đốc trung tâm' },
  DEPARTMENT: { name: 'Phòng', head: 'Trưởng phòng' },
  TEAM: { name: 'Nhóm', head: 'Trưởng nhóm' },
};

export interface Department {
  id: string;
  code: string;
  name: string;
  office: string;
  unitType: UnitType;
  status: 'ACTIVE' | 'INACTIVE';
  parentId: string | null;
  headEmployeeId: string | null;
}

export interface Position {
  id: string;
  code: string;
  title: string;
}

export interface DepartmentNode extends Omit<Department, 'status'> {
  head: { id: string; fullName: string } | null;
  memberCount: number;
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

export type LeaveStatus = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
export type LeaveAction = 'approve' | 'reject' | 'cancel' | 'complete';

export interface LeaveType {
  id: string;
  code: string;
  name: string;
  maxDaysPerYear: string;
}

export interface LeaveHistory {
  fromStatus: LeaveStatus | null;
  toStatus: LeaveStatus;
  actorId: string;
  actorName: string | null;
  comment: string | null;
  at: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string | null;
  leaveType: string | null;
  startDate: string;
  endDate: string;
  halfDay: 'AM' | 'PM' | null;
  days: number;
  reason: string | null;
  status: LeaveStatus;
  approverId: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  history?: LeaveHistory[];
  /** Có ở API xem chi tiết: người gọi được duyệt/từ chối đơn này. */
  canDecide?: boolean;
}
