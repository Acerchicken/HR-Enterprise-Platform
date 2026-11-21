import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { AffectedRequest, api, Delegation, DirectoryEntry, Holiday, LeaveBalance, Page, vnToday } from '../../api/client';
import { useApi } from '../../api/useApi';
import { ErrorBox } from '../../components/ErrorBox';
import { EmptyState, Skeleton } from '../../components/ui';
import { period, vnDate } from './leave-ui';

/** Ô tìm nhân viên theo tên (danh bạ). */
function EmployeePicker({ label, value, onPick }: { label: string; value: DirectoryEntry | null; onPick: (e: DirectoryEntry | null) => void }) {
  const [q, setQ] = useState('');
  const found = useApi(
    () => (q.trim().length >= 2 ? api<Page<DirectoryEntry>>(`/employees?q=${encodeURIComponent(q.trim())}&size=8`).then((p) => p.items) : Promise.resolve([] as DirectoryEntry[])),
    [q],
  );
  return (
    <label>
      {label}
      {value ? (
        <span className="picked">{value.fullName} <span className="muted small">{value.departmentName}</span> <button type="button" className="link" onClick={() => onPick(null)}>Đổi</button></span>
      ) : (
        <>
          <input placeholder="Gõ tên hoặc mã nhân viên" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="plain small">
            {(found.data ?? []).map((e) => <li key={e.id}><button type="button" className="link" onClick={() => { onPick(e); setQ(''); }}>{e.fullName} · {e.departmentName}</button></li>)}
          </ul>
        </>
      )}
    </label>
  );
}

