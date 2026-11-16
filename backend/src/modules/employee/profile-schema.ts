/**
 * Mô tả trường của các mục nhân viên đề xuất được (UC1 spec mục 8, cột "Nhập" là NV). Một chỗ dùng cho: kiểm dữ liệu ở API,
 * tách phần nhạy cảm để mã hóa, và trả về cho giao diện dựng form (giao diện không tự khai lại trường).
 */
export type FieldType = 'text' | 'phone' | 'date' | 'month' | 'year' | 'select' | 'boolean' | 'digits' | 'upper';

export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** Bắt buộc khi trường khác có giá trị này, ví dụ mã số thuế khi là người phụ thuộc. */
  requiredIf?: { key: string; equals: unknown };
  /** Chỉ hiện và chỉ nhận khi trường khác có giá trị này. */
  showIf?: { key: string; equals: unknown };
  options?: { value: string; label: string }[];
  /** Mã hóa khi lưu, hiện `********` tới khi bấm mắt. */
  sensitive?: boolean;
  min?: number;
  max?: number;
  /** Ghi chú dưới ô nhập. */
  hint?: string;
}

/** main: trường chính của hồ sơ; single: mục có đúng một dòng; rows: nhiều dòng; files: mục chỉ gồm file (CV, ảnh đại diện). */
export type SectionKind = 'main' | 'single' | 'rows' | 'files';

export interface SectionSchema {
  kind: SectionKind;
  maxRows: number;
  fields: FieldSpec[];
  /** Câu nhắc ở đầu form (NFR-11: dữ liệu người thứ ba). */
  notice?: string;
}

const RELATIONS = ['Cha', 'Mẹ', 'Vợ', 'Chồng', 'Con', 'Anh chị em', 'Khác'].map((v) => ({ value: v, label: v }));
const LEVELS = ['Trung cấp', 'Cao đẳng', 'Đại học', 'Thạc sĩ', 'Tiến sĩ', 'Khác'].map((v) => ({ value: v, label: v }));
const BANKS = ['Vietcombank', 'VietinBank', 'BIDV', 'Agribank', 'Techcombank', 'MB', 'ACB', 'VPBank', 'TPBank', 'Sacombank', 'Khác'].map(
  (v) => ({ value: v, label: v }),
);

