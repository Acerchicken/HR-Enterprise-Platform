import { useEffect, useState } from 'react';
import { api, Department, DirectoryEntry, Page, Position } from '../../api/client';
import { FieldDef, STATUS_OPTIONS } from './employee-fields';

export interface Lookups {
  departments: Department[];
  positions: Position[];
}

interface Props {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  lookups: Lookups;
  /** Gợi ý mặc định cho ô quản lý (trưởng phòng của phòng ban đang chọn). */
  suggestedManager?: DirectoryEntry | null;
  /** Người đang được sửa (không gợi ý chính họ làm quản lý). */
  selfId?: string;
}

/** Một ô nhập theo `type` của FieldDef. Loại input mới (vd upload file) chỉ cần thêm một nhánh ở đây. */
export function FieldInput({ field, value, onChange, error, lookups, suggestedManager, selfId }: Props) {
  const id = `f-${field.key}`;
  let input: JSX.Element;
  switch (field.type) {
    case 'select': {
      const options =
        field.options === 'departments'
          ? lookups.departments.map((d) => ({ value: d.id, label: `${d.name} (${d.code})` }))
          : field.options === 'positions'
            ? lookups.positions.map((p) => ({ value: p.id, label: p.title }))
            : STATUS_OPTIONS;
      input = (
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} required={field.required}>
          <option value="">— Chọn —</option>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
      break;
    }
    case 'employee':
      input = <EmployeePicker id={id} value={value} onChange={onChange} suggested={suggestedManager} excludeId={selfId} />;
      break;
    case 'money':
    case 'digits':
      input = (
        <input id={id} inputMode="numeric" value={value} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ''))} />
      );
      break;
    default:
      input = (
        <input id={id} type={field.type} value={value} placeholder={field.placeholder} required={field.required} onChange={(e) => onChange(e.target.value)} />
      );
  }
  return (
    <label htmlFor={id}>
      {field.label}{field.required ? ' *' : ''}
      {input}
      {error && <span className="error small"> {error}</span>}
    </label>
  );
}

/** Chọn nhân viên: gõ tên/email/mã để tìm trong danh bạ (đã loại người nghỉ việc). */
function EmployeePicker({ id, value, onChange, suggested, excludeId }: { id: string; value: string; onChange: (v: string) => void; suggested?: DirectoryEntry | null; excludeId?: string }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<DirectoryEntry[]>([]);
  const [selected, setSelected] = useState<DirectoryEntry | null>(null);

  useEffect(() => {
    if (!value) return setSelected(null);
    if (selected?.id === value) return;
    api<DirectoryEntry>(`/employees/${value}`).then(setSelected).catch(() => setSelected(null));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (q.trim().length < 2) return setItems([]);
    const t = setTimeout(() => {
      api<Page<DirectoryEntry>>(`/employees?q=${encodeURIComponent(q.trim())}&size=8`)
        .then((p) => setItems(p.items.filter((e) => e.id !== excludeId)))
        .catch(() => setItems([]));
    }, 300);
    return () => clearTimeout(t);
  }, [q, excludeId]);

  const pick = (e: DirectoryEntry) => {
    setSelected(e);
    onChange(e.id);
    setQ('');
    setItems([]);
  };

  return (
    <div className="picker">
      {selected ? (
        <p className="small">
          {selected.fullName} · {selected.positionTitle} · {selected.departmentName}{' '}
          <button type="button" className="link" onClick={() => { setSelected(null); onChange(''); }}>Bỏ chọn</button>
        </p>
      ) : (
        suggested && suggested.id !== excludeId && (
          <p className="small">
            Gợi ý: <button type="button" className="link" onClick={() => pick(suggested)}>{suggested.fullName} (trưởng phòng)</button>
          </p>
        )
      )}
      <input id={id} value={q} placeholder="Gõ tên, email hoặc mã để tìm quản lý…" onChange={(e) => setQ(e.target.value)} />
      {items.length > 0 && (
        <ul className="plain small">
          {items.map((e) => (
            <li key={e.id}>
              <button type="button" className="link" onClick={() => pick(e)}>{e.fullName}</button> · {e.positionTitle} · {e.departmentName}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
