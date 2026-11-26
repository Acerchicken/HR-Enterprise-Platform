import { FormEvent, useState } from 'react';
import { api, LeaveAction, LeaveHistoryAction, LeaveRequest, LeaveStatus } from '../../api/client';
import { useApi } from '../../api/useApi';
import { ErrorBox } from '../../components/ErrorBox';
import { useShell } from '../../components/shell';
import { Skeleton } from '../../components/ui';

export const STATUS_LABEL: Record<LeaveStatus, string> = {
  SUBMITTED: 'Chờ duyệt',
  PENDING_HR: 'Chờ HR duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Bị từ chối',
  COMPLETED: 'Đã hoàn tất',
  CANCELLED: 'Đã hủy',
};

export const HISTORY_LABEL: Record<LeaveHistoryAction, string> = {
  SUBMIT: 'Gửi đơn',
  APPROVE: 'Duyệt',
  MANAGER_APPROVE: 'Quản lý duyệt, chuyển HR',
  HR_APPROVE: 'HR duyệt',
  REJECT: 'Từ chối',
  HR_REJECT: 'HR từ chối',
  CANCEL: 'Tự hủy',
  CANCEL_REQUEST: 'Đề nghị hủy',
  CANCEL_APPROVE: 'Đồng ý hủy',
  CANCEL_REQUEST_REJECT: 'Giữ đơn (bác đề nghị hủy)',
  COMPLETE: 'Hoàn tất',
  RECALCULATE: 'Tính lại số ngày',
  SYSTEM_CANCEL: 'Hệ thống hủy (nghỉ việc)',
};

const ACTION: Record<LeaveAction, { label: string; style: string; note?: string; confirm?: string }> = {
  approve: { label: 'Duyệt', style: 'primary' },
  reject: { label: 'Từ chối', style: 'danger', note: 'Lý do từ chối (nhân viên sẽ thấy)' },
  'hr-approve': { label: 'HR duyệt', style: 'primary' },
  'hr-reject': { label: 'HR từ chối', style: 'danger', note: 'Lý do từ chối (nhân viên sẽ thấy)' },
  cancel: { label: 'Hủy đơn', style: 'danger', confirm: 'Hủy đơn nghỉ này?' },
  'cancel-request': { label: 'Đề nghị hủy', style: 'danger', note: 'Lý do đề nghị hủy' },
  'cancel-request/approve': { label: 'Đồng ý hủy', style: 'danger', confirm: 'Đồng ý hủy đơn đã duyệt? Số ngày được trả lại.' },
  'cancel-request/reject': { label: 'Giữ đơn', style: '', note: 'Lý do giữ đơn' },
  complete: { label: 'Hoàn tất', style: 'primary' },
};

export function StatusBadge({ status }: { status: LeaveStatus }) {
  return <span className={`badge status-${status.toLowerCase().replace('_', '-')}`}>{STATUS_LABEL[status]}</span>;
}

export const vnDate = (d: string) => d.split('-').reverse().join('/');

/** "09/11/2026 – 10/11/2026" hoặc "09/11/2026 (sáng)". */
export function period(r: Pick<LeaveRequest, 'startDate' | 'endDate' | 'halfDay'>) {
  if (r.startDate !== r.endDate) return `${vnDate(r.startDate)} – ${vnDate(r.endDate)}`;
  return r.halfDay ? `${vnDate(r.startDate)} (${r.halfDay === 'AM' ? 'sáng' : 'chiều'})` : vnDate(r.startDate);
}

/** Thao tác hiện theo các cờ backend tính sẵn (UC3 9.3); backend vẫn kiểm quyền. */
export function actionsOf(r: LeaveRequest): LeaveAction[] {
  const out: LeaveAction[] = [];
  if (r.canDecide) out.push('approve', 'reject');
  if (r.canHrDecide) out.push('hr-approve', 'hr-reject');
  if (r.canConfirmCancel) out.push('cancel-request/approve', 'cancel-request/reject');
  if (r.canComplete) out.push('complete');
  if (r.canCancel) out.push('cancel');
  if (r.canRequestCancel) out.push('cancel-request');
  return out;
}

/**
 * Nút thao tác. Thao tác cần lý do mở ô nhập; thiếu lý do thì không gửi request (AC-0.6.3). Khóa nút trong lúc gửi;
 * gửi kèm `version`, đơn vừa bị người khác đổi thì API trả 409 và hiện lỗi.
 */