/** HR xem, chỉnh số dư `/leave/balances` (UC3 FR-3.8, bản vẽ uc3-balances): mức nền phép năm, hạn mức nghỉ ốm, không lương. */
export function LeaveBalancesPage() {
  const [who, setWho] = useState<DirectoryEntry | null>(null);
  const [year, setYear] = useState(Number(vnToday().slice(0, 4)));
  const rows = useApi(() => (who ? api<LeaveBalance[]>(`/leave-balances?employeeId=${who.id}&year=${year}`) : Promise.resolve(null)), [who?.id, year]);
  const [editing, setEditing] = useState<LeaveBalance | null>(null);
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<Error | null>(null);

  async function save(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    try {
      const body = editing!.leaveType === 'ANNUAL' ? { baseDays: Number(value) } : { entitled: Number(value) };
      await api(`/leave-balances/${who!.id}/${editing!.leaveType}/${year}`, { method: 'PUT', body: JSON.stringify({ version: editing!.version, note, ...body }) });
      setEditing(null);
      rows.reload();
    } catch (e) {
      setError(e as Error);
    }
  }

  return (
    <section className="card">
      <h2>Số dư phép nhân viên</h2>
      <div className="toolbar">
        <EmployeePicker label="Nhân viên" value={who} onPick={setWho} />
        <label>Năm<input type="number" value={year} min={2020} max={2100} onChange={(e) => setYear(Number(e.target.value))} /></label>
      </div>
      {!who && <EmptyState>Chọn một nhân viên để xem số dư.</EmptyState>}
      <ErrorBox error={rows.error} />
      {who && !rows.data && !rows.error && <Skeleton lines={3} />}
      {rows.data && (
        <table>
          <thead><tr><th>Loại</th><th>Mức nền</th><th>Được hưởng</th><th>Chuyển từ năm trước</th><th>Đã dùng</th><th>Đang chờ</th><th>Còn lại</th><th>Nguồn</th><th>Ghi chú</th><th></th></tr></thead>
          <tbody>
            {rows.data.map((b) => (
              <tr key={b.leaveType}>
                <td>{b.leaveTypeName}</td>
                <td>{b.leaveType === 'ANNUAL' ? (b.baseDays ?? 12) : '—'}</td>
                <td>{b.entitled}</td>
                <td>{b.carriedIn || '—'}</td>
                <td>{b.used}</td>
                <td>{b.pending}</td>
                <td><b>{b.available}</b></td>
                <td className="small">{b.source === 'AUTO' ? 'Hệ thống tính' : b.source === 'DEFAULT' ? 'Mặc định, chưa xác minh' : 'HR nhập'}</td>
                <td className="muted small">{b.note ?? '—'}</td>
                <td><button type="button" onClick={() => { setEditing(b); setValue(String(b.leaveType === 'ANNUAL' ? (b.baseDays ?? 12) : b.entitled)); setNote(''); }}>Sửa</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing && (
        <form onSubmit={save} className="card inset">
          <h3>Sửa {editing.leaveTypeName} năm {year}</h3>
          {editing.leaveType === 'ANNUAL' ? (
            <label>
              Mức nền theo điều kiện lao động
              <select value={value} onChange={(e) => setValue(e.target.value)}>
                <option value="12">12 ngày (bình thường)</option>
                <option value="14">14 ngày</option>
                <option value="16">16 ngày</option>
              </select>
            </label>
          ) : (
            <label>Hạn mức (ngày)<input type="number" step="0.5" min={0} required value={value} onChange={(e) => setValue(e.target.value)} /></label>
          )}
          <label>Căn cứ (bắt buộc, không ghi vào audit)<input required maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <div className="actions">
            <button className="primary">Lưu</button>
            <button type="button" onClick={() => setEditing(null)}>Thôi</button>
          </div>
          <ErrorBox error={error} />
        </form>
      )}
    </section>
  );
}

/** HR quản lý lịch nghỉ lễ và tính lại đơn bị ảnh hưởng `/leave/holidays` (UC4 A9, FR-4.9, BR-19). */
export function HolidaysPage() {
  const [year, setYear] = useState(Number(vnToday().slice(0, 4)));
  const list = useApi(() => api<Holiday[]>(`/leave-holidays?year=${year}`), [year]);
  const affected = useApi(() => api<AffectedRequest[]>(`/leave-requests/affected-by-holidays?year=${year}`), [year]);
  const [form, setForm] = useState({ date: '', name: '', kind: 'HOLIDAY' as Holiday['kind'] });
  const [msg, setMsg] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const refresh = () => { list.reload(); affected.reload(); };

  async function add(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    try {
      const r = await api<{ affectedRequests: number }>('/leave-holidays', { method: 'POST', body: JSON.stringify(form) });
      setMsg(`Đã thêm. ${r.affectedRequests} đơn có ngày này; xem danh sách cần tính lại bên dưới.`);
      setForm({ ...form, date: '', name: '' });
      refresh();
    } catch (e) {
      setError(e as Error);
    }
  }
  async function remove(h: Holiday) {
    if (!window.confirm(`Xóa ${vnDate(h.date)} khỏi lịch?`)) return;
    setError(null);
    try {
      const r = await api<{ affectedRequests: number }>(`/leave-holidays/${h.date}`, { method: 'DELETE' });
      setMsg(`Đã xóa. ${r.affectedRequests} đơn có ngày này.`);
      refresh();
    } catch (e) {
      setError(e as Error);
    }
  }
  async function recalc(r: AffectedRequest) {
    const reason = window.prompt('Lý do tính lại (chủ đơn thấy trong lịch sử)', 'Cập nhật lịch nghỉ lễ');
    if (!reason) return;
    setError(null);
    try {
      await api(`/leave-requests/${r.id}/recalculate`, { method: 'POST', body: JSON.stringify({ version: r.version, reason }) });
      affected.reload();
    } catch (e) {
      setError(e as Error);
    }
  }

  return (
    <div className="grid two">
      <section className="card">
        <div className="toolbar">
          <h2 style={{ flex: 2, margin: 0 }}>Lịch nghỉ lễ</h2>
          <input type="number" aria-label="Năm" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 100 }} />
        </div>
        <form onSubmit={add} className="toolbar">
          <input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} aria-label="Ngày" />
          <input required placeholder="Tên ngày lễ" maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Holiday['kind'] })} aria-label="Loại">
            <option value="HOLIDAY">Ngày lễ</option>
            <option value="COMPENSATORY">Nghỉ bù</option>
          </select>
          <button className="primary">Thêm</button>
        </form>
        {msg && <p className="note small">{msg}</p>}
        <ErrorBox error={error} />
        {!list.data ? <Skeleton lines={5} /> : (
          <table>
            <thead><tr><th>Ngày</th><th>Tên</th><th>Loại</th><th></th></tr></thead>
            <tbody>
              {list.data.map((h) => (
                <tr key={h.date}>
                  <td>{vnDate(h.date)}</td><td>{h.name}</td><td>{h.kind === 'HOLIDAY' ? 'Lễ' : 'Nghỉ bù'}</td>
                  <td><button type="button" className="danger" onClick={() => void remove(h)}>Xóa</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="muted small">Sửa lịch không tự đổi đơn đã gửi (BR-19). Lịch năm sau nên nhập trước 1/12.</p>
      </section>
      <section className="card">
        <h3>Đơn cần tính lại theo lịch hiện tại</h3>
        {!affected.data ? <Skeleton lines={3} /> : affected.data.length === 0 ? <EmptyState>Không có đơn nào lệch số ngày.</EmptyState> : (
          <table>
            <thead><tr><th>Nhân viên</th><th>Thời gian</th><th>Đã lưu</th><th>Tính lại</th><th></th></tr></thead>
            <tbody>
              {affected.data.map((r) => (
                <tr key={r.id}>
                  <td><Link to={`/approvals/leave-complete/${r.id}`}>{r.employeeName}</Link></td>
                  <td>{period({ ...r, halfDay: null })}</td>
                  <td>{r.storedDays}</td>
                  <td><b>{r.recalculatedDays}</b></td>
                  <td><button type="button" onClick={() => void recalc(r)}>Tính lại</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

/** HR phân công duyệt thay `/approvals/delegations` (UC4 A4, FR-4.3, BR-06). */
export function DelegationsPage() {
  const list = useApi(() => api<Delegation[]>('/leave-delegations'), []);
  const [manager, setManager] = useState<DirectoryEntry | null>(null);
  const [delegate, setDelegate] = useState<DirectoryEntry | null>(null);
  const [startDate, setStart] = useState(vnToday());
  const [endDate, setEnd] = useState('');
  const [error, setError] = useState<Error | null>(null);

  async function create(ev: FormEvent) {
    ev.preventDefault();
    setError(null);
    try {
      await api('/leave-delegations', { method: 'POST', body: JSON.stringify({ managerId: manager?.id, delegateId: delegate?.id, startDate, endDate }) });
      setManager(null);
      setDelegate(null);
      setEnd('');
      list.reload();
    } catch (e) {
      setError(e as Error);
    }
  }
  async function end(d: Delegation) {
    if (!window.confirm(`Kết thúc phân công ${d.delegateName} duyệt thay ${d.managerName}?`)) return;
    try {
      await api(`/leave-delegations/${d.id}/end`, { method: 'POST' });
      list.reload();
    } catch (e) {
      setError(e as Error);
    }
  }

  return (
    <div className="grid two">
      <section className="card">
        <Link to="/approvals?type=leave" className="small">‹ Việc cần duyệt</Link>
        <h2>Phân công duyệt thay</h2>
        <form onSubmit={create}>
          <EmployeePicker label="Quản lý vắng" value={manager} onPick={setManager} />
          <EmployeePicker label="Người duyệt thay (quản lý đang có cấp dưới)" value={delegate} onPick={setDelegate} />
          <label>Từ ngày<input type="date" required value={startDate} onChange={(e) => setStart(e.target.value)} /></label>
          <label>Đến ngày<input type="date" required min={startDate} value={endDate} onChange={(e) => setEnd(e.target.value)} /></label>
          <button className="primary" disabled={!manager || !delegate}>Tạo phân công</button>
        </form>
        <ErrorBox error={error} />
        <p className="muted small">Người thay chỉ duyệt đơn của cấp dưới trực tiếp của quản lý vắng, không giao tiếp cho người khác (BR-06).</p>
      </section>
      <section className="card">
        <h3>Các phân công</h3>
        {!list.data ? <Skeleton lines={4} /> : list.data.length === 0 ? <EmptyState>Chưa có phân công nào.</EmptyState> : (
          <table>
            <thead><tr><th>Quản lý vắng</th><th>Người thay</th><th>Thời gian</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>
              {list.data.map((d) => (
                <tr key={d.id}>
                  <td>{d.managerName}</td><td>{d.delegateName}</td>
                  <td>{vnDate(d.startDate)} – {vnDate(d.endDate)}</td>
                  <td>{d.endedAt ? 'Đã kết thúc' : d.active ? 'Đang hiệu lực' : d.startDate > vnToday() ? 'Sắp tới' : 'Hết hạn'}</td>
                  <td>{!d.endedAt && d.endDate >= vnToday() && <button type="button" onClick={() => void end(d)}>Kết thúc</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
