import { EyeOff, FilePlus2, Pencil, RotateCcw, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, Department } from '../../api/client';
import { DocumentAdmin, DOCUMENT_TYPES, documentsApi, DocumentType, ManageState, SCOPE_ROLES, TYPE_LABEL } from '../../api/documents';
import { useApi } from '../../api/useApi';
import { ErrorBox } from '../../components/ErrorBox';
import { EmptyState, formatDate, Pager, Skeleton } from '../../components/ui';
import { DialogMode, DocumentDialog } from './DocumentDialog';

const PAGE_SIZE = 20;
const TABS: { state: ManageState; label: string }[] = [
  { state: 'VISIBLE', label: 'Đang hiện' },
  { state: 'HIDDEN', label: 'Đã ẩn' },
  { state: 'NOT_READY', label: 'Chưa có bản sẵn sàng' },
];
const ROLE_LABEL = Object.fromEntries(SCOPE_ROLES.map((r) => [r.role, r.label]));

/** Trạng thái dòng: đã ẩn, đang tải lên (chưa có bản `READY`), lỗi tải lên (chỉ có bản `REJECTED`), đang hiện. */
function statusOf(d: DocumentAdmin): { label: string; cls: string } {
  if (d.hidden) return { label: 'Đã ẩn', cls: 'muted' };
  if (d.latest) return { label: 'Đang hiện', cls: 'ok' };
  if (d.versions.some((v) => v.status === 'PENDING')) return { label: 'Đang tải lên', cls: 'upcoming' };
  return { label: 'Lỗi tải lên', cls: 'bad' };
}

function ScopeCell({ d }: { d: DocumentAdmin }) {
  if (d.scope.all) return <>Toàn công ty</>;
  return (
    <span className="scope-cell">
      {d.scope.departments.map((u) => (
        <span key={u.id} className={`chip small ${u.active ? '' : 'inactive'}`} title={u.active ? 'Gồm đơn vị con' : 'Đơn vị đã ngừng hoạt động'}>
          {u.name}{!u.active && ' (ngừng)'}
        </span>
      ))}
      {d.scope.roles.map((r) => <span key={r} className="chip small">Vai trò {ROLE_LABEL[r] ?? r}</span>)}
    </span>
  );
}

/**
 * HR quản lý kho `/documents/manage` (UC5 A3, A4, A5, AC-5.1.8; bản vẽ uc5-manage). Thấy mọi tài liệu kể cả đã ẩn, chỉ metadata
 * (DR-03): HR không tải được tài liệu ngoài phạm vi của mình. Ẩn, khôi phục có hộp xác nhận; sửa gửi kèm `version`.
 */
export function DocumentManagePage() {
  const [state, setState] = useState<ManageState>('VISIBLE');
  const [type, setType] = useState<DocumentType | ''>('');
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<DialogMode | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Gõ tìm: chờ 300 ms sau phím cuối mới gọi API (frontend.md 2.1).
  useEffect(() => {
    const t = setTimeout(() => (setTerm(q.trim()), setPage(1)), 300);
    return () => clearTimeout(t);
  }, [q]);

  const list = useApi(
    () => documentsApi.manageList({ state, type: type || undefined, q: term || undefined, page, size: PAGE_SIZE }),
    [state, type, term, page],
  );
  const units = useApi(() => api<Department[]>('/departments'), []);

  async function toggleHidden(d: DocumentAdmin) {
    const ask = d.hidden
      ? `Khôi phục "${d.title}"? Người trong phạm vi hiện tại sẽ xem được lại.`
      : `Ẩn "${d.title}"? Mọi người sẽ không xem, không tải được nữa; HR khôi phục được.`;
    if (!window.confirm(ask)) return;
    setError(null);
    try {
      await documentsApi.setHidden(d.id, !d.hidden);
      list.reload();
    } catch (e) {
      setError(e as Error);
    }
  }

  return (
    <>
      <p className="muted small crumbs"><Link to="/">Trang chủ</Link> › <Link to="/documents">Tra cứu tài liệu</Link> › Quản lý</p>
      <div className="page-head">
        <h1>Quản lý tài liệu</h1>
        <button type="button" className="primary" onClick={() => setDialog({ kind: 'create' })}>
          <Upload size={16} /> Đăng tài liệu
        </button>
      </div>
      <div className="toolbar">
        <input placeholder="Tìm tiêu đề…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm theo tiêu đề" maxLength={100} />
        <select value={type} onChange={(e) => (setType(e.target.value as DocumentType | ''), setPage(1))} aria-label="Lọc theo loại">
          <option value="">Loại: Tất cả</option>
          {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>
        <div className="segmented" role="group" aria-label="Trạng thái">
          {TABS.map((t) => (
            <button key={t.state} type="button" className={state === t.state ? 'primary' : ''} aria-pressed={state === t.state} onClick={() => (setState(t.state), setPage(1))}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <ErrorBox error={list.error ?? units.error ?? error} />
      <section className="card flush">
        {list.loading && !list.data && <Skeleton lines={4} />}
        {list.data?.items.length === 0 && <EmptyState>Không có tài liệu nào.</EmptyState>}
        {!!list.data?.items.length && (
          <table>
            <thead>
              <tr><th>Tiêu đề</th><th>Loại</th><th>Phạm vi xem</th><th>Phiên bản</th><th>Cập nhật</th><th>Trạng thái</th><th aria-label="Thao tác" /></tr>
            </thead>
            <tbody>
              {list.data.items.map((d) => {
                const st = statusOf(d);
                return (
                  <tr key={d.id}>
                    <td><strong>{d.title}</strong></td>
                    <td>{TYPE_LABEL[d.type]}</td>
                    <td><ScopeCell d={d} /></td>
                    <td>{d.latest ? `v${d.latest.versionNo}` : '—'}</td>
                    <td>{formatDate(d.updatedAt)}</td>
                    <td><span className={`badge ${st.cls}`}>{st.label}</span></td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="icon-btn" aria-label={`Sửa ${d.title}`} title="Sửa thông tin, phạm vi" onClick={() => setDialog({ kind: 'edit', doc: d })}>
                          <Pencil size={16} />
                        </button>
                        <button type="button" className="icon-btn" aria-label={`Thêm phiên bản cho ${d.title}`} title="Thêm phiên bản" onClick={() => setDialog({ kind: 'version', doc: d })}>
                          <FilePlus2 size={16} />
                        </button>
                        <button
                          type="button"
                          className={`icon-btn ${d.hidden ? '' : 'danger'}`}
                          aria-label={`${d.hidden ? 'Khôi phục' : 'Ẩn'} ${d.title}`}
                          title={d.hidden ? 'Khôi phục' : 'Ẩn tài liệu'}
                          onClick={() => toggleHidden(d)}
                        >
                          {d.hidden ? <RotateCcw size={16} /> : <EyeOff size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {list.data && <Pager page={page} size={PAGE_SIZE} total={list.data.total} onPage={setPage} />}
      </section>
      {dialog && (
        <DocumentDialog
          mode={dialog}
          units={units.data ?? []}
          onClose={() => setDialog(null)}
          onSaved={() => (setDialog(null), list.reload())}
        />
      )}
    </>
  );
}
