import { X } from 'lucide-react';
import { FormEvent, useMemo, useRef, useState } from 'react';
import { ALLOWED_PARENT, api, ApiError, Department, DepartmentDetail, DirectoryEntry, headLabel, Page, UNIT_LABEL, UnitType } from '../../api/client';
import { useApi } from '../../api/useApi';
import { useDialog } from '../../components/useDialog';

type Field = 'name' | 'code' | 'office' | 'unitType' | 'parentId' | 'head' | 'deputies' | 'form';

/** Đoán ô bị lỗi từ câu báo 400/409 của API để hiện lỗi đúng ô (AC-2.4.5). */
function fieldOf(err: ApiError): Field {
  const m = err.message;
  if (err.status === 409 && /Mã/.test(m)) return 'code';
  if (/Phó|phó/.test(m)) return 'deputies';
  if (/Trưởng|trưởng/.test(m)) return 'head';
  if (/đặt dưới|đơn vị cha|gốc|vòng/.test(m)) return 'parentId';
  if (/loại/.test(m)) return 'unitType';
  return 'form';
}

function subtreeIds(all: Department[], id: string): Set<string> {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const d of all) if (d.parentId && out.has(d.parentId) && !out.has(d.id)) out.add(d.id), (grew = true);
  }
  return out;
}

/**
 * Form "Thêm đơn vị" và "Sửa đơn vị" (bản vẽ uc2-dept-edit, AC-2.4.5, AC-2.9.x). Nhãn trưởng, phó đổi theo loại đơn vị.
 * Danh sách chọn trưởng, phó: người của đơn vị và các đơn vị cha (kiêm nhiệm, AC-2.9.1).
 */
