import { FormEvent, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, ApiError, ChangeDetail, ChangeListItem, FieldSpec, LeaveRequest, Page, vnToday } from '../api/client';
import { invalidateSummary } from '../api/cache';
import { useApi } from '../api/useApi';
import { useShell } from '../components/shell';
import { EmptyState, errorText, Skeleton, useCooldown } from '../components/ui';
import { BASE_URL } from '../api/client';
import { getToken } from '../auth/auth';
import { FileList } from '../components/files';
import { formatValue, visible } from '../profile/fields';
import { LeaveDetail, period, StatusBadge } from './leave/leave-ui';

const SECTION_TITLE: Record<string, string> = {
  personal: 'Thông tin cá nhân',
  'emergency-contacts': 'Liên hệ khẩn cấp',
  relatives: 'Thân nhân, người phụ thuộc',
  qualifications: 'Chuyên môn',
  'bank-account': 'Tài khoản ngân hàng',
  cv: 'Sơ yếu lý lịch',
  avatar: 'Ảnh đại diện',
};
const ACTION_TEXT = { CREATE: 'Thêm', UPDATE: 'Sửa', DELETE: 'Xóa' } as const;
const DT = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' });

type Tab = 'leave' | 'leave-complete' | 'profile';

/**
 * Trang "Việc cần duyệt" (frontend.md 2.4): tab "Đơn nghỉ" cho quản lý, người duyệt thay, HR (UC4 luồng chính, A3, A6, A7);
 * "Hoàn tất đơn nghỉ", "Sửa hồ sơ" cho HR. Mở một việc là `/approvals/{type}/{id}`.
 */
export function ApprovalsPage() {
  const { me } = useShell();
  const { id, type: pathType } = useParams();
  const [params] = useSearchParams();
  const isHr = !!me?.roles.includes('HR');
  const isManager = !!me?.roles.includes('MANAGER');
  if (!me) return <Skeleton lines={4} />;
  const tabs: { key: Tab; label: string }[] = [
    ...(isHr || isManager ? [{ key: 'leave' as Tab, label: 'Đơn nghỉ' }] : []),
    ...(isHr ? [{ key: 'leave-complete' as Tab, label: 'Hoàn tất đơn nghỉ' }, { key: 'profile' as Tab, label: 'Sửa hồ sơ' }] : []),
  ];
  if (!tabs.length) return <EmptyState>Không tìm thấy hoặc bạn không có quyền xem.</EmptyState>;
  const wanted = (pathType ?? params.get('type') ?? tabs[0]!.key) as Tab;
  const type = tabs.some((t) => t.key === wanted) ? wanted : tabs[0]!.key;

  return (
    <section>
      <h1 className="page-title">Việc cần duyệt</h1>
      {tabs.length > 1 && (
        <nav className="tabs" aria-label="Loại việc">
          {tabs.map((t) => (
            <Link key={t.key} to={`/approvals?type=${t.key}`} className={t.key === type ? 'on' : ''} aria-current={t.key === type ? 'page' : undefined}>{t.label}</Link>
          ))}
          {isHr && <Link to="/approvals/delegations">Phân công duyệt thay</Link>}
        </nav>
      )}
      {type === 'profile' && <ProfileInbox selected={id} />}
      {type === 'leave' && <LeaveInbox key="leave" selected={id} isHr={isHr} isManager={isManager} />}
      {type === 'leave-complete' && <LeaveCompleteInbox selected={id} />}
    </section>
  );
}

