import { useState } from 'react';
import { api, LeaveAction, LeaveRequest, LeaveStatus } from '../../api/client';
import { ErrorBox } from '../../components/ErrorBox';

export const STATUS_LABEL: Record<LeaveStatus, string> = {
  SUBMITTED: 'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Bị từ chối',
  COMPLETED: 'Đã hoàn tất',
  CANCELLED: 'Đã hủy',
};

export const ACTION_LABEL: Record<LeaveAction, string> = {
  approve: 'Duyệt',
  reject: 'Từ chối',
  cancel: 'Hủy đơn',
  complete: 'Hoàn tất',
};

export function StatusBadge({ status }: { status: LeaveStatus }) {
  return <span className={`badge status-${status.toLowerCase()}`}>{STATUS_LABEL[status]}</span>;
}

const vn = (d: string) => d.split('-').reverse().join('/');

/** "09/11/2026 – 10/11/2026" hoặc "09/11/2026 (sáng)". */
export function period(r: Pick<LeaveRequest, 'startDate' | 'endDate' | 'halfDay'>) {
  if (r.startDate !== r.endDate) return `${vn(r.startDate)} – ${vn(r.endDate)}`;
  return r.halfDay ? `${vn(r.startDate)} (${r.halfDay === 'AM' ? 'sáng' : 'chiều'})` : vn(r.startDate);
}

/**
 * Nút thao tác trên một đơn. Khóa nút trong lúc gửi để tránh bấm hai lần;
 * gửi kèm version, nếu đơn đã bị người khác đổi thì backend trả 409 và hiện lỗi.
 */
export function ActionButtons({
  request,
  actions,
  onDone,
}: {
  request: LeaveRequest;
  actions: LeaveAction[];
  onDone: (updated: LeaveRequest) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [comment, setComment] = useState('');

  async function run(action: LeaveAction) {
    if (action === 'cancel' && !window.confirm('Hủy đơn nghỉ phép này?')) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api<LeaveRequest>(`/leave-requests/${request.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ version: request.version, ...(comment.trim() ? { comment: comment.trim() } : {}) }),
      });
      setRejecting(false);
      setComment('');
      onDone(updated);
    } catch (e) {
      setError(e as Error);
    } finally {
      setBusy(false);
    }
  }

  if (!actions.length) return null;
  return (
    <div className="actions">
      {rejecting ? (
        <>
          <input placeholder="Lý do từ chối (không bắt buộc)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
          <button className="danger" disabled={busy} onClick={() => run('reject')}>Xác nhận từ chối</button>
          <button disabled={busy} onClick={() => setRejecting(false)}>Thôi</button>
        </>
      ) : (
        actions.map((a) => (
          <button
            key={a}
            className={a === 'approve' || a === 'complete' ? 'primary' : a === 'reject' || a === 'cancel' ? 'danger' : ''}
            disabled={busy}
            onClick={() => (a === 'reject' ? setRejecting(true) : run(a))}
          >
            {ACTION_LABEL[a]}
          </button>
        ))
      )}
      <ErrorBox error={error} />
    </div>
  );
}
