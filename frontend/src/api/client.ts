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
    /** Số liệu kèm lỗi, ví dụ 409 ngừng hoạt động đơn vị: {members, activeChildren} (UC2 E13). */
    public details?: Record<string, unknown>,
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
    throw new ApiError(res.status, body?.code ?? 'HTTP_ERROR', msg, body?.traceId, body?.fields, retry, body?.details);
  }
  return body as T;
}

// ----- Kiểu dữ liệu (khớp với backend) -----
export type Role = 'EMPLOYEE' | 'MANAGER' | 'HR' | 'ADMIN';

/** Vai trò cấp tay (UC8 FR-8.7); EMPLOYEE, MANAGER tự suy ra. */
export type AssignableRole = 'HR' | 'ADMIN';

/** `GET /admin/role-assignments` (UC8 spec 9.2). */
/** Tài khoản đăng nhập của một hồ sơ (UC8 FR-8.6, spec 9.2). `NONE`: hồ sơ chưa có tài khoản. */
export type AccountStatus = 'NONE' | 'PENDING' | 'INVITED' | 'ACTIVE' | 'DISABLED' | 'FAILED';
export interface AccountView {
  status: AccountStatus;
  email: string;
  invitedAt: string | null;
  lastLoginAt: string | null;
  syncedAt: string | null;
  error: string | null;
}

export interface RoleAssignment {
  userId: string;
  employeeId: string | null;
  fullName: string | null;
  email: string;
  departmentName: string | null;
  role: AssignableRole;
  grantedBy: { id: string; fullName: string | null } | null;
  grantedAt: string;
  reason: string | null;
}

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

/** Tên loại đơn vị, vai trò trưởng, phó và số phó tối đa theo loại (ADR-14, khớp backend unit-rules.ts). */
export const UNIT_LABEL: Record<UnitType, { name: string; head: string; deputy: string | null; maxDeputies: number }> = {
  COMPANY: { name: 'Công ty', head: 'Tổng Giám đốc', deputy: 'Phó Tổng Giám đốc', maxDeputies: 5 },
  CENTER: { name: 'Trung tâm', head: 'Giám đốc trung tâm', deputy: 'Phó Giám đốc trung tâm', maxDeputies: 3 },
  DEPARTMENT: { name: 'Phòng', head: 'Trưởng phòng', deputy: 'Phó phòng', maxDeputies: 3 },
  TEAM: { name: 'Nhóm', head: 'Trưởng nhóm', deputy: null, maxDeputies: 0 },
};

/** Loại cha hợp lệ (ADR-14). */
export const ALLOWED_PARENT: Record<UnitType, UnitType[]> = {
  COMPANY: [],
  CENTER: ['COMPANY'],
  DEPARTMENT: ['COMPANY', 'CENTER'],
  TEAM: ['DEPARTMENT'],
};

/** "Trưởng phòng" hoặc "Quyền Trưởng phòng" (FR-2.9). */
export function headLabel(type: UnitType, acting: boolean): string {
  return acting ? `Quyền ${UNIT_LABEL[type].head}` : UNIT_LABEL[type].head;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  office: string;
  unitType: UnitType;
  status: 'ACTIVE' | 'INACTIVE';
  parentId: string | null;
  headEmployeeId: string | null;
  headActing: boolean;
}

export interface Position {
  id: string;
  code: string;
  title: string;
  level: number;
  active: boolean;
  /** Chức danh hệ thống (CEO): chỉ đổi được tên (AC-2.6.3). */
  system: boolean;
  holderCount: number;
}

export interface UnitHead {
  id: string;
  fullName: string;
  acting: boolean;
}

export interface DepartmentNode extends Omit<Department, 'status' | 'headActing'> {
  head: UnitHead | null;
  memberCount: number;
  children: DepartmentNode[];
}

export interface DepartmentDetail extends Omit<DepartmentNode, 'children'> {
  status: 'ACTIVE' | 'INACTIVE';
  headActing: boolean;
  deputies: { id: string; fullName: string; positionTitle: string | null }[];
  path: { id: string; name: string; unitType: UnitType; headEmployeeId: string | null }[];
}

export interface LeaveBalance {
  leaveType: string;
  leaveTypeName: string;
  year: number;
  entitled: number;
  /** Phép năm chuyển từ năm trước, hết hạn 31/12 của `year` (AC-3.1.8). */
  carriedIn: number;
  used: number;
  pending: number;
  available: number;
  source: 'AUTO' | 'DEFAULT' | 'MANUAL';
  /** Chỉ HR thấy (FR-3.8). */
  baseDays?: number | null;
  note?: string | null;
  version?: number;
}

