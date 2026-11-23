import { Copy, Search } from 'lucide-react';
import { FormEvent, Fragment, useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { api, AuditLog, DirectoryEntry, Page } from '../api/client';
import { useApi } from '../api/useApi';
import { ErrorBox } from '../components/ErrorBox';
import { useShell } from '../components/shell';
import { EmptyState, Pager, Skeleton } from '../components/ui';

/** Loại đối tượng (UC7 spec mục 8). `hrOnly`: người chỉ có ADMIN không thấy (D1). */
const ENTITIES: { value: string; label: string; hrOnly?: boolean }[] = [
  { value: 'employee', label: 'Nhân viên' },
  { value: 'department', label: 'Đơn vị' },
  { value: 'position', label: 'Chức danh' },
  { value: 'leave_request', label: 'Đơn nghỉ', hrOnly: true },
  { value: 'leave_balance', label: 'Số dư phép', hrOnly: true },
  { value: 'holiday', label: 'Ngày lễ' },
  { value: 'approval_delegation', label: 'Người duyệt thay' },
  { value: 'document', label: 'Tài liệu' },
  { value: 'user_account', label: 'Tài khoản' },
  { value: 'role_assignment', label: 'Vai trò' },
];
const ENTITY_LABEL = Object.fromEntries(ENTITIES.map((e) => [e.value, e.label]));

/** Hành động theo module (UC7 spec mục 2, D3). Khớp `backend/src/modules/audit/audit-catalog.ts`. */
const ACTION_GROUPS: { module: string; actions: string[]; hrOnly?: boolean }[] = [
  {
    module: 'Hồ sơ',
    actions: [
      'CREATE', 'UPDATE', 'VIEW_SENSITIVE', 'PROFILE_CHANGE_SUBMIT', 'PROFILE_CHANGE_CANCEL', 'PROFILE_CHANGE_APPROVE',
      'PROFILE_CHANGE_REJECT', 'PROFILE_ITEM_CREATE', 'PROFILE_ITEM_UPDATE', 'PROFILE_ITEM_DELETE', 'PROFILE_FILE_UPLOAD',
      'PROFILE_FILE_DELETE', 'PROFILE_FILE_DOWNLOAD',
    ],
  },
  { module: 'Điều chuyển', actions: ['TRANSFER_SCHEDULE', 'TRANSFER_CANCEL', 'TRANSFER', 'TRANSFER_FAIL'] },
  {
    module: 'Nghỉ phép',
    hrOnly: true,
    actions: [
      'LEAVE_SUBMIT', 'LEAVE_APPROVE', 'LEAVE_REJECT', 'LEAVE_HR_APPROVE', 'LEAVE_HR_REJECT', 'LEAVE_CANCEL', 'LEAVE_CANCEL_REQUEST',
      'LEAVE_CANCEL_APPROVED', 'LEAVE_CANCEL_REQUEST_REJECT', 'LEAVE_COMPLETE', 'LEAVE_SYSTEM_CANCEL', 'LEAVE_RECALCULATE',
      'VIEW_LEAVE_REASON', 'LEAVE_BALANCE_ADJUST', 'LEAVE_BALANCE_OVERDRAWN',
    ],
  },
  { module: 'Ngày lễ, duyệt thay', actions: ['HOLIDAY_CREATE', 'HOLIDAY_DELETE', 'DELEGATION_CREATE', 'DELEGATION_END'] },
  { module: 'Tài liệu', actions: ['DOCUMENT_CREATE', 'DOCUMENT_PUBLISH', 'DOCUMENT_UPDATE', 'DOCUMENT_HIDE', 'DOCUMENT_RESTORE'] },
  { module: 'Tài khoản, vai trò', actions: ['ACCOUNT_INVITE', 'ACCOUNT_SYNC_FAILED', 'ROLE_GRANT', 'ROLE_REVOKE'] },
];

const TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});
/** dd/mm/yyyy hh:mm:ss theo giờ Việt Nam (frontend.md mục 7). */
const formatTime = (iso: string) => TIME.format(new Date(iso)).replace(',', '');