export function UnitFormDialog({
  unit,
  defaultParentId,
  units,
  onClose,
  onSaved,
}: {
  unit: DepartmentDetail | null;
  defaultParentId?: string;
  units: Department[];
  onClose: () => void;
  onSaved: (id: string | null) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useDialog(box, title, onClose);
  const editing = !!unit;
  const [v, setV] = useState({
    name: unit?.name ?? '',
    code: unit?.code ?? '',
    office: unit?.office ?? 'Hà Nội',
    unitType: (unit?.unitType ?? 'DEPARTMENT') as UnitType,
    parentId: unit?.parentId ?? defaultParentId ?? '',
    head: unit?.headEmployeeId ?? '',
    acting: unit?.headActing ?? false,
    deputies: unit?.deputies.map((d) => d.id) ?? [],
  });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [saving, setSaving] = useState(false);
  const label = UNIT_LABEL[v.unitType];

  const blocked = useMemo(() => (unit ? subtreeIds(units, unit.id) : new Set<string>()), [unit, units]);
  const parents = units.filter((d) => d.status === 'ACTIVE' && !blocked.has(d.id));
  // Người được chọn: đơn vị đang sửa (hoặc đơn vị cha khi tạo mới) và mọi đơn vị cha.
  const pickFrom = unit?.id ?? v.parentId;
  const people = useApi(
    () =>
      pickFrom
        ? api<Page<DirectoryEntry>>(`/employees?dept=${pickFrom}&includeAncestors=true&size=100`)
        : Promise.resolve({ items: [], page: 1, size: 100, total: 0 } as Page<DirectoryEntry>),
    [pickFrom],
  );
  const options = people.data?.items ?? [];
  const nameOf = (id: string) =>
    options.find((p) => p.id === id)?.fullName ?? unit?.deputies.find((d) => d.id === id)?.fullName ?? (id === unit?.head?.id ? unit.head.fullName : id);

  const set = <K extends keyof typeof v>(k: K) => (value: (typeof v)[K]) => setV((s) => ({ ...s, [k]: value }));

  // Lỗi luật cha con hiện ngay khi chọn (AC-2.4.8), server vẫn kiểm lại.
  const parentType = units.find((d) => d.id === v.parentId)?.unitType;
  const parentHint =
    v.parentId && parentType && !ALLOWED_PARENT[v.unitType].includes(parentType)
      ? `${label.name} chỉ đặt dưới ${ALLOWED_PARENT[v.unitType].map((t) => UNIT_LABEL[t].name).join(' hoặc ')}`
      : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setSaving(true);
    const body = {
      name: v.name.trim(),
      office: v.office.trim(),
      unitType: v.unitType,
      parentId: v.parentId || undefined,
      headEmployeeId: v.head || null,
      headActing: !!v.head && v.acting,
      deputyEmployeeIds: label.maxDeputies ? v.deputies : [],
      ...(editing ? {} : { code: v.code.trim().toUpperCase() }),
    };
    try {
      const saved = await api<Department>(editing ? `/departments/${unit!.id}` : '/departments', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      onSaved(saved.id);
    } catch (err) {
      const ae = err as ApiError;
      setErrors({ [ae instanceof ApiError ? fieldOf(ae) : 'form']: ae.message });
    } finally {
      setSaving(false);
    }
  }

  async function deactivate() {
    if (!unit) return;
    setErrors({});
    setSaving(true);
    try {
      await api(`/departments/${unit.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'INACTIVE' }) });
      onSaved(null);
    } catch (err) {
      setErrors({ form: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }

  const err = (f: Field) => errors[f] && <span className="field-error">{errors[f]}</span>;

  return (
    <div className="overlay" onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="unit-form-title" ref={box}>
        <form onSubmit={submit} noValidate>
          <div className="dialog-head">
            <h2 id="unit-form-title" tabIndex={-1} ref={title}>{editing ? 'Sửa đơn vị' : 'Thêm đơn vị'}</h2>
            <button type="button" className="icon-btn" aria-label="Đóng" onClick={onClose}><X size={18} /></button>
          </div>
          <div className="dialog-body form-grid">
            <label>
              Tên đơn vị *
              <input value={v.name} onChange={(e) => set('name')(e.target.value)} required aria-invalid={!!errors.name} />
              {err('name')}
            </label>
            <label>
              Mã{editing ? ' (không sửa sau khi tạo)' : ' *'}
              <input value={v.code} disabled={editing} onChange={(e) => set('code')(e.target.value.toUpperCase())} aria-invalid={!!errors.code} />
              {err('code')}
            </label>
            <label>
              Loại đơn vị *
              <select value={v.unitType} disabled={unit?.unitType === 'COMPANY'} onChange={(e) => set('unitType')(e.target.value as UnitType)}>
                {(['CENTER', 'DEPARTMENT', 'TEAM'] as UnitType[]).concat(unit?.unitType === 'COMPANY' ? ['COMPANY'] : []).map((t) => (
                  <option key={t} value={t}>{UNIT_LABEL[t].name}</option>
                ))}
              </select>
              {err('unitType')}
            </label>
            {unit?.unitType !== 'COMPANY' && (
              <label>
                Đơn vị cha *
                <select value={v.parentId} onChange={(e) => set('parentId')(e.target.value)} aria-invalid={!!(errors.parentId || parentHint)}>
                  <option value="">Chọn đơn vị cha</option>
                  {parents.map((d) => (
                    <option key={d.id} value={d.id}>{`${UNIT_LABEL[d.unitType].name} · ${d.name}`}</option>
                  ))}
                </select>
                {errors.parentId ? err('parentId') : parentHint && <span className="field-error">{parentHint}</span>}
              </label>
            )}
            <label>
              Văn phòng *
              <input value={v.office} onChange={(e) => set('office')(e.target.value)} />
              {err('office')}
            </label>
            <label className="span2">
              {label.head}
              <select value={v.head} onChange={(e) => set('head')(e.target.value)} aria-invalid={!!errors.head}>
                <option value="">Chưa có</option>
                {v.head && !options.some((p) => p.id === v.head) && <option value={v.head}>{nameOf(v.head)}</option>}
                {options.map((p) => (
                  <option key={p.id} value={p.id}>{`${p.fullName} · ${p.employeeCode}${p.departmentName ? ` · ${p.departmentName}` : ''}`}</option>
                ))}
              </select>
              {err('head')}
            </label>
            {v.head && (
              <label className="check span2">
                <input type="checkbox" checked={v.acting} onChange={(e) => set('acting')(e.target.checked)} />
                {headLabel(v.unitType, true)} (chưa bổ nhiệm chính thức)
              </label>
            )}
            {label.maxDeputies > 0 && (
              <div className="span2">
                <span className="label-text">{label.deputy} (tối đa {label.maxDeputies})</span>
                <div className="chips">
                  {v.deputies.map((id) => (
                    <span key={id} className="chip">
                      {nameOf(id)}
                      <button type="button" aria-label={`Bỏ ${nameOf(id)}`} onClick={() => set('deputies')(v.deputies.filter((x) => x !== id))}>×</button>
                    </span>
                  ))}
                  {v.deputies.length < label.maxDeputies && (
                    <select
                      aria-label={`Thêm ${label.deputy?.toLowerCase()}`}
                      value=""
                      onChange={(e) => e.target.value && set('deputies')([...v.deputies, e.target.value])}
                    >
                      <option value="">Thêm {label.deputy?.toLowerCase()}…</option>
                      {options
                        .filter((p) => p.id !== v.head && !v.deputies.includes(p.id))
                        .map((p) => (
                          <option key={p.id} value={p.id}>{`${p.fullName} · ${p.employeeCode}`}</option>
                        ))}
                    </select>
                  )}
                </div>
                {err('deputies')}
              </div>
            )}
            <p className="note span2">
              Chỉ chọn nhân viên đang làm việc trong đơn vị này hoặc đơn vị cha (kiêm nhiệm). Đổi trưởng, phó không tự đổi quản lý
              trực tiếp của ai; phó không tự có quyền duyệt (FR-2.9).
            </p>
            {err('form')}
          </div>
          <div className="dialog-foot">
            {editing && unit!.unitType !== 'COMPANY' && (
              <button type="button" className="danger" disabled={saving} onClick={deactivate} style={{ marginRight: 'auto' }}>
                Ngừng hoạt động
              </button>
            )}
            <button type="button" onClick={onClose}>Hủy</button>
            <button type="submit" className="primary" disabled={saving || !!parentHint}>Lưu</button>
          </div>
        </form>
      </div>
    </div>
  );
}