export type LeaveStatus = 'SUBMITTED' | 'PENDING_HR' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
/** Thao tác trên đơn; phần đuôi của `POST /leave-requests/{id}/<path>`. */
export type LeaveAction =
  | 'approve'
  | 'reject'
  | 'hr-approve'
  | 'hr-reject'
  | 'cancel'
  | 'cancel-request'
  | 'cancel-request/approve'
  | 'cancel-request/reject'
  | 'complete';

export interface LeaveType {
  id: string;
  code: string;
  name: string;
  quotaKind: 'ACCRUED' | 'YEARLY' | 'PER_EVENT';
  maxDaysPerEvent: number | null;
  maxMonthsPerEvent: number | null;
  requiresEventDate: boolean;
  requiresDocument: boolean;
  hrApproval: 'NEVER' | 'ALWAYS' | 'OVER_DAYS';
  hrApprovalMinDays: number | null;
}

export type LeaveHistoryAction =
  | 'SUBMIT' | 'APPROVE' | 'MANAGER_APPROVE' | 'HR_APPROVE' | 'REJECT' | 'HR_REJECT' | 'CANCEL' | 'CANCEL_REQUEST'
  | 'CANCEL_APPROVE' | 'CANCEL_REQUEST_REJECT' | 'COMPLETE' | 'RECALCULATE' | 'SYSTEM_CANCEL';

export interface LeaveHistory {
  action: LeaveHistoryAction;
  fromStatus: LeaveStatus | null;
  toStatus: LeaveStatus;
  actorId: string | null;
  actorName: string | null;
  comment: string | null;
  at: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string | null;
  createdBy: string;
  leaveType: string | null;
  leaveTypeName: string | null;
  startDate: string;
  endDate: string;
  halfDay: 'AM' | 'PM' | null;
  eventDate: string | null;
  days: number;
  allocations: { year: number; days: number }[];
  reason: string | null;
  /** Lý do nghỉ ốm, thai sản bị ẩn với người xem (BR-14). */
  reasonHidden: boolean;
  status: LeaveStatus;
  requiresHrApproval: boolean;
  approverId: string | null;
  cancelRequest: { requestedAt: string; requestedBy: string | null } | null;
  completableFrom: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  kind?: 'DECISION' | 'CANCEL_REQUEST';
  viaDelegation?: boolean;
  overdue?: boolean;
  history?: LeaveHistory[];
  canDecide?: boolean;
  canHrDecide?: boolean;
  canCancel?: boolean;
  canRequestCancel?: boolean;
  canConfirmCancel?: boolean;
  canComplete?: boolean;
}

export interface Holiday {
  date: string;
  name: string;
  kind: 'HOLIDAY' | 'COMPENSATORY';
}

export interface AffectedRequest {
  id: string;
  employeeId: string;
  employeeName: string | null;
  startDate: string;
  endDate: string;
  status: LeaveStatus;
  version: number;
  storedDays: number;
  recalculatedDays: number;
}

export interface Delegation {
  id: string;
  managerId: string;
  managerName: string | null;
  delegateId: string;
  delegateName: string | null;
  startDate: string;
  endDate: string;
  endedAt: string | null;
  active: boolean;
}

// ----- Điều chuyển (UC2 FR-2.7) -----

export type TransferReason = 'TRANSFER' | 'PROMOTION' | 'MANAGER_CHANGE' | 'CORRECTION';
export const TRANSFER_REASON_LABEL: Record<TransferReason, string> = {
  TRANSFER: 'Điều chuyển',
  PROMOTION: 'Thăng chức',
  MANAGER_CHANGE: 'Đổi quản lý',
  CORRECTION: 'Điều chỉnh (sửa nhầm)',
};

export interface Transfer {
  id: string;
  employeeId: string;
  status: 'SCHEDULED' | 'ACTIVE' | 'CLOSED' | 'CANCELLED' | 'FAILED';
  reason: TransferReason;
  effectiveDate: string;
  departmentId: string;
  departmentName: string | null;
  positionId: string;
  positionTitle: string | null;
  managerId: string | null;
  managerName: string | null;
  note: string | null;
  failureReason: string | null;
  reports: { employeeId: string; fullName: string | null; managerId: string | null; status: string }[];
  createdAt: string;
}

export interface TerminationImpact {
  activeReports: number;
  headRoles: { departmentId: string; name: string; role: 'HEAD' | 'DEPUTY' }[];
  scheduledTransfers: number;
  pendingAsNewManager: { transferId: string; employeeName: string; effectiveDate: string }[];
  grantedRoles: ('HR' | 'ADMIN')[];
  lastAdmin: boolean;
  /** Đơn nghỉ hệ thống sẽ hủy sau khi lưu (UC3 AC-3.1.7). */
  leave: { pending: number; approvedFuture: number };
}

/** Hôm nay theo giờ Việt Nam (khớp job điều chuyển phía server). */
export function vnToday(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}
