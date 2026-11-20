import { ArrowLeftRight, X } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  ApiError,
  Department,
  DirectoryEntry,
  EmployeeProfile,
  Page,
  Position,
  Transfer,
  TRANSFER_REASON_LABEL,
  TransferReason,
  UNIT_LABEL,
  vnToday,
} from '../../api/client';
import { useApi } from '../../api/useApi';
import { formatDate } from '../../components/ui';
import { useDialog } from '../../components/useDialog';

const EMPTY: Page<DirectoryEntry> = { items: [], page: 1, size: 100, total: 0 };
const pickList = (deptId: string | undefined) =>
  deptId ? api<Page<DirectoryEntry>>(`/employees?dept=${deptId}&includeAncestors=true&size=100`) : Promise.resolve(EMPTY);

function chain(units: Department[], id: string): string[] {
  const byId = new Map(units.map((u) => [u.id, u]));
  const out: string[] = [];
  for (let u = byId.get(id); u && !out.includes(u.id); u = u.parentId ? byId.get(u.parentId) : undefined) out.push(u.id);
  return out;
}

/** Trưởng gần nhất từ đơn vị đi lên (gợi ý quản lý mới, AC-2.9.2), bỏ qua chính người được điều chuyển. */
function suggestedHead(units: Department[], deptId: string, self: string): string | null {
  const byId = new Map(units.map((u) => [u.id, u]));
  for (const id of chain(units, deptId)) {
    const h = byId.get(id)?.headEmployeeId;
    if (h && h !== self) return h;
  }
  return null;
}

/**
 * Điều chuyển có ngày hiệu lực (bản vẽ uc2-transfer, uc2-transfer-reports; UC2 FR-2.7). Chỉ HR. Hiệu lực hôm nay đổi ngay;
 * ngày sau là "Sắp hiệu lực", job áp dụng lúc 00:05 ngày đó. Còn cấp dưới thì chọn giữ hay đổi quản lý cho từng người (AC-2.7.6);
 * đang làm trưởng đơn vị mà rời đơn vị thì chọn trưởng mới (AC-2.7.5).
 */
