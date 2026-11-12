/**
 * Nguồn mô tả trường hồ sơ duy nhất ở frontend. Form tạo/sửa của HR, trang chi tiết và form rút gọn "Hồ sơ của tôi" đều
 * render từ mảng này. Thêm một trường hồ sơ: xem checklist "Thêm một trường hồ sơ" trong docs/CONVENTIONS.md.
 *
 * `editableBy` phải khớp backend: SELF_EDITABLE trong backend/src/modules/employee/employee.dto.ts
 * (unit test employee-fields.spec.ts ở backend kiểm tra điều này).
 */
import type { components } from '../../api/schema';

export type CreateEmployeeBody = components['schemas']['CreateEmployeeDto'];
export type UpdateEmployeeBody = components['schemas']['UpdateEmployeeDto'];
export type FieldKey = keyof CreateEmployeeBody | 'status';

export type FieldType = 'text' | 'email' | 'tel' | 'date' | 'select' | 'employee' | 'money' | 'digits';
export type FieldGroup = 'basic' | 'work' | 'sensitive';
/** HR sửa mọi trường; SELF: nhân viên tự sửa trên hồ sơ của mình. */
export type Editor = 'HR' | 'SELF';

export interface FieldDef {
  key: FieldKey;
  label: string;
  group: FieldGroup;
  type: FieldType;
  required?: boolean;
  /** Trường nhạy cảm: mã hóa khi lưu, chỉ HR xem/sửa, audit chỉ ghi tên trường. */
  sensitive?: boolean;
  editableBy: Editor[];
  /** Hiện trên form tạo nhân viên. */
  showOnCreate: boolean;
  /** Không cho sửa sau khi tạo (vd mã, email đăng nhập). */
  createOnly?: boolean;
  /** Nguồn lựa chọn cho type `select`. */
  options?: 'departments' | 'positions' | 'statuses';
  placeholder?: string;
}

export const GROUP_LABEL: Record<FieldGroup, string> = {
  basic: 'Thông tin cơ bản',
  work: 'Công việc',
  sensitive: 'Thông tin nhạy cảm (chỉ HR)',
};

export const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Đang làm việc' },
  { value: 'ON_LEAVE', label: 'Đang nghỉ dài hạn' },
  { value: 'TERMINATED', label: 'Đã nghỉ việc' },
];

export const FIELDS: FieldDef[] = [
  { key: 'employeeCode', label: 'Mã nhân viên', group: 'basic', type: 'text', required: true, editableBy: ['HR'], showOnCreate: true, createOnly: true, placeholder: 'E02001' },
  { key: 'fullName', label: 'Họ tên', group: 'basic', type: 'text', required: true, editableBy: ['HR'], showOnCreate: true },
  { key: 'workEmail', label: 'Email công ty', group: 'basic', type: 'email', required: true, editableBy: ['HR'], showOnCreate: true, createOnly: true },
  { key: 'phone', label: 'Điện thoại', group: 'basic', type: 'tel', editableBy: ['HR', 'SELF'], showOnCreate: true },
  { key: 'dateOfBirth', label: 'Ngày sinh', group: 'basic', type: 'date', editableBy: ['HR'], showOnCreate: true },
  { key: 'address', label: 'Địa chỉ', group: 'basic', type: 'text', editableBy: ['HR', 'SELF'], showOnCreate: true },
  { key: 'departmentId', label: 'Phòng ban', group: 'work', type: 'select', options: 'departments', required: true, editableBy: ['HR'], showOnCreate: true },
  { key: 'positionId', label: 'Chức danh', group: 'work', type: 'select', options: 'positions', required: true, editableBy: ['HR'], showOnCreate: true },
  { key: 'managerId', label: 'Quản lý trực tiếp', group: 'work', type: 'employee', editableBy: ['HR'], showOnCreate: true },
  { key: 'hireDate', label: 'Ngày vào làm', group: 'work', type: 'date', required: true, editableBy: ['HR'], showOnCreate: true, createOnly: true },
  { key: 'status', label: 'Trạng thái', group: 'work', type: 'select', options: 'statuses', editableBy: ['HR'], showOnCreate: false },
  { key: 'nationalId', label: 'CCCD', group: 'sensitive', type: 'digits', sensitive: true, editableBy: ['HR'], showOnCreate: true, placeholder: '12 chữ số' },
  { key: 'bankAccount', label: 'Số tài khoản', group: 'sensitive', type: 'digits', sensitive: true, editableBy: ['HR'], showOnCreate: true },
  { key: 'salary', label: 'Lương tháng (VND)', group: 'sensitive', type: 'money', sensitive: true, editableBy: ['HR'], showOnCreate: true },
];

/** Trường hiện trên form theo chế độ và người sửa. */
export function formFields(mode: 'create' | 'edit', editor: Editor): FieldDef[] {
  return FIELDS.filter(
    (f) => f.editableBy.includes(editor) && (mode === 'create' ? f.showOnCreate : !f.createOnly),
  );
}
