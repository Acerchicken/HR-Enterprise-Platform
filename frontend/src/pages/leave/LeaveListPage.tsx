import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, LeaveAction, LeaveRequest, LeaveStatus, Page } from '../../api/client';
import { useApi } from '../../api/useApi';
import { ErrorBox } from '../../components/ErrorBox';
import { ActionButtons, period, STATUS_LABEL, StatusBadge } from './leave-ui';

type Mode = 'mine' | 'approvals' | 'hr';

const CONFIG: Record<Mode, { title: string; path: string; actions: LeaveAction[]; showEmployee: boolean; statuses: boolean; empty: string }> = {
  mine: { title: 'Đơn nghỉ phép của tôi', path: '/leave-requests/me', actions: ['cancel'], showEmployee: false, statuses: true, empty: 'Bạn chưa có đơn nào.' },
  approvals: { title: 'Đơn chờ tôi duyệt', path: '/leave-requests/pending-approval', actions: ['approve', 'reject'], showEmployee: true, statuses: false, empty: 'Không có đơn nào đang chờ bạn duyệt.' },
  hr: { title: 'HR hoàn tất đơn nghỉ phép', path: '/leave-requests', actions: ['complete'], showEmployee: true, statuses: true, empty: 'Không có đơn nào.' },
};

/**
 * Ba màn hình danh sách dùng chung một bảng:
 * - mine: đơn của tôi (hủy đơn đang chờ duyệt)
 * - approvals: quản lý trực tiếp duyệt / từ chối đơn của nhân viên trực thuộc
 * - hr: HR xem đơn đã duyệt và hoàn tất
 */
export function LeaveListPage({ mode }: { mode: Mode }) {
  const cfg = CONFIG[mode];
  const [status, setStatus] = useState<LeaveStatus | ''>(mode === 'hr' ? 'APPROVED' : '');
  const [page, setPage] = useState(1);
  const list = useApi(
    () => api<Page<LeaveRequest>>(`${cfg.path}?page=${page}&size=20${status ? `&status=${status}` : ''}`),
    [cfg.path, page, status],
  );
  const pages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.size)) : 1;

  /** Đơn đổi trạng thái thì cập nhật dòng đó; nếu không còn khớp bộ lọc thì tải lại danh sách. */
  function replace(updated: LeaveRequest) {
    if (!list.data) return;
    if (status && updated.status !== status) return list.reload();
    if (mode === 'approvals') return list.reload();
    list.setData({ ...list.data, items: list.data.items.map((r) => (r.id === updated.id ? updated : r)) });
  }

  return (
    <section className="card">
      <div className="toolbar">
        <h2 style={{ flex: 2, margin: 0 }}>{cfg.title}</h2>
        {cfg.statuses && (
          <select value={status} onChange={(e) => { setStatus(e.target.value as LeaveStatus | ''); setPage(1); }}>
            <option value="">Tất cả trạng thái</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        )}
        {mode === 'mine' && <Link className="button primary" to="/leave/new">+ Tạo đơn</Link>}
      </div>
      <ErrorBox error={list.error} />
      {list.loading && !list.data && <p>Đang tải…</p>}
      {list.data && list.data.items.length === 0 && <p className="muted">{cfg.empty}</p>}
      {list.data && list.data.items.length > 0 && (
        <table>
          <thead>
            <tr>
              {cfg.showEmployee && <th>Nhân viên</th>}
              <th>Loại</th><th>Thời gian</th><th>Số ngày</th><th>Lý do</th><th>Trạng thái</th><th></th>
            </tr>
          </thead>
          <tbody>
            {list.data.items.map((r) => (
              <tr key={r.id}>
                {cfg.showEmployee && <td><Link to={`/employees/${r.employeeId}`}>{r.employeeName}</Link></td>}
                <td>{r.leaveType}</td>
                <td><Link to={`/leave/${r.id}`}>{period(r)}</Link></td>
                <td>{r.days}</td>
                <td className="muted">{r.reason ?? '—'}</td>
                <td><StatusBadge status={r.status} /></td>
                <td>
                  <ActionButtons
                    request={r}
                    actions={cfg.actions.filter((a) => (a === 'complete' ? r.status === 'APPROVED' : r.status === 'SUBMITTED'))}
                    onDone={replace}
                  />
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
