import { Settings2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { Me } from '../../api/client';
import { DOCUMENT_TYPES, documentsApi, DocumentType, TYPE_LABEL } from '../../api/documents';
import { useApi } from '../../api/useApi';
import { ErrorBox } from '../../components/ErrorBox';
import { EmptyState, formatDate, Pager, Skeleton } from '../../components/ui';
import { AssistantPanel } from './AssistantPanel';
import { DownloadButton, FileBadge } from './doc-ui';

const PAGE_SIZE = 20;

/**
 * Trang "Tra cứu tài liệu" `/documents` (UC5 A1, AC-5.2.7; bản vẽ uc56-documents). Chỉ có tài liệu trong phạm vi của người
 * xem, mới cập nhật trước; không hiện số lượng hay gợi ý gì về tài liệu ngoài phạm vi (DR-08). Bên phải là khung hỏi trợ lý
 * của UC6 (spec 9.1); màn hình hẹp thì xếp dưới danh sách.
 */
export function DocumentsPage() {
  const me = useOutletContext<Me | null>();
  const [type, setType] = useState<DocumentType | undefined>();
  const [page, setPage] = useState(1);
  const list = useApi(() => documentsApi.list({ type, page, size: PAGE_SIZE }), [type, page]);
  const pick = (t: DocumentType | undefined) => (setType(t), setPage(1));

  return (
    <>
      <p className="muted small crumbs"><Link to="/">Trang chủ</Link> › Tra cứu tài liệu</p>
      <div className="page-head">
        <h1>Tra cứu tài liệu</h1>
        {me?.roles.includes('HR') && (
          <div className="actions">
            <Link className="button" to="/documents/manage"><Settings2 size={16} /> Quản lý tài liệu</Link>
          </div>
        )}
      </div>
      <div className="segmented wrap" role="group" aria-label="Lọc theo loại">
        <button type="button" className={!type ? 'primary' : ''} aria-pressed={!type} onClick={() => pick(undefined)}>Tất cả</button>
        {DOCUMENT_TYPES.map((t) => (
          <button key={t} type="button" className={type === t ? 'primary' : ''} aria-pressed={type === t} onClick={() => pick(t)}>
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <ErrorBox error={list.error} />
      <div className="docs-layout">
      <section className="card flush doc-list">
        {list.loading && !list.data && <Skeleton lines={4} />}
        {list.data?.items.length === 0 && (
          <EmptyState>{type ? `Chưa có tài liệu loại ${TYPE_LABEL[type].toLowerCase()} dành cho bạn.` : 'Chưa có tài liệu nào dành cho bạn.'}</EmptyState>
        )}
        <ul className="plain">
          {list.data?.items.map((d) => (
            <li key={d.id} className="doc-row">
              <FileBadge version={d.latest} />
              <div className="doc-main">
                <Link to={`/documents/${d.id}`} className="doc-title">{d.title}</Link>
                <span className="muted small">
                  {TYPE_LABEL[d.type]}
                  {d.latest && ` · v${d.latest.versionNo}`} · cập nhật {formatDate(d.updatedAt)}
                </span>
              </div>
              {d.latest && (
                <DownloadButton label={`Tải ${d.title}`} download={() => documentsApi.download(d.id, d.latest!, true)} />
              )}
            </li>
          ))}
        </ul>
        {list.data && list.data.total > 0 && (
          <div className="doc-foot">
            <span className="muted small">{list.data.total} tài liệu bạn được xem</span>
            <Pager page={page} size={PAGE_SIZE} total={list.data.total} onPage={setPage} />
          </div>
        )}
      </section>
      <AssistantPanel />
      </div>
    </>
  );
}