export const SECTION_SCHEMAS: Record<string, SectionSchema> = {
  cv: { kind: 'files', maxRows: 5, fields: [], notice: 'CV hoặc sơ yếu lý lịch: PDF, DOCX, JPG, PNG, tối đa 10 MiB mỗi file. Bản mới nhất hiện đầu.' },
  avatar: { kind: 'files', maxRows: 1, fields: [], notice: 'Ảnh JPG, PNG tối đa 2 MiB; ảnh được cắt về 512 × 512 và bỏ thông tin vị trí.' },
  personal: {
    kind: 'main',
    maxRows: 1,
    fields: [
      { key: 'phone', label: 'Điện thoại', type: 'phone' },
      { key: 'address', label: 'Địa chỉ', type: 'text', max: 255 },
    ],
  },
  'emergency-contacts': {
    kind: 'rows',
    maxRows: 3,
    fields: [
      { key: 'fullName', label: 'Họ tên', type: 'text', required: true, min: 2, max: 150 },
      { key: 'relation', label: 'Quan hệ', type: 'select', required: true, options: RELATIONS },
      { key: 'phone', label: 'Số điện thoại', type: 'phone', required: true },
      { key: 'phone2', label: 'Số điện thoại phụ', type: 'phone' },
    ],
  },
  relatives: {
    kind: 'rows',
    maxRows: 20,
    notice: 'Chỉ khai thân nhân khi cần cho giảm trừ gia cảnh hoặc liên hệ khẩn cấp.',
    fields: [
      { key: 'fullName', label: 'Họ tên', type: 'text', required: true, min: 2, max: 150 },
      { key: 'relation', label: 'Quan hệ', type: 'select', required: true, options: RELATIONS },
      { key: 'dateOfBirth', label: 'Ngày sinh', type: 'date', required: true },
      { key: 'occupation', label: 'Nghề nghiệp', type: 'text', max: 255 },
      { key: 'isDependent', label: 'Là người phụ thuộc (giảm trừ thuế)', type: 'boolean' },
      {
        key: 'taxId',
        label: 'Mã số thuế hoặc CCCD của người phụ thuộc',
        type: 'digits',
        sensitive: true,
        min: 10,
        max: 12,
        showIf: { key: 'isDependent', equals: true },
        requiredIf: { key: 'isDependent', equals: true },
      },
      { key: 'dependentFrom', label: 'Giảm trừ từ tháng', type: 'month', showIf: { key: 'isDependent', equals: true }, requiredIf: { key: 'isDependent', equals: true } },
      { key: 'dependentTo', label: 'Giảm trừ đến tháng', type: 'month', showIf: { key: 'isDependent', equals: true } },
    ],
  },
  qualifications: {
    kind: 'rows',
    maxRows: 30,
    fields: [
      { key: 'kind', label: 'Loại', type: 'select', required: true, options: [{ value: 'DEGREE', label: 'Bằng cấp' }, { value: 'CERTIFICATE', label: 'Chứng chỉ' }] },
      { key: 'level', label: 'Trình độ', type: 'select', options: LEVELS, showIf: { key: 'kind', equals: 'DEGREE' }, requiredIf: { key: 'kind', equals: 'DEGREE' } },
      { key: 'major', label: 'Chuyên ngành', type: 'text', max: 255, showIf: { key: 'kind', equals: 'DEGREE' } },
      { key: 'school', label: 'Trường', type: 'text', max: 255, showIf: { key: 'kind', equals: 'DEGREE' } },
      { key: 'graduationYear', label: 'Năm tốt nghiệp', type: 'year', min: 1950, showIf: { key: 'kind', equals: 'DEGREE' } },
      { key: 'certName', label: 'Tên chứng chỉ', type: 'text', max: 255, showIf: { key: 'kind', equals: 'CERTIFICATE' }, requiredIf: { key: 'kind', equals: 'CERTIFICATE' } },
      { key: 'issuer', label: 'Nơi cấp', type: 'text', max: 255, showIf: { key: 'kind', equals: 'CERTIFICATE' } },
      { key: 'issuedDate', label: 'Ngày cấp', type: 'date', showIf: { key: 'kind', equals: 'CERTIFICATE' } },
      { key: 'expiryDate', label: 'Ngày hết hạn', type: 'date', showIf: { key: 'kind', equals: 'CERTIFICATE' } },
    ],
  },
  'bank-account': {
    kind: 'single',
    maxRows: 1,
    notice: 'Chỉ một tài khoản nhận lương. Sau khi HR duyệt, bạn sẽ nhận email báo thông tin tài khoản đã thay đổi.',
    fields: [
      { key: 'bankName', label: 'Ngân hàng', type: 'select', required: true, options: BANKS },
      { key: 'branch', label: 'Chi nhánh', type: 'text', max: 255 },
      { key: 'accountNumber', label: 'Số tài khoản', type: 'digits', required: true, sensitive: true, min: 6, max: 20 },
      { key: 'holder', label: 'Chủ tài khoản', type: 'upper', required: true, max: 150, hint: 'Viết hoa không dấu, ví dụ NGUYEN VAN AN' },
    ],
  },
};

const PHONE = /^\+?[0-9 .-]{8,20}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

export interface Validated {
  data: Record<string, unknown>;
  sensitive: Record<string, string>;
  errors: Record<string, string>;
}

const empty = (v: unknown) => v === undefined || v === null || v === '';
const matches = (cond: { key: string; equals: unknown } | undefined, input: Record<string, unknown>) =>
  !cond || input[cond.key] === cond.equals;

