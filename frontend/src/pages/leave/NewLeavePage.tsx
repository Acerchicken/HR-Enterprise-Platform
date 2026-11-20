import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, DirectoryEntry, Holiday, LeaveBalance, LeaveRequest, LeaveType, Page } from '../../api/client';
import { useApi } from '../../api/useApi';
import { ErrorBox } from '../../components/ErrorBox';
import { useShell } from '../../components/shell';
import { vnDate } from './leave-ui';

const newKey = () => crypto.randomUUID();

/** Số ngày làm việc trong khoảng (BR-03, BR-04), chỉ để hiện trước; backend tính lại khi gửi. */
function previewDays(start: string, end: string, half: boolean, holidays: Set<string>): number {
  if (!start || !end || end < start) return 0;
  let n = 0;
  for (let d = new Date(`${start}T00:00:00Z`); d <= new Date(`${end}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !holidays.has(iso)) n++;
  }
  return half ? Math.min(n, 1) / 2 : n;
}

/**
 * Đăng ký nghỉ `/leave/new` (UC3 luồng chính, A3, A5; bản vẽ uc3-new). HR, quản lý trực tiếp có ô "Tạo cho" (BR-12).
 * Loại nghỉ theo sự kiện cần ngày sự kiện (AC-3.2.6).
 */
export function NewLeavePage() {
  const navigate = useNavigate();
  const { me } = useShell();
  const isHr = !!me?.roles.includes('HR');
  const isManager = !!me?.roles.includes('MANAGER');
  const types = useApi(() => api<LeaveType[]>('/leave-types'), []);

  const [ownerId, setOwnerId] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [q, setQ] = useState('');
  const [leaveType, setLeaveType] = useState('ANNUAL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [halfDay, setHalfDay] = useState<'' | 'AM' | 'PM'>('');
  const [eventDate, setEventDate] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  // Giữ nguyên key cho đến khi tạo thành công: bấm lại hoặc mạng gửi lại cũng không tạo hai đơn (BR-11).
  const [idempotencyKey, setIdempotencyKey] = useState(newKey);

  const reports = useApi(
    () => (isManager && me?.employee ? api<DirectoryEntry[]>(`/employees/${me.employee.id}/direct-reports`) : Promise.resolve([] as DirectoryEntry[])),
    [isManager, me?.employee?.id],
  );
  const found = useApi(
    () => (isHr && q.trim().length >= 2 ? api<Page<DirectoryEntry>>(`/employees?q=${encodeURIComponent(q.trim())}&size=8`).then((p) => p.items) : Promise.resolve([] as DirectoryEntry[])),
    [isHr, q],
  );

  const year = Number((startDate || new Date().toISOString()).slice(0, 4));
  const balances = useApi(
    () => api<LeaveBalance[]>(ownerId ? `/leave-balances?employeeId=${ownerId}&year=${year}` : `/leave-balances/me?year=${year}`).catch(() => []),
    [ownerId, year],
  );
  const holidays = useApi(
    () => Promise.all([year, year + 1].map((y) => api<Holiday[]>(`/leave-holidays?year=${y}`).catch(() => []))).then((x) => x.flat()),
    [year],
  );

  const type = types.data?.find((t) => t.code === leaveType);
  const end = endDate || startDate;
  const single = !!startDate && startDate === end;
  const balance = balances.data?.find((b) => b.leaveType === leaveType);
  const holidaySet = useMemo(() => new Set((holidays.data ?? []).map((h) => h.date)), [holidays.data]);
  const days = previewDays(startDate, end, single && !!halfDay, holidaySet);
  const holidaysInRange = (holidays.data ?? []).filter((h) => startDate && h.date >= startDate && h.date <= end);

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
          endDate: end,
          ...(single && halfDay ? { halfDay } : {}),
          ...(type?.requiresEventDate ? { eventDate } : {}),
          ...(reason.trim() ? { reason: reason.trim() } : {}),
          ...(ownerId ? { employeeId: ownerId } : {}),
        }),
      });
      setIdempotencyKey(newKey());
      navigate(ownerId ? `/approvals/leave/${created.id}` : `/leave/${created.id}`);
    } catch (e) {
      setError(e as Error);
      // Lỗi nghiệp vụ (400/409) không tạo đơn: đổi key để lần gửi sau với dữ liệu đã sửa được xử lý như đơn mới.
      setIdempotencyKey(newKey());
    } finally {
      setSaving(false);
    }
  }

  const pick = (e: DirectoryEntry | null) => {
    setOwnerId(e?.id ?? '');
    setOwnerName(e?.fullName ?? '');
    setQ('');
  };

  return (
    <div className="grid two">
      <section className="card">
        <h2>Đăng ký nghỉ</h2>
        <form onSubmit={submit}>
          {(isHr || isManager) && (
            <fieldset className="plain">
              <label>
                Tạo cho
                {isHr ? (
                  <input placeholder={ownerName || 'Chính tôi (gõ tên để tạo hộ)'} value={q} onChange={(e) => setQ(e.target.value)} />
                ) : (
                  <select value={ownerId} onChange={(e) => pick((reports.data ?? []).find((r) => r.id === e.target.value) ?? null)}>
                    <option value="">Chính tôi</option>
                    {(reports.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.fullName}</option>)}
                  </select>
                )}
              </label>
              {isHr && (found.data ?? []).length > 0 && (
                <ul className="plain small">
                  {found.data!.map((e) => <li key={e.id}><button type="button" className="link" onClick={() => pick(e)}>{e.fullName} · {e.departmentName}</button></li>)}
                </ul>
              )}
              {ownerId && <p className="small">Đơn tạo hộ cho <b>{ownerName}</b>; người này nhận email và vẫn tự hủy được. <button type="button" className="link" onClick={() => pick(null)}>Tạo cho chính tôi</button></p>}
            </fieldset>
          )}
          <label>
            Loại phép
            <select value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
              {(types.data ?? []).map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
            </select>
          </label>
          {type?.requiresEventDate && (
            <label>
              Ngày sự kiện (ngày cưới, ngày mất, ngày sinh con)
              <input type="date" required value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            </label>
          )}
          <label>Từ ngày<input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
          <label>Đến ngày<input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} /></label>
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
          <label>Lý do<textarea rows={2} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} /></label>
          {startDate && <p className="small">Số ngày làm việc: <b>{days}</b>{days === 0 && <span className="error"> (khoảng này không có ngày làm việc)</span>}</p>}
          {type?.hrApproval === 'ALWAYS' && <p className="note small">Loại phép này cần HR duyệt thêm sau khi quản lý duyệt (BR-16).</p>}
          {type?.hrApproval === 'OVER_DAYS' && days > (type.hrApprovalMinDays ?? 0) && <p className="note small">Trên {type.hrApprovalMinDays} ngày: cần HR duyệt thêm sau quản lý (BR-16).</p>}
          <button className="primary" disabled={saving || !startDate}>{saving ? 'Đang gửi…' : 'Gửi đơn'}</button>
        </form>
        <ErrorBox error={error} />
      </section>

      <section className="card">
        <h3>Số dư {balance?.leaveTypeName ?? type?.name ?? leaveType} năm {year}{ownerId ? ` của ${ownerName}` : ''}</h3>
        {type?.quotaKind === 'PER_EVENT' ? (
          <p>
            Nghỉ theo sự kiện, không trừ phép năm. Tối đa {type.maxDaysPerEvent != null ? `${type.maxDaysPerEvent} ngày làm việc` : `${type.maxMonthsPerEvent} tháng`} mỗi sự kiện; mỗi sự kiện một đơn.
            {type.requiresDocument && ' HR kiểm giấy tờ khi hoàn tất.'}
          </p>
        ) : balance ? (
          <>
            <p>Còn <strong>{balance.available}</strong> ngày.</p>
            <ul className="plain small">
              <li>Được hưởng: {balance.entitled}{balance.source === 'DEFAULT' && ' (mặc định, HR chưa xác minh hồ sơ BHXH)'}</li>
              {balance.carriedIn > 0 && <li>Chuyển từ năm {year - 1}: {balance.carriedIn} (hết hạn 31/12/{year}, dùng trước)</li>}
              <li>Đã dùng: {balance.used}</li>
              <li>Đang chờ: {balance.pending}</li>
            </ul>
          </>
        ) : (
          <p className="muted">Chưa có số dư.</p>
        )}
        <p className="muted small">Số ngày tính theo ngày làm việc: không tính thứ Bảy, Chủ nhật, ngày lễ và ngày nghỉ bù. Đơn qua năm mới trừ số dư của từng năm.</p>
        {holidaysInRange.length > 0 && (
          <>
            <p className="small">Ngày lễ trong khoảng đã chọn (không trừ phép):</p>
            <ul className="plain small">{holidaysInRange.map((h) => <li key={h.date}>{vnDate(h.date)} · {h.name}</li>)}</ul>
          </>
        )}
      </section>
    </div>
  );
}