interface Filters {
  entity: string;
  entityId: string;
  actor: string;
  actions: string[];
  from: string;
  to: string;
}

function readFilters(sp: URLSearchParams): Filters {
  return {
    entity: sp.get('entity') ?? '',
    entityId: sp.get('entityId') ?? '',
    actor: sp.get('actor') ?? '',
    actions: sp.getAll('action'),
    from: sp.get('from') ?? '',
    to: sp.get('to') ?? '',
  };
}

/**
 * Trang "Lịch sử thao tác" (UC7 FR-7.3, spec 13.1, bản vẽ uc7-audit). HR, ADMIN. Bộ lọc nằm trên URL để link "Lịch sử thao tác"
 * ở trang khác mở sẵn bộ lọc. Không có nút sửa, xóa, xuất file (BR-14). ADMIN không thấy đơn nghỉ, số dư phép (D1).
 */
export function AuditPage() {
  const { me } = useShell();
  const [sp, setSp] = useSearchParams();
  const applied = readFilters(sp);
  const page = Number(sp.get('page')) || 1;
  const [draft, setDraft] = useState<Filters>(applied);
  const [open, setOpen] = useState<string | null>(null);
  const isHr = !!me?.roles.includes('HR');
  const allowed = isHr || !!me?.roles.includes('ADMIN');

  useEffect(() => setDraft(readFilters(sp)), [sp]);

  const query = new URLSearchParams(sp);
  if (!query.get('size')) query.set('size', '50');
  const list = useApi(() => (allowed ? api<Page<AuditLog>>(`/audit-logs?${query}`) : Promise.resolve(null)), [allowed, sp.toString()]);

  if (me && !allowed) return <Navigate to="/" replace />;

  function apply(e: FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams();
    if (draft.entity) next.set('entity', draft.entity);
    if (draft.entity && draft.entityId.trim()) next.set('entityId', draft.entityId.trim());
    if (draft.actor) next.set('actor', draft.actor);
    for (const a of draft.actions) next.append('action', a);
    if (draft.from) next.set('from', draft.from);
    if (draft.to) next.set('to', draft.to);
    setSp(next);
  }

  const setPage = (p: number) => {
    const next = new URLSearchParams(sp);
    next.set('page', String(p));
    setSp(next);
  };

  const entities = ENTITIES.filter((e) => isHr || !e.hrOnly);
  const groups = ACTION_GROUPS.filter((g) => isHr || !g.hrOnly);
  const fields = list.error && 'fields' in list.error ? ((list.error as { fields?: Record<string, string> }).fields ?? {}) : {};
  const data = list.data;

  return (
    <>
      <p className="muted small crumbs"><Link to="/">Trang chủ</Link> › Lịch sử thao tác</p>
      <div className="page-head">
        <h1>Lịch sử thao tác</h1>
      </div>

      <form className="card audit-filters" onSubmit={apply}>
        <label>
          Đối tượng
          <select value={draft.entity} onChange={(e) => setDraft({ ...draft, entity: e.target.value, entityId: '' })}>
            <option value="">Tất cả</option>
            {entities.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
        </label>
        <div className="field-group">
          <span className="muted small">Đối tượng cụ thể</span>
          {draft.entity === 'employee' || draft.entity === 'leave_balance' ? (
            <PersonPicker id={draft.entityId} onChange={(id) => setDraft({ ...draft, entityId: id })} label="Chọn nhân viên" />
          ) : (
            <input
              value={draft.entityId}
              disabled={!draft.entity}
              placeholder={draft.entity ? (draft.entity === 'holiday' ? 'Ngày YYYY-MM-DD' : 'Mã (ID)') : 'Chọn đối tượng trước'}
              onChange={(e) => setDraft({ ...draft, entityId: e.target.value })}
              aria-label="Mã đối tượng"
            />
          )}
        </div>
        <div className="field-group">
          <span className="muted small">Người thực hiện</span>
          <PersonPicker id={draft.actor} onChange={(id) => setDraft({ ...draft, actor: id })} label="Tất cả" />
        </div>
        <label>
          Từ ngày
          <input type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
          {fields.from && <span className="field-error">{fields.from}</span>}
        </label>
        <label>
          Đến ngày
          <input type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
          {fields.to && <span className="field-error">{fields.to}</span>}
        </label>
        <div className="field-group audit-actions">
          <span className="muted small">Hành động</span>
          <div className="chips">
            {draft.actions.map((a) => (
              <span key={a} className="chip mono">
                {a}
                <button type="button" aria-label={`Bỏ ${a}`} onClick={() => setDraft({ ...draft, actions: draft.actions.filter((x) => x !== a) })}>×</button>
              </span>
            ))}
            <select
              value=""
              aria-label="Thêm hành động"
              onChange={(e) => e.target.value && setDraft({ ...draft, actions: [...draft.actions, e.target.value] })}
            >
              <option value="">{draft.actions.length ? 'Thêm hành động…' : 'Tất cả hành động'}</option>
              {groups.map((g) => (
                <optgroup key={g.module} label={g.module}>
                  {g.actions.filter((a) => !draft.actions.includes(a)).map((a) => <option key={a} value={a}>{a}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
        </div>
        <div className="audit-submit">
          <button type="submit" className="primary"><Search size={16} /> Tìm</button>
        </div>
      </form>

      {!isHr && <p className="note">Tài khoản chỉ có vai trò ADMIN không xem được lịch sử đơn nghỉ và số dư phép.</p>}
      <ErrorBox error={list.error && !Object.keys(fields).length ? list.error : null} />
      {!data ? (
        !list.error && <Skeleton lines={5} />
      ) : data.items.length === 0 ? (
        <EmptyState>Không có thao tác nào khớp bộ lọc.</EmptyState>
      ) : (
        <section className="card flush">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Thời điểm</th>
                <th>Người thực hiện</th>
                <th>Hành động</th>
                <th>Đối tượng</th>
                <th>traceId</th>
                <th aria-label="Chi tiết" />
              </tr>
            </thead>
            <tbody>
              {data.items.map((a) => (
                <Fragment key={a.id}>
                  <tr className={open === a.id ? 'sel' : ''}>
                    <td className="nowrap">{formatTime(a.at)}</td>
                    <td>{a.actorId ? (a.actorName ?? <span className="muted">Hồ sơ không còn</span>) : <span className="muted">Hệ thống</span>}</td>
                    <td><span className="badge mono">{a.action}</span></td>
                    <td><EntityCell entityType={a.entityType} entityId={a.entityId} isHr={isHr} /></td>
                    <td>{a.traceId ? <TraceId value={a.traceId} /> : <span className="muted">–</span>}</td>
                    <td>
                      <button type="button" className="link" aria-expanded={open === a.id} onClick={() => setOpen(open === a.id ? null : a.id)}>
                        {open === a.id ? 'Ẩn' : 'Chi tiết'}
                      </button>
                    </td>
                  </tr>
                  {open === a.id && (
                    <tr className="audit-detail">
                      <td colSpan={6}>
                        <ChangedFields value={a.changedFields} />
                        <p className="small muted">
                          {ENTITY_LABEL[a.entityType] ?? a.entityType} · <span className="mono">{a.entityId}</span>
                          {a.ip && <> · IP <span className="mono">{a.ip}</span></>}
                          {a.traceId && <> · traceId <span className="mono">{a.traceId}</span></>}
                        </p>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          <div className="audit-foot">
            <span className="muted small">{data.total} bản ghi · mới nhất trước</span>
            <Pager page={data.page} size={data.size} total={data.total} onPage={setPage} />
          </div>
        </section>
      )}
    </>
  );
}

/** Trường đã đổi. Trường cá nhân, nhạy cảm chỉ có tên (giá trị `***`), không bao giờ có giá trị thật. */
function ChangedFields({ value }: { value: Record<string, unknown> | null }) {
  if (!value || !Object.keys(value).length) return <p className="small muted">Không có trường đã đổi.</p>;
  return (
    <dl className="audit-fields">
      {Object.entries(value).map(([k, v]) => (
        <Fragment key={k}>
          <dt className="mono">{k}</dt>
          <dd>{show(v)}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

function show(v: unknown): string {
  if (v === '***') return '(chỉ ghi tên trường)';
  if (v && typeof v === 'object' && 'from' in v && 'to' in v) {
    const { from, to } = v as { from: unknown; to: unknown };
    return `${show(from)} → ${show(to)}`;
  }
  if (v === null || v === undefined) return '–';
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

/** Link tới đối tượng nếu người xem mở được trang đó; không thì chỉ hiện mã. */
function EntityCell({ entityType, entityId, isHr }: { entityType: string; entityId: string; isHr: boolean }) {
  const label = ENTITY_LABEL[entityType] ?? entityType;
  const short = entityId.length > 12 ? `${entityId.slice(0, 8)}…` : entityId;
  const to =
    entityType === 'employee' && isHr ? `/employees/${entityId}`
    : entityType === 'leave_request' && isHr ? `/leave/${entityId}`
    : entityType === 'document' && isHr ? `/documents/${entityId}`
    : entityType === 'department' ? '/org'
    : null;
  return (
    <span title={entityId}>
      {label} {to ? <Link to={to} className="mono">{short}</Link> : <span className="mono">{short}</span>}
    </span>
  );
}

function TraceId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="mono nowrap" title={value}>
      {value.slice(0, 4)}…{value.slice(-4)}{' '}
      <button
        type="button"
        className="icon-btn xs"
        aria-label="Sao chép traceId"
        onClick={() => navigator.clipboard?.writeText(value).then(() => (setCopied(true), setTimeout(() => setCopied(false), 1500)))}
      >
        <Copy size={14} />
      </button>
      {copied && <span className="muted small"> Đã chép</span>}
    </span>
  );
}

/** Chọn người theo danh bạ (mức danh bạ, ADMIN dùng được): gõ tên, email, mã; gửi UUID hồ sơ. */
function PersonPicker({ id, onChange, label }: { id: string; onChange: (id: string) => void; label: string }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<DirectoryEntry[]>([]);
  const [chosen, setChosen] = useState<DirectoryEntry | null>(null);

  useEffect(() => {
    if (!id) return setChosen(null);
    if (chosen?.id === id) return;
    api<DirectoryEntry>(`/employees/${id}`).then(setChosen).catch(() => setChosen(null));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (q.trim().length < 2) return setItems([]);
    const t = setTimeout(() => {
      api<Page<DirectoryEntry>>(`/employees?q=${encodeURIComponent(q.trim())}&size=8`)
        .then((p) => setItems(p.items))
        .catch(() => setItems([]));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  if (id) {
    return (
      <div className="chips">
        <span className="chip">
          {chosen ? `${chosen.fullName} · ${chosen.employeeCode}` : `${id.slice(0, 8)}…`}
          <button type="button" aria-label="Bỏ chọn" onClick={() => (onChange(''), setChosen(null), setQ(''))}>×</button>
        </span>
      </div>
    );
  }
  return (
    <div className="picker">
      <input value={q} placeholder={label} onChange={(e) => setQ(e.target.value)} aria-label={label} />
      {items.length > 0 && (
        <ul className="plain small">
          {items.map((e) => (
            <li key={e.id}>
              <button type="button" className="link" onClick={() => (setChosen(e), onChange(e.id), setItems([]), setQ(''))}>
                {e.fullName}
              </button>{' '}
              · {e.employeeCode} · {e.departmentName}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