/** Đơn chờ quyết định và đề nghị hủy (UC4 9.3); HR thêm đơn chờ HR duyệt thêm (BR-16). */
function LeaveInbox({ selected, isHr, isManager }: { selected?: string; isHr: boolean; isManager: boolean }) {
  const navigate = useNavigate();
  const list = useApi(async () => {
    const parts = await Promise.all([
      isHr || isManager ? api<Page<LeaveRequest>>('/leave-requests/pending-approval?size=100') : null,
      isHr ? api<Page<LeaveRequest>>('/leave-requests/pending-hr?size=100') : null,
    ]);
    const seen = new Set<string>();
    return parts.flatMap((p) => p?.items ?? []).filter((r) => !seen.has(r.id) && !!seen.add(r.id));
  }, [isHr, isManager]);
  const items = list.data ?? [];
  const today = vnToday();
  const label = (r: LeaveRequest) =>
    r.status === 'PENDING_HR' ? 'Chờ HR duyệt' : r.kind === 'CANCEL_REQUEST' ? (r.startDate <= today ? 'Đề nghị hủy · Hết hạn' : 'Đề nghị hủy') : null;

  function changed(u: LeaveRequest) {
    const stillHere = u.status === 'SUBMITTED' || u.status === 'PENDING_HR' || (u.status === 'APPROVED' && !!u.cancelRequest);
    if (stillHere) return;
    const idx = items.findIndex((x) => x.id === u.id);
    const next = items[idx + 1] ?? items[idx - 1];
    list.setData(items.filter((x) => x.id !== u.id));
    navigate(next ? `/approvals/leave/${next.id}` : '/approvals?type=leave', { replace: true });
  }

  return (
    <div className={`split ${selected ? 'has-detail' : ''}`}>
      <div className="inbox-list">
        {list.error && <p className="error">{errorText(list.error)}</p>}
        {!list.data && !list.error && <Skeleton lines={5} />}
        {list.data && items.length === 0 && <EmptyState>Không có đơn nghỉ nào đang chờ bạn.</EmptyState>}
        <ul className="plain inbox">
          {items.map((r) => (
            <li key={r.id}>
              <button type="button" className={`inbox-row ${r.id === selected ? 'sel' : ''}`} onClick={() => navigate(`/approvals/leave/${r.id}`)}>
                <span>
                  <b>{r.employeeName}</b>
                  <small>{r.leaveTypeName} · {period(r)} · {r.days} ngày{r.viaDelegation ? ' · duyệt thay' : ''}</small>
                </span>
                <span className="age">
                  {label(r) && <span className={`badge ${r.kind === 'CANCEL_REQUEST' ? 'cancel-req' : 'status-pending-hr'}`}>{label(r)}</span>}
                  {r.overdue && <span className="overdue">Quá hạn</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="inbox-detail">
        {selected ? (
          <>
            <Link className="back-mobile" to="/approvals?type=leave">‹ Danh sách</Link>
            <LeaveDetail key={selected} id={selected} onChanged={changed} />
          </>
        ) : (
          <EmptyState>Chọn một đơn để xem.</EmptyState>
        )}
      </div>
    </div>
  );
}

/** HR hoàn tất đơn đã duyệt sau ngày kết thúc (UC4 A2, BR-10). */
function LeaveCompleteInbox({ selected }: { selected?: string }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const list = useApi(() => api<Page<LeaveRequest>>(`/leave-requests?status=APPROVED&page=${page}&size=50`), [page]);
  const today = vnToday();
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.size)) : 1;
  return (
    <div className={`split ${selected ? 'has-detail' : ''}`}>
      <div className="inbox-list">
        {list.error && <p className="error">{errorText(list.error)}</p>}
        {!list.data && !list.error && <Skeleton lines={5} />}
        {list.data && list.data.items.length === 0 && <EmptyState>Không có đơn đã duyệt nào.</EmptyState>}
        <ul className="plain inbox">
          {(list.data?.items ?? []).map((r) => (
            <li key={r.id}>
              <button type="button" className={`inbox-row ${r.id === selected ? 'sel' : ''}`} onClick={() => navigate(`/approvals/leave-complete/${r.id}`)}>
                <span>
                  <b>{r.employeeName}</b>
                  <small>{r.leaveTypeName} · {period(r)} · {r.days} ngày</small>
                </span>
                <span className="age">
                  {r.completableFrom <= today ? <StatusBadge status="APPROVED" /> : <span className="muted small">Từ {r.completableFrom.split('-').reverse().join('/')}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {pages > 1 && (
          <div className="pager">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
            <span>{page}/{pages}</span>
            <button disabled={page >= pages} onClick={() => setPage(page + 1)}>›</button>
          </div>
        )}
      </div>
      <div className="inbox-detail">
        {selected ? <LeaveDetail key={selected} id={selected} onChanged={() => list.reload()} /> : <EmptyState>Chọn một đơn để xem.</EmptyState>}
      </div>
    </div>
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
      {r.files && r.files.length > 0 && (
        <div className="attach">
          <b className="small">File đính kèm</b>
          <FileList employeeId={r.employeeId} files={r.files} />
        </div>
      )}
      {r.section === 'avatar' && r.files?.[0] && <AvatarPreview employeeId={r.employeeId} fileId={r.files[0].id} />}
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

/** Xem trước ảnh đại diện đang chờ duyệt (tải qua API bằng token). */
function AvatarPreview({ employeeId, fileId }: { employeeId: string; fileId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    let made: string | null = null;
    fetch(`${BASE_URL}/employees/${employeeId}/files/${fileId}/download`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (b && live) setUrl((made = URL.createObjectURL(b)));
      })
      .catch(() => undefined);
    return () => {
      live = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [employeeId, fileId]);
  return url ? <img className="avatar avatar-lg" src={url} alt="Ảnh đại diện đề xuất" /> : null;
}
