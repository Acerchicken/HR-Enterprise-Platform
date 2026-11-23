import { Link, useParams } from 'react-router-dom';
import { useShell } from '../../components/shell';
import { LeaveDetail } from './leave-ui';

/** Chi tiết đơn của tôi `/leave/:id` (UC3 A1, A2, A6). HR có link mở lịch sử thao tác của đơn (UC7 spec 13.1). */
export function LeaveDetailPage() {
  const { id } = useParams();
  const { me } = useShell();
  return (
    <section className="card">
      <Link to="/leave" className="small">‹ Đơn nghỉ của tôi</Link>
      {me?.roles.includes('HR') && (
        <Link to={`/audit?entity=leave_request&entityId=${id}`} className="small" style={{ float: 'right' }}>Lịch sử thao tác</Link>
      )}
      <LeaveDetail id={id!} />
    </section>
  );
}
