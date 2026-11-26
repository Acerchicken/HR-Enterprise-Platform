import { Link, useParams } from 'react-router-dom';
import { documentsApi, TYPE_LABEL } from '../../api/documents';
import { useApi } from '../../api/useApi';
import { errorText, formatDate, Skeleton } from '../../components/ui';
import { DownloadButton, FileBadge, sizeOf } from './doc-ui';

/**
 * Chi tiết tài liệu `/documents/:id` (UC5 A1, FR-5.3; bản vẽ uc5-detail): tải bản mới nhất, danh sách các phiên bản cũ.
 * Ngoài phạm vi, đã ẩn hay ID sai đều hiện cùng một câu (DR-08).
 */
export function DocumentDetailPage() {
  const { id = '' } = useParams();
  const doc = useApi(() => documentsApi.get(id), [id]);
  const crumbs = (title?: string) => (
    <p className="muted small crumbs">
      <Link to="/">Trang chủ</Link> › <Link to="/documents">Tra cứu tài liệu</Link>
      {title && ` › ${title}`}
    </p>
  );

  if (doc.error) {
    return (
      <>
        {crumbs()}
        <p className="warn-box">{errorText(doc.error)}</p>
      </>
    );
  }
  if (!doc.data) return <Skeleton lines={4} />;

  const d = doc.data;
  const versions = d.versions ?? [];
  return (
    <>
      {crumbs(d.title)}
      <div className="page-head">
        <FileBadge version={d.latest} />
        <div>
          <h1>{d.title}</h1>
          <span className="muted small">
            {TYPE_LABEL[d.type]}
            {d.latest && ` · phiên bản ${d.latest.versionNo}`} · cập nhật {formatDate(d.updatedAt)}
          </span>
        </div>
        {d.latest && (
          <div className="actions">
            <DownloadButton
              primary
              label="Tải bản mới nhất"
              text={`Tải bản mới nhất (${sizeOf(d.latest)})`}
              download={() => documentsApi.download(d.id, d.latest!, true)}
            />
          </div>
        )}
      </div>
      <section className="card flush">
        <h2 className="card-title">Các phiên bản</h2>
        <table>
          <thead>
            <tr><th>Phiên bản</th><th>Tên file</th><th>Ngày đăng</th><th>Dung lượng</th><th aria-label="Tải" /></tr>
          </thead>
          <tbody>
            {versions.map((v, i) => (
              <tr key={v.id} className={i === 0 ? 'current' : ''}>
                <td>
                  <strong>v{v.versionNo}</strong>
                  {i === 0 && <span className="badge ok">Mới nhất</span>}
                </td>
                <td className="ellipsis">{v.fileName}</td>
                <td>{formatDate(v.createdAt)}</td>
                <td>{sizeOf(v)}</td>
                <td>
                  <DownloadButton label={`Tải phiên bản ${v.versionNo}`} download={() => documentsApi.download(d.id, v)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
