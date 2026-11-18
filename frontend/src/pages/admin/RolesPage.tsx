import { Plus, X } from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useOutletContext } from 'react-router-dom';
import { api, ApiError, AssignableRole, DirectoryEntry, Me, Page, RoleAssignment } from '../../api/client';
import { useApi } from '../../api/useApi';
import { ErrorBox } from '../../components/ErrorBox';
import { EmptyState, formatDate, Skeleton } from '../../components/ui';
import { useDialog } from '../../components/useDialog';

type Filter = 'ALL' | AssignableRole;

/**
 * Trang "Phân quyền" (bản vẽ uc8-roles; UC8 FR-8.7, ADR-18). Chỉ ADMIN: ai đang có HR, ADMIN, ai cấp, khi nào, vì sao; cấp và
 * thu hồi kèm lý do. Nút của chính mình bị khóa (API vẫn chặn, E11). Quyền có hiệu lực ngay ở thao tác kế tiếp của người đó.
 */
export function RolesPage() {
  const me = useOutletContext<Me | null>();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const [granting, setGranting] = useState(false);
  const [revoking, setRevoking] = useState<RoleAssignment | null>(null);

  useEffect(() => {
    const t = setTimeout(() => (setTerm(q.trim()), setPage(1)), 300);
    return () => clearTimeout(t);
  }, [q]);

  const isAdmin = !!me?.roles.includes('ADMIN');
  const params = new URLSearchParams({ page: String(page), size: '20' });
  if (filter !== 'ALL') params.set('role', filter);
  if (term) params.set('q', term);
  const list = useApi(
    () => (isAdmin ? api<Page<RoleAssignment>>(`/admin/role-assignments?${params}`) : Promise.resolve(null)),
    [isAdmin, filter, term, page],
  );

  if (me && !isAdmin) return <Navigate to="/" replace />;
  const data = list.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;
  const done = () => (setGranting(false), setRevoking(null), list.reload());

  return (
    <>
      <p className="muted small crumbs"><Link to="/">Trang chủ</Link> › Quản trị › Phân quyền</p>
      <div className="page-head">
        <h1>Phân quyền</h1>
        <button type="button" className="primary" onClick={() => setGranting(true)}><Plus size={16} /> Cấp vai trò</button>
      </div>
      <div className="toolbar">
        <input placeholder="Tìm tên, email…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm theo tên, email" />
        <div className="segmented">
          {(['ALL', 'HR', 'ADMIN'] as Filter[]).map((f) => (
            <button key={f} type="button" className={filter === f ? 'primary' : ''} onClick={() => (setFilter(f), setPage(1))}>
              {f === 'ALL' ? 'Tất cả' : f}
            </button>
          ))}
        </div>
      </div>
      <p className="note">
        Nhân viên và Quản lý tự có theo hồ sơ và sơ đồ tổ chức, không cấp ở đây. Người được cấp HR hoặc ADMIN sẽ phải dùng mã xác thực
        hai lớp từ lần đăng nhập sau.
      </p>
      <ErrorBox error={list.error} />
      {!data ? (
        !list.error && <Skeleton lines={4} />
      ) : data.items.length === 0 ? (
        <EmptyState>Không có ai khớp bộ lọc.</EmptyState>
      ) : (
        <section className="card flush">
          <table>
            <thead>
              <tr>
                <th>Nhân viên</th>
                <th>Đơn vị</th>
                <th>Vai trò</th>
                <th>Người cấp</th>
                <th>Ngày cấp</th>
                <th>Lý do</th>
                <th aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((r) => {
                const self = r.email === me?.email;
                return (
                  <tr key={`${r.userId}-${r.role}`}>
                    <td>
                      {r.fullName ?? r.email}
                      {self && <span className="muted small"> (bạn)</span>}
                      <div className="muted small">{r.email}</div>
                    </td>
                    <td>{r.departmentName ?? '–'}</td>
                    <td><span className="badge">{r.role}</span></td>
                    <td>{r.grantedBy?.fullName ?? '–'}</td>
                    <td>{r.grantedBy || r.reason ? formatDate(r.grantedAt) : '–'}</td>
                    <td>{r.reason ?? '–'}</td>
                    <td>
                      <button
                        type="button"
                        className="danger"
                        disabled={self}
                        title={self ? 'Không tự thu hồi vai trò của mình' : undefined}
                        onClick={() => setRevoking(r)}
                      >
                        Thu hồi
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {pages > 1 && (
            <div className="pager">
              <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
              <span>Trang {page} / {pages} · {data.total} người</span>
              <button type="button" disabled={page >= pages} onClick={() => setPage(page + 1)}>›</button>
            </div>
          )}
        </section>
      )}
      {granting && <GrantDialog onClose={() => setGranting(false)} onDone={done} />}
      {revoking && <RevokeDialog row={revoking} onClose={() => setRevoking(null)} onDone={done} />}
    </>
  );
}

function GrantDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const box = useRef<HTMLFormElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useDialog(box, title, onClose);
  const [employee, setEmployee] = useState<DirectoryEntry | null>(null);
  const [role, setRole] = useState<AssignableRole>('HR');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const fields = error instanceof ApiError ? error.fields ?? {} : {};

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!employee) return;
    setBusy(true);
    setError(null);
    try {
      await api('/admin/role-assignments', { method: 'POST', body: JSON.stringify({ employeeId: employee.id, role, reason }) });
      onDone();
    } catch (err) {
      setError(err as Error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}>
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="grant-title" ref={box} onSubmit={submit}>
        <div className="dialog-head">
          <h2 id="grant-title" tabIndex={-1} ref={title}>Cấp vai trò</h2>
          <button type="button" className="icon-btn" aria-label="Đóng" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="dialog-body">
          <div className="field-group">
            <span className="muted small">Nhân viên *</span>
            <PersonPicker value={employee} onChange={setEmployee} />
          </div>
          <span className="muted small">Vai trò *</span>
          <div className="segmented" role="radiogroup" aria-label="Vai trò">
            {(['HR', 'ADMIN'] as AssignableRole[]).map((r) => (
              <button key={r} type="button" role="radio" aria-checked={role === r} className={role === r ? 'primary' : ''} onClick={() => setRole(r)}>
                {r}
              </button>
            ))}
          </div>
          <label style={{ marginTop: 12 }}>
            Lý do * (5 – 200 ký tự)
            <textarea value={reason} maxLength={200} rows={3} onChange={(e) => setReason(e.target.value)} />
            {fields.reason && <span className="field-error">{fields.reason}</span>}
          </label>
          <p className="note warn">
            Người này có quyền {role} ngay ở thao tác kế tiếp. Lần đăng nhập sau sẽ phải đăng ký mã xác thực hai lớp.
          </p>
          <ErrorBox error={error && !fields.reason ? error : null} />
        </div>
        <div className="dialog-foot">
          <button type="button" onClick={onClose}>Hủy</button>
          <button type="submit" className="primary" disabled={busy || !employee || reason.trim().length < 5}>Cấp vai trò</button>
        </div>
      </form>
    </div>
  );
}

function RevokeDialog({ row, onClose, onDone }: { row: RoleAssignment; onClose: () => void; onDone: () => void }) {
  const box = useRef<HTMLFormElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useDialog(box, title, onClose);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/admin/role-assignments/${row.userId}/${row.role}`, { method: 'DELETE', body: JSON.stringify({ reason }) });
      onDone();
    } catch (err) {
      setError(err as Error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}>
      <form className="dialog" role="dialog" aria-modal="true" aria-labelledby="revoke-title" ref={box} onSubmit={submit}>
        <div className="dialog-head">
          <h2 id="revoke-title" tabIndex={-1} ref={title}>Thu hồi {row.role}: {row.fullName ?? row.email}</h2>
          <button type="button" className="icon-btn" aria-label="Đóng" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="dialog-body">
          <label>
            Lý do * (5 – 200 ký tự)
            <textarea value={reason} maxLength={200} rows={3} onChange={(e) => setReason(e.target.value)} />
          </label>
          <p className="note warn">Người này mất quyền {row.role} ngay ở thao tác kế tiếp.</p>
          <ErrorBox error={error} />
        </div>
        <div className="dialog-foot">
          <button type="button" onClick={onClose}>Hủy</button>
          <button type="submit" className="primary danger-fill" disabled={busy || reason.trim().length < 5}>Thu hồi</button>
        </div>
      </form>
    </div>
  );
}

/** Chọn người ở mức danh bạ (ADMIN không xem hồ sơ, NFR-5.13): gõ tên, email, mã. */
function PersonPicker({ value, onChange }: { value: DirectoryEntry | null; onChange: (e: DirectoryEntry | null) => void }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<DirectoryEntry[]>([]);

  useEffect(() => {
    if (q.trim().length < 2) return setItems([]);
    const t = setTimeout(() => {
      api<Page<DirectoryEntry>>(`/employees?q=${encodeURIComponent(q.trim())}&size=8`)
        .then((p) => setItems(p.items))
        .catch(() => setItems([]));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  if (value) {
    return (
      <p className="small">
        {value.fullName} · {value.workEmail} · {value.departmentName}{' '}
        <button type="button" className="link" onClick={() => onChange(null)}>Bỏ chọn</button>
      </p>
    );
  }
  return (
    <div className="picker">
      <input value={q} placeholder="Gõ tên, email hoặc mã nhân viên…" onChange={(e) => setQ(e.target.value)} />
      {items.length > 0 && (
        <ul className="plain small">
          {items.map((e) => (
            <li key={e.id}>
              <button type="button" className="link" onClick={() => (onChange(e), setQ(''), setItems([]))}>{e.fullName}</button> · {e.workEmail} ·{' '}
              {e.departmentName}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
