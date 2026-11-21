import { useEffect, useRef, useState } from 'react';
import { useDialog } from '../components/useDialog';
import { useAuth } from './auth';

/** Số phút không thao tác thì tự đăng xuất (UC8 A4, AC-8.1.6). Cho phép số lẻ để thử nhanh, ví dụ 1.5. */
const TIMEOUT_MS = Math.max(1, Number(import.meta.env.VITE_IDLE_TIMEOUT_MINUTES ?? 30) || 30) * 60_000;
/** Hộp cảnh báo hiện trước khi hết giờ (bản vẽ uc8-session). */
const WARNING_MS = 60_000;
const EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;
/** Báo hoạt động cho tab khác tối đa 1 lần mỗi 5 giây. */
const BROADCAST_EVERY_MS = 5_000;

type Message = { type: 'activity'; at: number } | { type: 'logout' };

/**
 * Theo dõi thao tác của người dùng trên mọi tab cùng trình duyệt (`BroadcastChannel`). Còn 1 phút thì trả về số giây còn lại
 * để hiện hộp cảnh báo; hết giờ thì gọi `onExpire`. Khi hộp cảnh báo đang hiện, di chuột không tính: phải bấm "Tiếp tục làm việc".
 */
export function useIdleLogout(onExpire: (fromOtherTab: boolean) => void) {
  const last = useRef(Date.now());
  const warning = useRef(false);
  const [left, setLeft] = useState<number | null>(null);
  const channel = useRef<BroadcastChannel | null>(null);
  const expire = useRef(onExpire);
  expire.current = onExpire;

  useEffect(() => {
    const ch = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('hr.session');
    channel.current = ch;
    let sentAt = 0;
    let done = false;

    const mark = (at: number) => {
      last.current = Math.max(last.current, at);
      warning.current = false;
      setLeft(null);
    };
    const onActivity = () => {
      if (warning.current) return;
      const now = Date.now();
      last.current = now;
      if (now - sentAt > BROADCAST_EVERY_MS) {
        sentAt = now;
        ch?.postMessage({ type: 'activity', at: now } satisfies Message);
      }
    };
    const finish = (fromOtherTab: boolean) => {
      if (done) return;
      done = true;
      if (!fromOtherTab) ch?.postMessage({ type: 'logout' } satisfies Message);
      expire.current(fromOtherTab);
    };
    if (ch) {
      ch.onmessage = (e: MessageEvent<Message>) => {
        if (e.data.type === 'activity') mark(e.data.at);
        else finish(true);
      };
    }
    const tick = setInterval(() => {
      const remaining = last.current + TIMEOUT_MS - Date.now();
      if (remaining <= 0) return finish(false);
      if (remaining <= WARNING_MS) {
        warning.current = true;
        setLeft(Math.ceil(remaining / 1000));
      }
    }, 1000);
    for (const ev of EVENTS) window.addEventListener(ev, onActivity, { passive: true });
    return () => {
      clearInterval(tick);
      for (const ev of EVENTS) window.removeEventListener(ev, onActivity);
      ch?.close();
    };
  }, []);

  const stay = () => {
    const now = Date.now();
    last.current = now;
    warning.current = false;
    setLeft(null);
    channel.current?.postMessage({ type: 'activity', at: now } satisfies Message);
  };

  return { secondsLeft: left, stay };
}

/** Gắn trong ứng dụng khi đã đăng nhập: hộp "Phiên sắp hết", hết giờ thì đăng xuất và đánh dấu để trang đăng nhập báo "Phiên đã hết". */
export function IdleGuard() {
  const { logout } = useAuth();
  const { secondsLeft, stay } = useIdleLogout((fromOtherTab) => logout({ expired: true, localOnly: fromOtherTab }));
  if (secondsLeft === null) return null;
  return <IdleWarning secondsLeft={secondsLeft} onStay={stay} onLogout={() => logout()} />;
}

function IdleWarning({ secondsLeft, onStay, onLogout }: { secondsLeft: number; onStay: () => void; onLogout: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  useDialog(box, title, onStay);
  const idleMinutes = Math.floor((TIMEOUT_MS - secondsLeft * 1000) / 60_000);
  const mmss = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;
  return (
    <div className="overlay">
      <div className="dialog narrow" role="alertdialog" aria-modal="true" aria-labelledby="idle-title" aria-describedby="idle-body" ref={box}>
        <div className="dialog-head">
          <h2 id="idle-title" tabIndex={-1} ref={title}>Phiên sắp hết</h2>
        </div>
        <div className="dialog-body" id="idle-body">
          <p>
            Bạn không thao tác {idleMinutes} phút. Hệ thống sẽ đăng xuất sau <b className="warn-text">{mmss}</b> để bảo vệ dữ liệu.
          </p>
        </div>
        <div className="dialog-foot">
          <button type="button" onClick={onLogout}>Đăng xuất</button>
          <button type="button" className="primary" onClick={onStay}>Tiếp tục làm việc</button>
        </div>
      </div>
    </div>
  );
}