export function ActionButtons({ request, actions, onDone }: { request: LeaveRequest; actions: LeaveAction[]; onDone: (updated: LeaveRequest) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [asking, setAsking] = useState<LeaveAction | null>(null);
  const [text, setText] = useState('');
  const [textError, setTextError] = useState('');

  async function run(action: LeaveAction, note?: string) {
    const cfg = ACTION[action];
    if (cfg.confirm && !window.confirm(cfg.confirm)) return;
    setBusy(true);
    setError(null);
    try {
      const body = action === 'cancel-request' ? { version: request.version, reason: note } : { version: request.version, ...(note ? { comment: note } : {}) };
      const updated = await api<LeaveRequest>(`/leave-requests/${request.id}/${action}`, { method: 'POST', body: JSON.stringify(body) });
      setAsking(null);
      setText('');
      onDone(updated);
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!text.trim()) return setTextError('Cần nhập lý do');
    setTextError('');
    void run(asking!, text.trim());
  }

  if (!actions.length) return null;
  return (
    <div>
      {asking ? (
        <form onSubmit={submit}>
          <label>
            {ACTION[asking].note}
            <textarea rows={2} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} aria-invalid={!!textError} autoFocus />
            {textError && <span className="error small">{textError}</span>}
          </label>
          <div className="actions">
            <button className={ACTION[asking].style} disabled={busy}>Xác nhận: {ACTION[asking].label.toLowerCase()}</button>
            <button type="button" disabled={busy} onClick={() => setAsking(null)}>Thôi</button>
          </div>
        </form>
      ) : (
        <div className="actions">
          {actions.map((a) => (
            <button key={a} type="button" className={ACTION[a].style} disabled={busy} onClick={() => (ACTION[a].note ? setAsking(a) : void run(a))}>
              {ACTION[a].label}
            </button>
          ))}
        </div>
      )}
      <ErrorBox error={error} />
    </div>
  );
}

/** Chi tiết đơn và lịch sử, dùng ở `/leave/:id` và khung bên phải trang "Việc cần duyệt". */
export function LeaveDetail({ id, onChanged }: { id: string; onChanged?: (r: LeaveRequest) => void }) {
  const { openQuickView } = useShell();
  const req = useApi(() => api<LeaveRequest>(`/leave-requests/${id}`), [id]);
  const r = req.data;
  if (req.error) return <ErrorBox error={req.error} />;
  if (!r) return <Skeleton lines={6} />;

  return (
    <div className="det">
      <h2>
        {r.leaveTypeName ?? r.leaveType} <StatusBadge status={r.status} />
        {r.cancelRequest && r.status === 'APPROVED' && <span className="badge cancel-req">Đề nghị hủy</span>}
      </h2>
      <dl>
        <dt>Nhân viên</dt>
        <dd><button type="button" className="link" onClick={() => openQuickView(r.employeeId)}>{r.employeeName}</button>{r.createdBy !== r.employeeId && <span className="muted small"> · đơn tạo hộ</span>}</dd>
        <dt>Thời gian</dt><dd>{period(r)}</dd>
        {r.eventDate && <><dt>Ngày sự kiện</dt><dd>{vnDate(r.eventDate)}</dd></>}
        <dt>Số ngày</dt>
        <dd>{r.days}{r.allocations.length > 1 && <span className="muted small"> ({r.allocations.map((a) => `${a.days} ngày năm ${a.year}`).join(', ')})</span>}</dd>
        <dt>Lý do</dt><dd>{r.reasonHidden ? <span className="muted">Ẩn (nghỉ ốm, thai sản: chỉ chủ đơn và HR xem)</span> : (r.reason ?? '—')}</dd>
        {r.requiresHrApproval && <><dt>Duyệt</dt><dd>Quản lý duyệt rồi HR duyệt thêm (BR-16)</dd></>}
        {r.status === 'APPROVED' && <><dt>Hoàn tất từ</dt><dd>{vnDate(r.completableFrom)}</dd></>}
        <dt>Gửi lúc</dt><dd>{new Date(r.createdAt).toLocaleString('vi-VN')}</dd>
      </dl>
      <ActionButtons request={r} actions={actionsOf(r)} onDone={(u) => { req.setData(u); onChanged?.(u); }} />
      <h3>Lịch sử</h3>
      <table>
        <thead><tr><th>Thời điểm</th><th>Người thực hiện</th><th>Việc</th><th>Ghi chú</th></tr></thead>
        <tbody>
          {(r.history ?? []).map((h, i) => (
            <tr key={i}>
              <td>{new Date(h.at).toLocaleString('vi-VN')}</td>
              <td>{h.actorId ? (h.actorName ?? h.actorId) : 'Hệ thống'}</td>
              <td>{HISTORY_LABEL[h.action]}{h.fromStatus !== h.toStatus && <span className="muted small"> → {STATUS_LABEL[h.toStatus]}</span>}</td>
              <td className="muted">{h.comment ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
