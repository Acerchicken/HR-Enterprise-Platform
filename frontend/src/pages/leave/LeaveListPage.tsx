import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, LeaveRequest, LeaveStatus, Page } from '../../api/client';
import { useApi } from '../../api/useApi';
import { ErrorBox } from '../../components/ErrorBox';
import { period, STATUS_LABEL, StatusBadge } from './leave-ui';

/** Đơn nghỉ của tôi `/leave` (UC3 A2). Hủy, đề nghị hủy ở trang chi tiết. */
export function LeaveListPage() {
  const [status, setStatus] = useState<LeaveStatus | ''>('');
  const [page, setPage] = useState(1);
  const list = useApi(() => api<Page<LeaveRequest>>(`/leave-requests/me?page=${page}&size=20${status ? `&status=${status}` : ''}`), [page, status]);
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.size)) : 1;

  return (
    <section className="card">
      <div className="toolbar">
        <h2 style={{ flex: 2, margin: 0 }}>Đơn nghỉ của tôi</h2>
        <select value={status} onChange={(e) => { setStatus(e.target.value as LeaveStatus | ''); setPage(1); }} aria-label="Lọc trạng thái">
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <Link className="button primary" to="/leave/new">+ Tạo đơn</Link>
      </div>
      <ErrorBox error={list.error} />
      {list.loading && !list.data && <p>Đang tải…</p>}
      {list.data && list.data.items.length === 0 && <p className="muted">Bạn chưa có đơn nào.</p>}
      {list.data && list.data.items.length > 0 && (
        <table>
          <thead><tr><th>Loại</th><th>Thời gian</th><th>Số ngày</th><th>Lý do</th><th>Trạng thái</th></tr></thead>
          <tbody>
            {list.data.items.map((r) => (
              <tr key={r.id}>
                <td>{r.leaveTypeName ?? r.leaveType}</td>
                <td><Link to={`/leave/${r.id}`}>{period(r)}</Link></td>
                <td>{r.days}</td>
                <td className="muted">{r.reason ?? '—'}</td>
                <td>
                  <StatusBadge status={r.status} />
                  {r.cancelRequest && r.status === 'APPROVED' && <span className="badge cancel-req">Đề nghị hủy</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {pages > 1 && (
        <div className="pager">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>‹ Trước</button>
          <span>Trang {page}/{pages}</span>
          <button disabled={page >= pages} onClick={() => setPage(page + 1)}>Sau ›</button>
        </div>
      )}
    </section>
  );
}
