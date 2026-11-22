import { Department, Role, UNIT_LABEL } from '../../api/client';
import { DocumentScope, SCOPE_ROLES } from '../../api/documents';

/** Đơn vị sắp theo cây (cha trước con), kèm độ sâu để thụt lề trong ô chọn. */
function treeOrder(units: Department[]): { unit: Department; depth: number }[] {
  const out: { unit: Department; depth: number }[] = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const u of units.filter((x) => x.parentId === parentId).sort((a, b) => a.name.localeCompare(b.name, 'vi'))) {
      out.push({ unit: u, depth });
      visit(u.id, depth + 1);
    }
  };
  visit(null, 0);
  return out;
}

/**
 * Chọn phạm vi xem (DR-02, bản vẽ uc5-upload): toàn công ty, và/hoặc đơn vị (gồm đơn vị con), và/hoặc vai trò; khớp một trong
 * các phạm vi là được xem. Chỉ chọn thêm được đơn vị đang hoạt động; đơn vị đã ngừng có sẵn trong phạm vi cũ vẫn giữ (D3).
 */
export function ScopePicker({
  value,
  onChange,
  units,
  inactiveNames = {},
  error,
}: {
  value: DocumentScope;
  onChange: (s: DocumentScope) => void;
  /** Mọi đơn vị (`GET /departments`). */
  units: Department[];
  /** Tên đơn vị đã ngừng hoạt động đang có trong phạm vi (từ `scope.departments` của trang quản lý). */
  inactiveNames?: Record<string, string>;
  error?: string;
}) {
  const active = units.filter((u) => u.status === 'ACTIVE');
  const nameOf = (id: string) => units.find((u) => u.id === id)?.name ?? inactiveNames[id] ?? 'Đơn vị không còn';
  const isInactive = (id: string) => !active.some((u) => u.id === id);
  const toggleRole = (r: Role) =>
    onChange({ ...value, roles: value.roles.includes(r) ? value.roles.filter((x) => x !== r) : [...value.roles, r] });

  return (
    <fieldset className="scope-picker" aria-invalid={!!error}>
      <legend>Phạm vi xem * <span className="muted small">(người khớp một trong các phạm vi thì xem được)</span></legend>
      <label className="check">
        <input type="checkbox" checked={value.all} onChange={(e) => onChange({ ...value, all: e.target.checked })} />
        Toàn công ty
      </label>

      <div className="chips" aria-label="Đơn vị được xem">
        {value.departmentIds.map((id) => (
          <span key={id} className={`chip ${isInactive(id) ? 'inactive' : ''}`}>
            {nameOf(id)} (gồm đơn vị con){isInactive(id) && ' · đã ngừng hoạt động'}
            <button
              type="button"
              aria-label={`Bỏ ${nameOf(id)}`}
              onClick={() => onChange({ ...value, departmentIds: value.departmentIds.filter((x) => x !== id) })}
            >
              ×
            </button>
          </span>
        ))}
        <select
          aria-label="Thêm đơn vị"
          value=""
          onChange={(e) => e.target.value && onChange({ ...value, departmentIds: [...value.departmentIds, e.target.value] })}
        >
          <option value="">+ Thêm đơn vị…</option>
          {treeOrder(active)
            .filter(({ unit }) => !value.departmentIds.includes(unit.id))
            .map(({ unit, depth }) => (
              <option key={unit.id} value={unit.id}>
                {'  '.repeat(depth)}{unit.name} ({UNIT_LABEL[unit.unitType].name})
              </option>
            ))}
        </select>
      </div>

      <div className="scope-roles" role="group" aria-label="Vai trò được xem">
        {SCOPE_ROLES.map(({ role, label, hint }) => (
          <label key={role} className="check">
            <input type="checkbox" checked={value.roles.includes(role)} onChange={() => toggleRole(role)} />
            {label}
            {hint && <span className="muted small"> ({hint})</span>}
          </label>
        ))}
      </div>
      {error && <span className="field-error">{error}</span>}
    </fieldset>
  );
}
