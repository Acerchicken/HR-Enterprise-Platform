import { ChevronRight, Info, KeyRound, Send } from 'lucide-react';
import { useState } from 'react';
import { AccountStatus, AccountView, api } from '../api/client';
import { useApi } from '../api/useApi';
import { ErrorBox } from '../components/ErrorBox';
import { Skeleton } from '../components/ui';

const LABEL: Record<AccountStatus, { text: string; cls: string; hint: string }> = {
  NONE: { text: 'Chưa có tài khoản', cls: 'muted', hint: 'Hồ sơ tạo trước khi có đăng nhập tự động. Bấm "Gửi lời mời" để tạo.' },
  PENDING: { text: 'Đang tạo', cls: 'info', hint: 'Hệ thống đang tạo tài khoản, thường xong trong 1 phút.' },
  INVITED: { text: 'Chờ kích hoạt', cls: 'upcoming', hint: 'Đã gửi thư, người này chưa đăng nhập lần nào.' },
  ACTIVE: { text: 'Đang dùng', cls: 'ok', hint: '' },
  DISABLED: { text: 'Đã khóa', cls: 'muted', hint: 'Nhân viên đã nghỉ việc; khôi phục hồ sơ thì tài khoản mở lại.' },
  FAILED: { text: 'Lỗi', cls: 'bad', hint: 'Không kết nối được trang đăng nhập. Bấm "Gửi lại lời mời" để thử lại.' },
};

/** Lỗi IdP chỉ hiện câu dễ hiểu theo mã (bản vẽ uc8-account), không hiện thông báo gốc. */
const ERROR_TEXT: Record<string, string> = {
  IDP_UNAVAILABLE: 'Không kết nối được trang đăng nhập.',
  IDP_REJECTED: 'Trang đăng nhập từ chối thông tin tài khoản (ví dụ email không hợp lệ).',
  IDP_USER_NOT_FOUND: 'Không tìm thấy tài khoản trên trang đăng nhập.',
};

const dateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;

/**
 * Dòng "Tài khoản đăng nhập" trong nhóm Công việc của hồ sơ, chỉ HR thấy (UC8 FR-8.6, AC-8.6.1, bản vẽ uc8-account). Bấm dòng
 * mới gọi `GET /employees/{id}/account`; nút gửi (lại) lời mời chỉ có ở Chưa có tài khoản, Chờ kích hoạt, Lỗi.
 */
export function AccountRow({ employeeId }: { employeeId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="row" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <KeyRound size={18} className="ri" aria-hidden="true" />
        <span className="t">Tài khoản đăng nhập</span>
        <span className="v">
          <ChevronRight size={18} className="ch" aria-hidden="true" style={open ? { transform: 'rotate(90deg)' } : undefined} />
        </span>
      </button>
      {open && <AccountDetail employeeId={employeeId} />}
    </>
  );
}

function AccountDetail({ employeeId }: { employeeId: string }) {
  const [tick, setTick] = useState(0);
  const acc = useApi(() => api<AccountView>(`/employees/${employeeId}/account`), [employeeId, tick]);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<Error | null>(null);
  const a = acc.data;

  const invite = async () => {
    setSending(true);
    setSendError(null);
    try {
      await api(`/employees/${employeeId}/account/invite`, { method: 'POST' });
      setTick((t) => t + 1);
    } catch (e) {
      setSendError(e as Error);
    } finally {
      setSending(false);
    }
  };

  if (acc.error) return <div className="account-detail"><ErrorBox error={acc.error} /></div>;
  if (!a) return <div className="account-detail"><Skeleton lines={3} /></div>;
  const l = LABEL[a.status];
  const canInvite = a.status === 'NONE' || a.status === 'INVITED' || a.status === 'FAILED';

  return (
    <div className="account-detail" aria-live="polite">
      <div className="kv">
        <span className="k">Trạng thái</span>
        <span className={`badge ${l.cls}`}>{l.text}</span>
        {l.hint && <span className="muted small hint">{a.status === 'FAILED' && a.error ? ERROR_TEXT[a.error] ?? l.hint : l.hint}</span>}
      </div>
      <div className="kv"><span className="k">Email đăng nhập</span><span className="ellipsis">{a.email}</span></div>
      {a.invitedAt && <div className="kv"><span className="k">Gửi lời mời lúc</span><span>{dateTime(a.invitedAt)}</span></div>}
      {a.status !== 'NONE' && (
        <div className="kv">
          <span className="k">Đăng nhập gần nhất</span>
          {a.lastLoginAt ? <span>{dateTime(a.lastLoginAt)}</span> : <span className="muted">Chưa đăng nhập</span>}
        </div>
      )}
      <ErrorBox error={sendError} />
      <div className="account-acts">
        {canInvite && (
          <button type="button" onClick={invite} disabled={sending}>
            <Send size={16} aria-hidden="true" /> {a.status === 'NONE' ? 'Gửi lời mời' : 'Gửi lại lời mời'}
          </button>
        )}
        {a.status === 'PENDING' && (
          <button type="button" onClick={() => setTick((t) => t + 1)}>Tải lại trạng thái</button>
        )}
      </div>
      <p className="note small"><Info size={14} aria-hidden="true" /> Mật khẩu, mã xác thực hai lớp do trang đăng nhập quản lý. HR không thấy, không đặt mật khẩu cho nhân viên.</p>
    </div>
  );
}
