import { Link, useOutletContext, useParams } from 'react-router-dom';
import { api, LeaveAction, LeaveRequest, Me } from '../../api/client';
import { useApi } from '../../api/useApi';
import { ErrorBox } from '../../components/ErrorBox';
import { ActionButtons, period, STATUS_LABEL, StatusBadge } from './leave-ui';

/** Chi tiết đơn và lịch sử chuyển trạng thái. Nút thao tác hiện theo vai trò; backend vẫn kiểm tra quyền. */
export function LeaveDetailPage() {
  const { id } = useParams();
  const me = useOutletContext<Me | null>();
  const req = useApi(() => api<LeaveRequest>(`/leave-requests/${id}`), [id]);
  const r = req.data;

  if (req.error) return <ErrorBox error={req.error} />;
  if (!r) return <p>Đang tải…</p>;

  const myId = me?.employee?.id;
  const actions: LeaveAction[] = [];
  if (r.status === 'SUBMITTED' && r.employeeId === myId) actions.push('cancel');
  // Quản lý trực tiếp, hoặc HR với đơn của CEO (issue #22); backend tính sẵn canDecide.
  if (r.canDecide) actions.push('approve', 'reject');
  if (r.status === 'APPROVED' && me?.roles.includes('HR')) actions.push('complete');

  return (
    <div className="grid two">
      <section className="card">
        <h2>Đơn nghỉ phép <StatusBadge status={r.status} /></h2>
        <dl>
          <dt>Nhân viên</dt><dd><Link to={`/employees/${r.employeeId}`}>{r.employeeName}</Link></dd>
          <dt>Loại phép</dt><dd>{r.leaveType}</dd>
          <dt>Thời gian</dt><dd>{period(r)}</dd>
          <dt>Số ngày</dt><dd>{r.days}</dd>
          <dt>Lý do</dt><dd>{r.reason ?? '—'}</dd>
          <dt>Gửi lúc</dt><dd>{new Date(r.createdAt).toLocaleString('vi-VN')}</dd>
        </dl>
        <div style={{ marginTop: 16 }}>
          <ActionButtons request={r} actions={actions} onDone={() => req.reload()} />
        </div>
      </section>

      <section className="card">
        <h3>Lịch sử</h3>
        <table>
          <thead><tr><th>Thời điểm</th><th>Người thực hiện</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead>
          <tbody>
            {(r.history ?? []).map((h, i) => (
              <tr key={i}>
                <td>{new Date(h.at).toLocaleString('vi-VN')}</td>
                <td>{h.actorName ?? h.actorId}</td>
                <td>{h.fromStatus ? `${STATUS_LABEL[h.fromStatus]} → ` : ''}{STATUS_LABEL[h.toStatus]}</td>
                <td className="muted">{h.comment ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
