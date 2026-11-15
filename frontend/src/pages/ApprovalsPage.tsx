import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, ApiError, ChangeDetail, ChangeListItem, FieldSpec, Page } from '../api/client';
import { invalidateSummary } from '../api/cache';
import { useApi } from '../api/useApi';
import { useShell } from '../components/shell';
import { EmptyState, errorText, Skeleton, useCooldown } from '../components/ui';
import { formatValue, visible } from '../profile/fields';

const SECTION_TITLE: Record<string, string> = {
  personal: 'Thông tin cá nhân',
  'emergency-contacts': 'Liên hệ khẩn cấp',
  relatives: 'Thân nhân, người phụ thuộc',
  qualifications: 'Chuyên môn',
  'bank-account': 'Tài khoản ngân hàng',
};
const ACTION_TEXT = { CREATE: 'Thêm', UPDATE: 'Sửa', DELETE: 'Xóa' } as const;
const DT = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Trang "Việc cần duyệt" (frontend.md 2.4). Tab "Sửa hồ sơ" của HR làm trong UC1 (FR-1.9); tab đơn nghỉ tạm dẫn tới trang
 * cũ cho tới khi gộp hẳn ở `feat/approvals-inbox`.
 */
export function ApprovalsPage() {
  const { me } = useShell();
  const { id } = useParams();
  const [params] = useSearchParams();
  const type = params.get('type') ?? 'profile';
  const isHr = !!me?.roles.includes('HR');
  if (!me) return <Skeleton lines={4} />;
  if (!isHr) return me.roles.includes('MANAGER') ? <Navigate to="/leave/approvals" replace /> : <EmptyState>Không tìm thấy hoặc bạn không có quyền xem.</EmptyState>;
  if (type !== 'profile') return <Navigate to={type === 'leave-complete' ? '/leave/hr' : '/leave/approvals'} replace />;

  return (
    <section>
      <h1 className="page-title">Việc cần duyệt</h1>
      <nav className="tabs" aria-label="Loại việc">
        <Link to="/leave/approvals">Đơn nghỉ</Link>
        <Link to="/leave/hr">Hoàn tất đơn nghỉ</Link>
        <Link to="/approvals?type=profile" className="on" aria-current="page">Sửa hồ sơ</Link>
      </nav>
      <ProfileInbox selected={id} />
    </section>
  );
}

