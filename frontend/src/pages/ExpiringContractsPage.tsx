import { api } from '../api/client';
import { useApi } from '../api/useApi';
import { useShell } from '../components/shell';
import { EmptyState, errorText, formatDate, Skeleton } from '../components/ui';
import { useOpenProfile } from '../profile/navigation';

interface Expiring {
  itemId: string;
  employeeId: string;
  fullName: string;
  employeeCode: string;
  type: string;
  number: string;
  endDate: string;
}

/** HR: hợp đồng còn tối đa 30 ngày nữa hết hạn (UC1 AC-1.12.5); bấm tên mở mục "Diện đối tượng" của người đó. */
export function ExpiringContractsPage() {
  const { me } = useShell();
  const openProfile = useOpenProfile();
  const list = useApi<Expiring[]>(() => api('/contracts/expiring?days=30'), []);
  if (me && !me.roles.includes('HR')) return <EmptyState>Không tìm thấy hoặc bạn không có quyền xem.</EmptyState>;
  return (
    <section className="card">
      <h1 className="page-title">Hợp đồng sắp hết hạn</h1>
      <p className="muted small">Hợp đồng kết thúc trong 30 ngày tới, sớm nhất trước.</p>
      {list.error && <p className="error">{errorText(list.error)}</p>}
      {!list.data && !list.error && <Skeleton lines={4} />}
      {list.data?.length === 0 && <EmptyState>Không có hợp đồng nào sắp hết hạn.</EmptyState>}
      {!!list.data?.length && (
        <table>
          <thead><tr><th>Nhân viên</th><th>Loại</th><th>Số hợp đồng</th><th>Ngày kết thúc</th></tr></thead>
          <tbody>
            {list.data.map((c) => (
              <tr key={c.itemId}>
                <td>
                  <button type="button" className="link" onClick={() => openProfile(c.employeeId, 'contracts')}>{c.fullName}</button>
                  <span className="muted small"> {c.employeeCode}</span>
                </td>
                <td>{c.type}</td>
                <td>{c.number}</td>
                <td>{formatDate(c.endDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
