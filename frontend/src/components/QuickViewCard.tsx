import { Copy, Mail, Phone, X } from 'lucide-react';
import { useRef } from 'react';
import { ProfileSummary } from '../api/client';
import { getSummary } from '../api/cache';
import { useApi } from '../api/useApi';
import { Avatar, errorText, Skeleton } from './ui';
import { useDialog } from './useDialog';

/**
 * Thẻ xem nhanh (frontend.md 4.1, AC-0.3.0): chỉ gọi `GET /employees/{id}/summary`, chỉ hiện dữ liệu mức danh bạ.
 */
export function QuickViewCard({ id, onClose, onFull }: { id: string; onClose: () => void; onFull: (id: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useDialog(box, title, onClose);
  const s = useApi<ProfileSummary>(() => getSummary(id), [id]);
  const e = s.data;

  return (
    <div className="overlay" onMouseDown={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div className="quickview" role="dialog" aria-modal="true" aria-labelledby="qv-title" ref={box}>
        <div className="qv-top">
          <button type="button" className="icon-btn qv-x" aria-label="Đóng" onClick={onClose}>
            <X size={18} />
          </button>
          <Avatar name={e?.fullName} size="md" />
          {e && <span className="code-badge">{e.employeeCode}</span>}
          <h2 id="qv-title" tabIndex={-1} ref={title}>{e?.fullName ?? 'Đang tải…'}</h2>
          {e && <div className="muted">{e.positionTitle ?? '—'}</div>}
        </div>
        {s.error && <p className="error pad">{errorText(s.error)}</p>}
        {!e && !s.error && <div className="pad"><Skeleton lines={4} /></div>}
        {e && (
          <div className="qv-rows">
            <div className="kv"><span className="k">Phòng ban</span><span>{e.departmentName ?? '—'}</span></div>
            <div className="kv"><span className="k">Quản lý trực tiếp</span><span>{e.managerName ?? '—'}</span></div>
            <div className="kv">
              <span className="k">Điện thoại</span>
              <span>{e.phone ?? '—'}</span>
              {e.phone && (
                <span className="acts">
                  <a className="icon-btn" href={`tel:${e.phone.replace(/[^+0-9]/g, '')}`} aria-label="Gọi"><Phone size={16} /></a>
                  <CopyButton text={e.phone} label="Sao chép số điện thoại" />
                </span>
              )}
            </div>
            <div className="kv">
              <span className="k">Email</span>
              <span className="ellipsis">{e.workEmail}</span>
              <span className="acts">
                <a className="icon-btn" href={`mailto:${e.workEmail}`} aria-label="Gửi email"><Mail size={16} /></a>
                <CopyButton text={e.workEmail} label="Sao chép email" />
              </span>
            </div>
          </div>
        )}
        <div className="qv-foot">
          <button type="button" className="primary block" disabled={!e} onClick={() => onFull(id)}>
            Xem hồ sơ đầy đủ
          </button>
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  return (
    <button type="button" className="icon-btn" aria-label={label} onClick={() => navigator.clipboard?.writeText(text)}>
      <Copy size={16} />
    </button>
  );
}
