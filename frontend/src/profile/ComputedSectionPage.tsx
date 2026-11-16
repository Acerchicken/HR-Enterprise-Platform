import { api, ProfileSummary } from '../api/client';
import { useApi } from '../api/useApi';
import { EmptyState, errorText, formatDate, Skeleton } from '../components/ui';
import { RowSectionPage } from './RowSectionPage';

interface Milestones {
  hireDate: string;
  years: number;
  months: number;
  milestones: string[];
  nextMilestone: string;
  annualLeaveBonus: number;
}
interface Period {
  from: string;
  to: string | null;
  department: string | null;
  position: string | null;
  manager: string | null;
  reason: string;
  source: 'AUTO' | 'HR';
}
interface LongLeave {
  type: string;
  from: string;
  to: string | null;
  days: number | null;
  source: 'LEAVE' | 'STATUS';
}
type Computed = { canEdit: boolean } & Partial<Milestones> & { periods?: Period[]; rows?: LongLeave[] };

/** Mục tự tính (UC1 FR-1.13): các mốc trong công ty, quá trình công tác, ngày nghỉ dài. Chỉ đọc; HR nhập thêm giai đoạn cũ. */
export function ComputedSectionPage({ s, code }: { s: ProfileSummary; code: string }) {
  const data = useApi<Computed>(() => api(`/employees/${s.id}/profile/${code}`), [s.id, code]);
  const d = data.data;
  if (data.error) return <p className="error pad">{errorText(data.error)}</p>;
  if (!d) return <div className="pad"><Skeleton lines={4} /></div>;

  if (code === 'milestones') {
    return (
      <div className="fld">
        <div className="kv"><span className="k">Ngày vào làm</span><span>{formatDate(d.hireDate)}</span></div>
        <div className="kv"><span className="k">Thâm niên</span><span>{d.years} năm {d.months} tháng</span></div>
        <div className="kv">
          <span className="k">Mốc 5 năm</span>
          <span>{d.milestones?.length ? d.milestones.map(formatDate).join(', ') : 'Chưa có'}</span>
        </div>
        <div className="kv"><span className="k">Mốc kế tiếp</span><span>{formatDate(d.nextMilestone)}</span></div>
        <div className="kv"><span className="k">Phép năm cộng thêm</span><span>{d.annualLeaveBonus} ngày (mỗi 5 năm thêm 1 ngày)</span></div>
      </div>
    );
  }

  if (code === 'long-leaves') {
    return d.rows?.length ? (
      <ul className="plain history">
        {d.rows.map((r, i) => (
          <li key={i} className="fld">
            <b>{r.type}</b>
            <div className="small muted">
              {formatDate(r.from)} – {r.to ? formatDate(r.to) : 'nay'}
              {r.days !== null && ` · ${r.days} ngày làm việc`}
            </div>
          </li>
        ))}
      </ul>
    ) : (
      <EmptyState>Chưa có đợt nghỉ dài nào (đơn từ 14 ngày làm việc hoặc thời gian tạm nghỉ).</EmptyState>
    );
  }

  return (
    <>
      <ul className="plain history">
        {(d.periods ?? []).map((p, i) => (
          <li key={i} className="fld">
            <div className="small muted">
              {formatDate(p.from)} – {p.to ? formatDate(p.to) : 'nay'}
              {p.source === 'HR' && ' · HR nhập'}
            </div>
            <div><b>{p.position ?? '—'}</b> · {p.department ?? '—'}</div>
            <div className="small muted">
              {p.manager ? `Quản lý: ${p.manager} · ` : ''}
              {p.reason}
            </div>
          </li>
        ))}
      </ul>
      {d.canEdit && (
        <>
          <h3 className="group-title">Giai đoạn trước khi có hệ thống (HR nhập)</h3>
          <RowSectionPage s={s} code="career-history" raw />
        </>
      )}
    </>
  );
}
