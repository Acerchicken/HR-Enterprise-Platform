import { ChangeRequest, FieldSpec, MaskedField } from '../api/client';
import { formatDate, formatMoney } from '../components/ui';

/** Trường có hiện với dữ liệu này không (`showIf` trong mô tả mục của API). */
export const visible = (f: FieldSpec, values: Record<string, unknown>) => !f.showIf || values[f.showIf.key] === f.showIf.equals;

/** Giá trị để hiện (không phải form). Trường nhạy cảm hiện riêng bằng MaskedValue. */
export function formatValue(f: FieldSpec, v: unknown): string {
  if (v === undefined || v === null || v === '') return '—';
  if (f.type === 'boolean') return v ? 'Có' : 'Không';
  if (f.type === 'money') return formatMoney(String(v));
  if (f.type === 'date') return formatDate(String(v));
  if (f.type === 'month') {
    const [y, m] = String(v).split('-');
    return `${m}/${y}`;
  }
  if (f.type === 'select') return f.options?.find((o) => o.value === v)?.label ?? String(v);
  return String(v);
}

/** Một ô nhập dựng từ mô tả trường. Lỗi hiện dưới đúng ô theo `fields` của response 400 (frontend.md mục 6). */
export function FieldEditor({
  field,
  value,
  onChange,
  error,
  sensitiveHint,
}: {
  field: FieldSpec;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
  /** Trường nhạy cảm đang có giá trị: để trống là giữ nguyên. */
  sensitiveHint?: boolean;
}) {
  const id = `pf-${field.key}`;
  const label = (
    <>
      {field.label}
      {field.required && <span className="req"> *</span>}
    </>
  );
  let input: JSX.Element;
  if (field.type === 'boolean') {
    return (
      <label className="check" htmlFor={id}>
        <input id={id} type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} /> {field.label}
      </label>
    );
  }
  if (field.type === 'select') {
    input = (
      <select id={id} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error}>
        <option value="">— Chọn —</option>
        {field.options?.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  } else {
    const type = field.type === 'date' ? 'date' : field.type === 'month' ? 'month' : field.type === 'year' ? 'number' : field.type === 'phone' ? 'tel' : 'text';
    const numeric = field.type === 'digits' || field.type === 'year' || field.type === 'money';
    input = (
      <input
        id={id}
        type={type}
        inputMode={numeric ? 'numeric' : undefined}
        value={String(value ?? '')}
        maxLength={field.type === 'text' || field.type === 'upper' ? field.max : undefined}
        placeholder={sensitiveHint ? 'Để trống là giữ nguyên' : undefined}
        onChange={(e) => onChange(field.type === 'upper' ? e.target.value.toUpperCase() : e.target.value)}
        aria-invalid={!!error}
      />
    );
  }
  return (
    <label htmlFor={id}>
      {label}
      {input}
      {field.hint && <span className="small muted">{field.hint}</span>}
      {error && <span className="error small">{error}</span>}
    </label>
  );
}

const ACTION_LABEL: Record<string, string> = { CREATE: 'Thêm', UPDATE: 'Sửa', DELETE: 'Xóa' };

/** Khung "Đang chờ HR xác nhận" hoặc "HR đã từ chối" của một yêu cầu (AC-1.9.2, spec 9.1). */
export function RequestBox({
  req,
  fields,
  onCancel,
  onDismiss,
}: {
  req: ChangeRequest;
  fields: FieldSpec[];
  onCancel?: () => void;
  onDismiss?: () => void;
}) {
  const rejected = req.status === 'REJECTED';
  const shown = fields.filter((f) => f.key in req.proposed || f.key in req.proposedSensitive);
  return (
    <div className={rejected ? 'req-box rejected' : 'req-box'}>
      <b>{rejected ? 'HR đã từ chối yêu cầu' : 'Đang chờ HR xác nhận'}</b> · {ACTION_LABEL[req.action]}
      {req.action !== 'DELETE' && (
        <ul className="plain small">
          {shown.map((f) => (
            <li key={f.key}>
              <span className="muted">{f.label}:</span>{' '}
              {f.sensitive ? '********' : formatValue(f, req.proposed[f.key])}
            </li>
          ))}
        </ul>
      )}
      {req.files && req.files.length > 0 && (
        <ul className="plain small">
          {req.files.map((f) => (
            <li key={f.id}><span className="muted">{req.action === 'DELETE' ? 'Xóa file' : 'File'}:</span> {f.name}</li>
          ))}
        </ul>
      )}
      {rejected && req.rejectReason && <p className="small">Lý do: {req.rejectReason}</p>}
      <div className="actions">
        {!rejected && onCancel && <button type="button" onClick={onCancel}>Hủy yêu cầu</button>}
        {rejected && onDismiss && <button type="button" onClick={onDismiss}>Đóng</button>}
      </div>
    </div>
  );
}

export const masked = (m: MaskedField | undefined) => (m?.hasValue ? '********' : '—');

/** Khóa cho header Idempotency-Key: mỗi lần mở form một khóa, gửi lại cùng form thì dùng lại (AC-1.9.12). */
export const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
