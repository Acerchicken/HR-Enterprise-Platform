import { X } from 'lucide-react';
import { useRef } from 'react';
import { api, TerminationImpact } from '../../api/client';
import { useApi } from '../../api/useApi';
import { ErrorBox } from '../../components/ErrorBox';
import { formatDate, Skeleton } from '../../components/ui';
import { useDialog } from '../../components/useDialog';

/**
 * Hộp xác nhận cho nghỉ việc (bản vẽ uc2-terminate; UC1 AC-1.7.1, AC-1.7.3; UC2 AC-2.9.8). "Phải xử lý trước" còn số khác 0
 * thì khóa nút xác nhận; phần "hệ thống sẽ tự làm" nêu trước các thay đổi trong cùng giao dịch.
 */
export function TerminateDialog({ employeeId, name, onClose, onConfirm }: { employeeId: string; name: string; onClose: () => void; onConfirm: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useDialog(box, title, onClose);
  const impact = useApi(() => api<TerminationImpact>(`/employees/${employeeId}/termination-impact`), [employeeId]);
  const d = impact.data;
  const blocked = !!d && (d.activeReports > 0 || d.pendingAsNewManager.length > 0);
  const tag = (ok: boolean) => <span className={`badge ${ok ? 'ok' : 'bad'}`}>{ok ? 'Xong' : 'Chưa'}</span>;

  return (
    <div className="overlay" onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="term-title" ref={box}>
        <div className="dialog-head">
          <h2 id="term-title" tabIndex={-1} ref={title}>Xác nhận cho nghỉ việc: {name}</h2>
          <button type="button" className="icon-btn" aria-label="Đóng" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="dialog-body">
          <ErrorBox error={impact.error} />
          {!d ? (
            !impact.error && <Skeleton lines={4} />
          ) : (
            <>
              <h4 className="section-label">Phải xử lý trước</h4>
              <p>{tag(d.activeReports === 0)} Cấp dưới trực tiếp đang làm việc: {d.activeReports} (AC-1.7.1)</p>
              <p>
                {tag(d.pendingAsNewManager.length === 0)} Là quản lý mới trong điều chuyển chưa hiệu lực của người khác: {d.pendingAsNewManager.length}
              </p>
              {d.pendingAsNewManager.length > 0 && (
                <ul className="small">
                  {d.pendingAsNewManager.map((p) => <li key={p.transferId}>{p.employeeName}, từ {formatDate(p.effectiveDate)}</li>)}
                </ul>
              )}
              <h4 className="section-label">Hệ thống sẽ tự làm khi lưu</h4>
              <ul>
                {d.headRoles.map((r) => (
                  <li key={`${r.departmentId}-${r.role}`}>
                    Gỡ vai trò <b>{r.role === 'HEAD' ? 'trưởng' : 'phó'}</b> của {r.name}{r.role === 'HEAD' ? ' (đơn vị hiện "Chưa có trưởng")' : ''}
                  </li>
                ))}
                {d.scheduledTransfers > 0 && <li>Hủy {d.scheduledTransfers} điều chuyển chưa hiệu lực</li>}
                <li>Đóng giai đoạn công tác hiện tại</li>
              </ul>
              <p className="note warn">Không đổi quản lý trực tiếp của ai.{d.headRoles.some((r) => r.role === 'HEAD') ? ' Nhớ gán trưởng mới cho đơn vị sau khi lưu.' : ''}</p>
            </>
          )}
        </div>
        <div className="dialog-foot">
          <button type="button" onClick={onClose}>Quay lại</button>
          <button type="button" className="primary danger-fill" disabled={!d || blocked} onClick={onConfirm}>Xác nhận nghỉ việc</button>
        </div>
      </div>
    </div>
  );
}
