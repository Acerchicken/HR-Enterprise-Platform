import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, LeaveBalance, LeaveRequest, LeaveType } from '../../api/client';
import { useApi } from '../../api/useApi';
import { ErrorBox } from '../../components/ErrorBox';

const newKey = () => crypto.randomUUID();

/** Tạo đơn nghỉ phép. Số ngày do backend tính (bỏ cuối tuần, ngày lễ – BR-03). */
export function NewLeavePage() {
  const navigate = useNavigate();
  const types = useApi(() => api<LeaveType[]>('/leave-types'), []);
  const balances = useApi(() => api<LeaveBalance[]>('/leave-balances/me').catch(() => []), []);
  const holidays = useApi(
    () => api<{ date: string; name: string }[]>(`/leave-holidays?year=${new Date().getFullYear()}`).catch(() => []),
    [],
  );

  const [leaveType, setLeaveType] = useState('ANNUAL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [halfDay, setHalfDay] = useState<'' | 'AM' | 'PM'>('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  // Giữ nguyên key cho đến khi tạo thành công: bấm lại hoặc mạng gửi lại cũng không tạo hai đơn.
  const [idempotencyKey, setIdempotencyKey] = useState(newKey);

  const single = !!startDate && startDate === (endDate || startDate);
  const balance = balances.data?.find((b) => b.leaveType === leaveType);
  const holidaysInRange = useMemo(
    () => (holidays.data ?? []).filter((h) => startDate && h.date >= startDate && h.date <= (endDate || startDate)),
    [holidays.data, startDate, endDate],
  );

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await api<LeaveRequest>('/leave-requests', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({
          leaveType,
          startDate,
          endDate: endDate || startDate,
          ...(single && halfDay ? { halfDay } : {}),
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        }),
      });
      setIdempotencyKey(newKey());
      navigate(`/leave/${created.id}`);
    } catch (e) {
      setError(e as Error);
      // Lỗi nghiệp vụ (400/409) không tạo đơn: đổi key để lần gửi sau với dữ liệu đã sửa được xử lý như đơn mới.
      setIdempotencyKey(newKey());
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid two">
      <section className="card">
        <h2>Tạo đơn nghỉ phép</h2>
        <form onSubmit={submit}>
          <label>
            Loại phép
            <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
              {(types.data ?? []).map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
            </select>
          </label>
          <label>Từ ngày<input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
          <label>Đến ngày<input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} placeholder="Để trống nếu nghỉ 1 ngày" /></label>
          {single && (
            <label>
              Nghỉ
              <select value={halfDay} onChange={(e) => setHalfDay(e.target.value as '' | 'AM' | 'PM')}>
                <option value="">Cả ngày</option>
                <option value="AM">Buổi sáng (0,5 ngày)</option>
                <option value="PM">Buổi chiều (0,5 ngày)</option>
              </select>
            </label>
          )}
          <label>Lý do<input value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} /></label>
          <button className="primary" disabled={saving || !startDate}>{saving ? 'Đang gửi…' : 'Gửi đơn'}</button>
        </form>
        <ErrorBox error={error} />
      </section>

      <section className="card">
        <h3>Số dư {balance?.leaveTypeName ?? leaveType}</h3>
        {balance ? (
          <p>Còn <strong>{balance.available}</strong> ngày (được hưởng {balance.entitled}, đã dùng {balance.used}, đang chờ duyệt {balance.pending}).</p>
        ) : (
          <p className="muted">Loại phép này chưa có số dư; hệ thống cấp theo số ngày tối đa/năm khi tạo đơn đầu tiên.</p>
        )}
        <p className="muted small">Số ngày nghỉ tính theo ngày làm việc: không tính thứ Bảy, Chủ nhật và ngày nghỉ lễ.</p>
        {holidaysInRange.length > 0 && (
          <>
            <p className="small">Ngày lễ trong khoảng đã chọn (không trừ phép):</p>
            <ul className="plain small">
              {holidaysInRange.map((h) => <li key={h.date}>{h.date.split('-').reverse().join('/')} · {h.name}</li>)}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