function ProfileInbox({ selected }: { selected?: string }) {
  const navigate = useNavigate();
  const [section, setSection] = useState('');
  const list = useApi<Page<ChangeListItem>>(
    () => api(`/change-requests?status=PENDING&size=100${section ? `&section=${section}` : ''}`),
    [section],
  );
  const items = list.data?.items ?? [];
  const open = (id: string) => navigate(`/approvals/profile/${id}`);

  /** Duyệt xong việc biến khỏi danh sách, chuyển sang việc kế tiếp để duyệt liên tục. */
  function done(id: string) {
    const idx = items.findIndex((x) => x.id === id);
    const next = items[idx + 1] ?? items[idx - 1];
    list.setData({ ...list.data!, items: items.filter((x) => x.id !== id), total: list.data!.total - 1 });
    navigate(next ? `/approvals/profile/${next.id}` : '/approvals?type=profile', { replace: true });
  }

  return (
    <div className={`split ${selected ? 'has-detail' : ''}`}>
      <div className="inbox-list">
        <div className="toolbar">
          <select value={section} onChange={(e) => setSection(e.target.value)} aria-label="Lọc theo mục">
            <option value="">Mọi mục</option>
            {Object.entries(SECTION_TITLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {list.error && <p className="error">{errorText(list.error)}</p>}
        {!list.data && !list.error && <Skeleton lines={5} />}
        {list.data && items.length === 0 && <EmptyState>Không có yêu cầu nào đang chờ.</EmptyState>}
        <ul className="plain inbox">
          {items.map((r) => (
            <li key={r.id}>
              <button type="button" className={`inbox-row ${r.id === selected ? 'sel' : ''}`} onClick={() => open(r.id)}>
                <span>
                  <b>{r.employeeName}</b> <span className="muted small">{r.employeeCode}</span>
                  <small>{ACTION_TEXT[r.action]} · {SECTION_TITLE[r.section] ?? r.section} · {r.departmentName ?? '—'}</small>
                </span>
                <span className="age">
                  {DT.format(new Date(r.submittedAt))}
                  {r.overdue && <span className="overdue">Quá hạn</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="inbox-detail">
        {selected ? <Detail key={selected} id={selected} onDone={done} /> : <EmptyState>Chọn một yêu cầu để xem.</EmptyState>}
      </div>
    </div>
  );
}

function Detail({ id, onDone }: { id: string; onDone: (id: string) => void }) {
  const [reveal, setReveal] = useState(false);
  const d = useApi<ChangeDetail>(() => api(`/change-requests/${id}${reveal ? '?reveal=true' : ''}`), [id, reveal]);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const cooldown = useCooldown(error);
  const r = d.data;

  async function decide(kind: 'approve' | 'reject') {
    setBusy(true);
    setError(null);
    try {
      await api(`/change-requests/${id}/${kind}`, { method: 'POST', body: kind === 'reject' ? JSON.stringify({ reason: reason.trim() }) : undefined });
      invalidateSummary(r!.employeeId);
      onDone(id);
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  function submitReject(ev: FormEvent) {
    ev.preventDefault();
    // AC-0.6.3: thiếu lý do thì không gửi request.
    if (!reason.trim()) return setReasonError('Nhập lý do từ chối');
    if (reason.trim().length > 500) return setReasonError('Lý do tối đa 500 ký tự');
    setReasonError('');
    void decide('reject');
  }

  if (d.error) return <p className="error">{errorText(d.error)}</p>;
  if (!r) return <Skeleton lines={6} />;
  const fields = r.fields.filter((f) => r.action === 'DELETE' || f.key in r.proposed || f.key in r.proposedSensitive || f.key in r.current);
  const hasSensitive = Object.keys(r.proposedSensitive).length > 0;
  const show = (f: FieldSpec, side: 'current' | 'proposed') => {
    if (f.sensitive) {
      const m = side === 'current' ? r.currentSensitive[f.key] : r.proposedSensitive[f.key];
      if (!m?.hasValue) return '—';
      return m.value ?? '********';
    }
    return formatValue(f, side === 'current' ? r.current[f.key] : r.proposed[f.key]);
  };

  return (
    <div className="det">
      <Link className="back-mobile" to="/approvals?type=profile">‹ Danh sách</Link>
      <h2>{r.employee.fullName} <span className="muted small">{r.employee.employeeCode} · {r.employee.departmentName ?? '—'}</span></h2>
      <p className="muted small">
        {ACTION_TEXT[r.action]} · {SECTION_TITLE[r.section] ?? r.section} · gửi lúc {DT.format(new Date(r.submittedAt))}
        {r.overdue && <span className="overdue">Quá hạn</span>}
      </p>
      <table className="cmp">
        <thead>
          <tr><th>Trường</th><th>Hiện tại</th><th>{r.action === 'DELETE' ? 'Sau khi duyệt' : 'Đề xuất'}</th></tr>
        </thead>
        <tbody>
          {fields.filter((f) => visible(f, { ...r.current, ...r.proposed })).map((f) => {
            const cur = show(f, 'current');
            const next = r.action === 'DELETE' ? '(xóa)' : f.key in r.proposed || f.key in r.proposedSensitive ? show(f, 'proposed') : cur;
            return (
              <tr key={f.key}>
                <td>{f.label}</td>
                <td>{cur}</td>
                <td className={next !== cur ? 'new' : ''}>{next}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {hasSensitive && !reveal && (
        <button type="button" className="link" onClick={() => setReveal(true)}>Hiện giá trị nhạy cảm (ghi audit)</button>
      )}
      {/* 409 (E19): dùng câu báo của API vì nêu cách xử lý (từ chối hoặc để nhân viên gửi lại). */}
      {error && <p className="error">{error instanceof ApiError && error.status === 409 ? error.message : errorText(error)}</p>}
      {!rejecting ? (
        <div className="actions">
          <button type="button" className="primary" disabled={busy || cooldown > 0} onClick={() => void decide('approve')}>
            {cooldown ? `Thử lại sau ${cooldown} giây` : 'Duyệt'}
          </button>
          <button type="button" className="danger" disabled={busy} onClick={() => setRejecting(true)}>Từ chối</button>
        </div>
      ) : (
        <form onSubmit={submitReject}>
          <label htmlFor="reject-reason">
            Lý do từ chối (nhân viên sẽ thấy)
            <textarea id="reject-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} aria-invalid={!!reasonError} />
            {reasonError && <span className="error small">{reasonError}</span>}
          </label>
          <div className="actions">
            <button className="danger" disabled={busy || cooldown > 0}>Xác nhận từ chối</button>
            <button type="button" onClick={() => setRejecting(false)}>Hủy</button>
          </div>
        </form>
      )}
    </div>
  );
}
