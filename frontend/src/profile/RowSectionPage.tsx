import { Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { api, ApiError, ProfileRow, ProfileSummary, RowSection } from '../api/client';
import { invalidateSummary } from '../api/cache';
import { useApi } from '../api/useApi';
import { FileList, FileUpload, FileView } from '../components/files';
import { errorText, Skeleton, useCooldown } from '../components/ui';
import { FieldEditor, formatValue, newKey, RequestBox, visible } from './fields';

type Editing = { mode: 'CREATE' | 'UPDATE'; row: ProfileRow | null; values: Record<string, unknown>; key: string; files: FileView[] };

/** Mục có file kèm theo dòng (bằng cấp, giấy tờ người phụ thuộc). */
const ROW_FILES = new Set(['qualifications', 'relatives']);

/**
 * Mục nhiều dòng hoặc một dòng (liên hệ khẩn cấp, thân nhân, chuyên môn, tài khoản ngân hàng). Chủ hồ sơ thêm, sửa, xóa đều
 * kết thúc bằng "Gửi yêu cầu" (FR-1.9); HR ghi thẳng (A9). Giá trị nhạy cảm chỉ tải khi bấm mắt.
 */
export function RowSectionPage({ s, code }: { s: ProfileSummary; code: string }) {
  const [reveal, setReveal] = useState(false);
  const data = useApi<RowSection>(() => api(`/employees/${s.id}/profile/${code}${reveal ? '?reveal=true' : ''}`), [s.id, code, reveal]);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const cooldown = useCooldown(error);
  const d = data.data;

  if (data.error) return <p className="error pad">{errorText(data.error)}</p>;
  if (!d) return <div className="pad"><Skeleton lines={4} /></div>;

  const pendingOf = (itemId: string | null) => d.requests.filter((r) => r.itemId === itemId && r.action !== 'CREATE');
  const creates = d.requests.filter((r) => r.action === 'CREATE');
  const single = d.kind === 'single';
  const pendingCreates = creates.filter((r) => r.status === 'PENDING').length;
  const canAdd = !single && d.rows.length + pendingCreates < d.maxRows;
  const hasSensitive = d.fields.some((f) => f.sensitive) && d.rows.some((r) => Object.values(r.sensitive).some((v) => v.hasValue));
  const writable = d.canPropose || d.canEdit;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      await fn();
      setEditing(null);
      invalidateSummary(s.id);
      data.reload();
    } catch (e) {
      if (e instanceof ApiError && e.fields) setErrors(e.fields);
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  /** Bỏ ô trống của trường nhạy cảm đang có giá trị: nghĩa là giữ nguyên. */
  const payload = (ed: Editing) =>
    Object.fromEntries(
      Object.entries(ed.values).filter(([k, v]) => {
        const f = d.fields.find((x) => x.key === k);
        return !(f?.sensitive && (v === '' || v === undefined));
      }),
    );

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!editing) return;
    const values = payload(editing);
    if (d!.canPropose) {
      return run(() =>
        api(`/employees/${s.id}/change-requests`, {
          method: 'POST',
          headers: { 'Idempotency-Key': editing.key },
          body: JSON.stringify({
            section: code,
            action: single ? 'UPDATE' : editing.mode,
            itemId: editing.row?.id ?? undefined,
            baseVersion: editing.row?.version,
            proposed: values,
            fileIds: editing.files.map((f) => f.id),
          }),
        }),
      );
    }
    if (editing.mode === 'CREATE') {
      return run(() => api(`/employees/${s.id}/profile/${code}`, { method: 'POST', body: JSON.stringify({ data: values }) }));
    }
    return run(() =>
      api(`/employees/${s.id}/profile/${code}/${editing.row?.id ?? 'main'}`, {
        method: 'PATCH',
        body: JSON.stringify({ version: editing.row?.version ?? 0, data: values }),
      }),
    );
  }

  function remove(row: ProfileRow) {
    if (!confirm(d!.canPropose ? 'Gửi yêu cầu xóa dòng này?' : 'Xóa dòng này?')) return;
    if (d!.canPropose) {
      return run(() =>
        api(`/employees/${s.id}/change-requests`, {
          method: 'POST',
          headers: { 'Idempotency-Key': newKey() },
          body: JSON.stringify({ section: code, action: 'DELETE', itemId: row.id, baseVersion: row.version }),
        }),
      );
    }
    return run(() => api(`/employees/${s.id}/profile/${code}/${row.id}?version=${row.version}`, { method: 'DELETE' }));
  }

  const cancel = (id: string) => run(() => api(`/employees/${s.id}/change-requests/${id}`, { method: 'DELETE' }));
  const dismiss = (id: string) => run(() => api(`/employees/${s.id}/change-requests/${id}/acknowledge`, { method: 'POST' }));
  const startEdit = (row: ProfileRow | null) =>
    setEditing({ mode: row?.id ? 'UPDATE' : 'CREATE', row, values: { ...(row?.data ?? {}) }, key: newKey(), files: [] });

  const rows = single && d.rows.length === 0 ? [] : d.rows;
  return (
    <>
      {d.notice && <p className="pad small muted">{d.notice}</p>}
      {hasSensitive && !reveal && (
        <div className="pad">
          <button type="button" className="link" onClick={() => setReveal(true)}>
            <Eye size={16} /> Hiện giá trị nhạy cảm
          </button>
        </div>
      )}
      {rows.length === 0 && creates.length === 0 && <p className="pad muted">Chưa có thông tin.</p>}

      {rows.map((row, i) => (
        <div className="fld" key={row.id ?? `row-${i}`}>
          {d.fields.filter((f) => visible(f, row.data) || f.sensitive).map((f) =>
            f.sensitive ? (
              (row.sensitive[f.key]?.hasValue || visible(f, row.data)) && (
                <div className="kv" key={f.key}>
                  <span className="k">{f.label}</span>
                  <span className={row.sensitive[f.key]?.value ? '' : 'mask'}>
                    {row.sensitive[f.key]?.value ?? (row.sensitive[f.key]?.hasValue ? '********' : '—')}
                  </span>
                </div>
              )
            ) : (
              <div className="kv" key={f.key}>
                <span className="k">{f.label}</span>
                <span>{formatValue(f, row.data[f.key])}</span>
              </div>
            ),
          )}
          {row.files && row.files.length > 0 && <FileList employeeId={s.id} files={row.files} />}
          {pendingOf(row.id).map((r) => (
            <RequestBox key={r.id} req={r} fields={d.fields} onCancel={() => cancel(r.id)} onDismiss={() => dismiss(r.id)} />
          ))}
          {writable && !editing && !pendingOf(row.id).some((r) => r.status === 'PENDING') && (
            <div className="actions row-actions">
              <button type="button" onClick={() => startEdit(row)}><Pencil size={16} /> Sửa</button>
              {!single && row.id && <button type="button" className="danger" onClick={() => remove(row)}><Trash2 size={16} /> Xóa</button>}
            </div>
          )}
        </div>
      ))}

      {single && rows.length === 0 && pendingOf(null).map((r) => (
        <div className="fld" key={r.id}>
          <RequestBox req={r} fields={d.fields} onCancel={() => cancel(r.id)} onDismiss={() => dismiss(r.id)} />
        </div>
      ))}
      {creates.map((r) => (
        <div className="fld" key={r.id}>
          <RequestBox req={r} fields={d.fields} onCancel={() => cancel(r.id)} onDismiss={() => dismiss(r.id)} />
        </div>
      ))}

      {writable && !editing && ((single && rows.length === 0 && !pendingOf(null).some((r) => r.status === 'PENDING')) || canAdd) && (
        <div className="pad">
          <button type="button" className="primary" onClick={() => startEdit(single ? { id: null, version: 0, data: {}, sensitive: {} } : null)}>
            <Plus size={16} /> {single ? 'Khai báo' : 'Thêm'}
          </button>
        </div>
      )}
      {!canAdd && !single && writable && <p className="pad small muted">Mục này tối đa {d.maxRows} dòng (tính cả yêu cầu đang chờ).</p>}

      {editing && (
        <form className="fld form" onSubmit={submit}>
          <h3>{editing.mode === 'CREATE' ? 'Thêm' : 'Sửa'}</h3>
          {d.fields.filter((f) => visible(f, editing.values)).map((f) => (
            <FieldEditor
              key={f.key}
              field={f}
              value={editing.values[f.key]}
              onChange={(v) => setEditing({ ...editing, values: { ...editing.values, [f.key]: v } })}
              error={errors[f.key]}
              sensitiveHint={f.sensitive && !!editing.row?.sensitive[f.key]?.hasValue}
            />
          ))}
          {ROW_FILES.has(code) && (d.canPropose || editing.row?.id) && (
            <div className="attach">
              <span className="small muted">Giấy tờ chứng minh (PDF, DOCX, JPG, PNG, tối đa 10 MiB)</span>
              <FileList employeeId={s.id} files={editing.files} />
              <FileUpload
                employeeId={s.id}
                section={code}
                itemId={editing.row?.id ?? null}
                label="Đính kèm file"
                onUploaded={(f) => setEditing((e) => (e ? { ...e, files: [...e.files, f] } : e))}
              />
            </div>
          )}
          {code === 'bank-account' && !!editing.values.holder && !sameName(String(editing.values.holder), s.fullName) && (
            <p className="warn-box small">Chủ tài khoản khác tên nhân viên. Vẫn gửi được nếu đúng.</p>
          )}
          {error && !Object.keys(errors).length && <p className="error">{errorText(error)}</p>}
          <div className="actions">
            <button className="primary" disabled={busy || cooldown > 0}>
              {cooldown ? `Thử lại sau ${cooldown} giây` : d.canPropose ? 'Gửi yêu cầu' : 'Lưu'}
            </button>
            <button type="button" onClick={() => setEditing(null)}>Hủy</button>
          </div>
          {d.canPropose && <p className="small muted">Thay đổi chỉ vào hồ sơ sau khi HR xác nhận.</p>}
        </form>
      )}
      {!editing && error && <p className="error pad">{errorText(error)}</p>}
    </>
  );
}

/** So tên chủ tài khoản (viết hoa không dấu) với tên nhân viên. */
function sameName(holder: string, fullName: string) {
  const plain = fullName.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase();
  return plain.trim() === holder.trim();
}