/**
 * Kiểm dữ liệu đề xuất theo mô tả mục. Trường không khai trong mục bị bỏ (không lưu dữ liệu thừa, NFR-11.2). `partial`: cho
 * phép thiếu trường (sửa trường chính: chỉ gửi trường đổi).
 */
export function validateSection(code: string, input: Record<string, unknown>, today: string, partial = false): Validated {
  const schema = SECTION_SCHEMAS[code];
  const out: Validated = { data: {}, sensitive: {}, errors: {} };
  if (!schema) return { ...out, errors: { section: 'Mục này không cho nhân viên đề xuất' } };
  for (const f of schema.fields) {
    if (!matches(f.showIf, input)) continue;
    const raw = input[f.key];
    const required = f.required || (f.requiredIf && matches(f.requiredIf, input));
    if (empty(raw)) {
      if (required && !(partial && raw === undefined)) out.errors[f.key] = `${f.label} là bắt buộc`;
      else if (!partial || raw !== undefined) {
        if (!f.sensitive && raw !== undefined) out.data[f.key] = null;
      }
      continue;
    }
    const err = checkValue(f, raw, today);
    if (err) {
      out.errors[f.key] = err;
      continue;
    }
    const value = f.type === 'boolean' ? raw : f.type === 'year' ? Number(raw) : f.type === 'upper' ? String(raw).trim().toUpperCase() : String(raw).trim();
    if (f.sensitive) out.sensitive[f.key] = String(value);
    else out.data[f.key] = value;
  }
  // Ngày hết hạn chứng chỉ sau ngày cấp; giảm trừ đến tháng không trước từ tháng.
  if (out.data.issuedDate && out.data.expiryDate && String(out.data.expiryDate) <= String(out.data.issuedDate)) {
    out.errors.expiryDate = 'Ngày hết hạn phải sau ngày cấp';
  }
  if (out.data.dependentFrom && out.data.dependentTo && String(out.data.dependentTo) < String(out.data.dependentFrom)) {
    out.errors.dependentTo = 'Đến tháng phải sau từ tháng';
  }
  return out;
}

function checkValue(f: FieldSpec, raw: unknown, today: string): string | null {
  const s = String(raw).trim();
  switch (f.type) {
    case 'phone':
      return PHONE.test(s) ? null : 'Số điện thoại không hợp lệ';
    case 'date':
      if (!DATE.test(s) || Number.isNaN(Date.parse(s))) return 'Ngày không hợp lệ';
      return f.key === 'dateOfBirth' && s > today ? 'Ngày sinh không được ở tương lai' : null;
    case 'month':
      return MONTH.test(s) ? null : 'Tháng không hợp lệ (yyyy-mm)';
    case 'year': {
      const y = Number(s);
      const max = Number(today.slice(0, 4));
      return Number.isInteger(y) && y >= (f.min ?? 1900) && y <= max ? null : `Năm từ ${f.min ?? 1900} đến ${max}`;
    }
    case 'select':
      return f.options?.some((o) => o.value === s) ? null : `${f.label} không hợp lệ`;
    case 'boolean':
      return typeof raw === 'boolean' ? null : `${f.label} không hợp lệ`;
    case 'digits':
      if (!/^\d+$/.test(s)) return `${f.label} chỉ gồm chữ số`;
      if (f.key === 'taxId') return s.length === 10 || s.length === 12 ? null : 'Mã số thuế 10 số hoặc CCCD 12 số';
      return s.length >= (f.min ?? 1) && s.length <= (f.max ?? 50) ? null : `${f.label} từ ${f.min} đến ${f.max} chữ số`;
    case 'upper':
      if (!/^[A-Za-z ]+$/.test(s)) return 'Viết hoa không dấu, chỉ gồm chữ cái và khoảng trắng';
      return s.length <= (f.max ?? 255) ? null : `Tối đa ${f.max} ký tự`;
    default:
      if (f.min && s.length < f.min) return `${f.label} tối thiểu ${f.min} ký tự`;
      return s.length <= (f.max ?? 255) ? null : `${f.label} tối đa ${f.max ?? 255} ký tự`;
  }
}
