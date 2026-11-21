import { Link, useParams } from 'react-router-dom';
import { LeaveDetail } from './leave-ui';

/** Chi tiết đơn của tôi `/leave/:id` (UC3 A1, A2, A6). */
export function LeaveDetailPage() {
  const { id } = useParams();
  return (
    <section className="card">
      <Link to="/leave" className="small">‹ Đơn nghỉ của tôi</Link>
      <LeaveDetail id={id!} />
    </section>
  );
}