export function TransferDialog({ employeeId, onClose, onSaved }: { employeeId: string; onClose: () => void; onSaved: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useDialog(box, title, onClose);

  const emp = useApi(() => api<EmployeeProfile>(`/employees/${employeeId}`), [employeeId]);
  const units = useApi(() => api<Department[]>('/departments'), []);
  const positions = useApi(() => api<Position[]>('/positions?active=true'), []);
  const reports = useApi(() => api<DirectoryEntry[]>(`/employees/${employeeId}/direct-reports`), [employeeId]);
  const transfers = useApi(() => api<Transfer[]>(`/employees/${employeeId}/transfers`), [employeeId]);
  const e = emp.data;
  const all = units.data ?? [];

  const [v, setV] = useState({ departmentId: '', positionId: '', managerId: '', effectiveDate: vnToday(), reason: 'TRANSFER' as TransferReason, note: '' });
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [heads, setHeads] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (e) setV((s) => ({ ...s, departmentId: e.departmentId, positionId: e.positionId, managerId: e.managerId ?? '' }));
  }, [e]);
  const managers = useApi(() => pickList(v.departmentId), [v.departmentId]);
  const oldPeople = useApi(() => pickList(e?.departmentId), [e?.departmentId]);
  const oldHead = e ? suggestedHead(all, e.departmentId, employeeId) : null;

  // Đổi đơn vị thì điền sẵn quản lý là trưởng gần nhất của đơn vị mới (HR đổi được).
  function setDept(id: string) {
    setV((s) => ({ ...s, departmentId: id, managerId: suggestedHead(all, id, employeeId) ?? s.managerId }));
  }
  const brokenHeads = useMemo(
    () => (e && v.departmentId ? all.filter((u) => u.headEmployeeId === employeeId && !chain(all, u.id).includes(v.departmentId)) : []),
    [all, e, v.departmentId, employeeId],
  );
  const reportList = reports.data ?? [];
  const unchosen = reportList.filter((r) => !choices[r.id]).length;
  const scheduled = (transfers.data ?? []).find((t) => t.status === 'SCHEDULED');
  const future = v.effectiveDate > vnToday();

  async function cancelScheduled() {
    if (!scheduled) return;
    try {
      await api(`/employees/${employeeId}/transfers/${scheduled.id}`, { method: 'DELETE' });
      transfers.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setErrors({});
    setError(null);
    setSaving(true);
    try {
      await api<Transfer>(`/employees/${employeeId}/transfers`, {
        method: 'POST',
        body: JSON.stringify({
          ...v,
          managerId: v.managerId || null,
          note: v.note.trim() || undefined,
          reports: reportList.map((r) => ({ employeeId: r.id, managerId: choices[r.id] })),
          newHeads: brokenHeads.map((u) => ({ departmentId: u.id, employeeId: heads[u.id] || null })),
        }),
      });
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.fields) setErrors(err.fields);
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const fe = (k: string) => errors[k] && <span className="field-error">{errors[k]}</span>;
  const nameOf = (id: string | null | undefined) => (id ? [...(managers.data?.items ?? []), ...(oldPeople.data?.items ?? [])].find((p) => p.id === id)?.fullName : null);

  return (
    <div className="overlay" onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div className="dialog wide" role="dialog" aria-modal="true" aria-labelledby="transfer-title" ref={box}>
        <form onSubmit={submit} noValidate>
          <div className="dialog-head">
            <h2 id="transfer-title" tabIndex={-1} ref={title}>
              <ArrowLeftRight size={18} /> Điều chuyển{e ? `: ${e.fullName}` : ''}
            </h2>
            <button type="button" className="icon-btn" aria-label="Đóng" onClick={onClose}><X size={18} /></button>
          </div>
          <div className="dialog-body">
            {e && (
              <p className="muted small" style={{ marginTop: 0 }}>
                Hiện tại: {e.positionTitle} · {e.departmentName} · quản lý {e.managerName ?? '—'}
              </p>
            )}
            {scheduled ? (
              <div className="note warn">
                <b>Đã có điều chuyển chưa hiệu lực</b> sang {scheduled.departmentName} · {scheduled.positionTitle} từ {formatDate(scheduled.effectiveDate)}.
                Mỗi người chỉ một điều chuyển chờ; hủy điều chuyển đó để tạo mới.{' '}
                <button type="button" className="link" onClick={cancelScheduled}>Hủy điều chuyển</button>
              </div>
            ) : (
              <div className="form-grid">
                <label>
                  Đơn vị mới *
                  <select value={v.departmentId} onChange={(ev) => setDept(ev.target.value)} aria-invalid={!!errors.departmentId}>
                    {all.filter((u) => u.status === 'ACTIVE').map((u) => (
                      <option key={u.id} value={u.id}>{`${UNIT_LABEL[u.unitType].name} · ${u.name}`}</option>
                    ))}
                  </select>
                  {fe('departmentId')}
                </label>
                <label>
                  Chức danh mới *
                  <select value={v.positionId} onChange={(ev) => setV({ ...v, positionId: ev.target.value })} aria-invalid={!!errors.positionId}>
                    {e && !(positions.data ?? []).some((p) => p.id === e.positionId) && <option value={e.positionId}>{e.positionTitle}</option>}
                    {(positions.data ?? []).map((p) => (
                      <option key={p.id} value={p.id}>{`${p.title} · cấp ${p.level}`}</option>
                    ))}
                  </select>
                  {fe('positionId')}
                </label>
                <label>
                  Quản lý trực tiếp mới *
                  <select value={v.managerId} onChange={(ev) => setV({ ...v, managerId: ev.target.value })} aria-invalid={!!errors.managerId}>
                    <option value="">Không có (chỉ CEO)</option>
                    {v.managerId && !(managers.data?.items ?? []).some((p) => p.id === v.managerId) && (
                      <option value={v.managerId}>{nameOf(v.managerId) ?? e?.managerName ?? 'Quản lý hiện tại'}</option>
                    )}
                    {(managers.data?.items ?? []).filter((p) => p.id !== employeeId).map((p) => (
                      <option key={p.id} value={p.id}>{`${p.fullName} · ${p.positionTitle ?? ''}`}</option>
                    ))}
                  </select>
                  {fe('managerId')}
                </label>
                <label>
                  Ngày hiệu lực *
                  <input type="date" value={v.effectiveDate} onChange={(ev) => setV({ ...v, effectiveDate: ev.target.value })} aria-invalid={!!errors.effectiveDate} />
                  {fe('effectiveDate')}
                </label>
                <label>
                  Lý do *
                  <select value={v.reason} onChange={(ev) => setV({ ...v, reason: ev.target.value as TransferReason })}>
                    {(Object.keys(TRANSFER_REASON_LABEL) as TransferReason[]).map((r) => (
                      <option key={r} value={r}>{TRANSFER_REASON_LABEL[r]}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Ghi chú
                  <input value={v.note} maxLength={500} onChange={(ev) => setV({ ...v, note: ev.target.value })} />
                </label>

                {brokenHeads.map((u) => (
                  <label key={u.id} className="span2">
                    {UNIT_LABEL[u.unitType].head} mới cho {u.name} * (người này rời đơn vị, AC-2.7.5)
                    <select value={heads[u.id] ?? ''} onChange={(ev) => setHeads({ ...heads, [u.id]: ev.target.value })} aria-invalid={!!errors.newHeads}>
                      <option value="">Để trống (gán sau)</option>
                      {(oldPeople.data?.items ?? []).filter((p) => p.id !== employeeId).map((p) => (
                        <option key={p.id} value={p.id}>{`${p.fullName} · ${p.employeeCode}`}</option>
                      ))}
                    </select>
                  </label>
                ))}
                {fe('newHeads') && <div className="span2">{fe('newHeads')}</div>}

                {reportList.length > 0 && (
                  <div className="span2">
                    <div className="row-between">
                      <h4 className="section-label">Cấp dưới trực tiếp ({reportList.length})</h4>
                      <span className="row-actions">
                        <button type="button" className="link" onClick={() => setChoices(Object.fromEntries(reportList.map((r) => [r.id, employeeId])))}>
                          Giữ tất cả
                        </button>
                        {oldHead && (
                          <button type="button" className="link" onClick={() => setChoices(Object.fromEntries(reportList.map((r) => [r.id, oldHead])))}>
                            Chuyển tất cả sang {nameOf(oldHead) ?? 'trưởng đơn vị cũ'}
                          </button>
                        )}
                      </span>
                    </div>
                    <table>
                      <thead>
                        <tr><th>Nhân viên</th><th>Quản lý từ ngày hiệu lực</th></tr>
                      </thead>
                      <tbody>
                        {reportList.map((r) => (
                          <tr key={r.id}>
                            <td>{r.fullName}</td>
                            <td>
                              <select
                                aria-label={`Quản lý mới của ${r.fullName}`}
                                value={choices[r.id] ?? ''}
                                onChange={(ev) => setChoices({ ...choices, [r.id]: ev.target.value })}
                              >
                                <option value="">— Chọn —</option>
                                <option value={employeeId}>Giữ {e?.fullName}</option>
                                {(oldPeople.data?.items ?? []).filter((p) => p.id !== employeeId && p.id !== r.id).map((p) => (
                                  <option key={p.id} value={p.id}>{`Chuyển sang ${p.fullName}`}</option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {unchosen > 0 && (
                      <p className="field-error">Còn {unchosen} cấp dưới chưa chọn giữ hay đổi quản lý (AC-2.7.6).</p>
                    )}
                    {fe('reports')}
                  </div>
                )}

                <div className={`note span2 ${future ? 'warn' : ''}`}>
                  {future ? (
                    <>
                      <b>Sắp hiệu lực.</b> Hồ sơ đổi lúc 00:05 ngày {formatDate(v.effectiveDate)}; hủy được trước ngày đó.
                    </>
                  ) : (
                    <>Hiệu lực ngay khi lưu.</>
                  )}{' '}
                  Đơn nghỉ đang chờ duyệt đi theo quản lý mới khi điều chuyển có hiệu lực (BR-05).
                </div>
              </div>
            )}
            {error && !Object.keys(errors).length && <p className="field-error">{error}</p>}
          </div>
          <div className="dialog-foot">
            <button type="button" onClick={onClose}>Hủy</button>
            {!scheduled && (
              <button type="submit" className="primary" disabled={saving || !e || unchosen > 0}>
                {saving ? 'Đang lưu…' : 'Lưu điều chuyển'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
