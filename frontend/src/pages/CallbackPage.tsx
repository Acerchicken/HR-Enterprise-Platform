import { AlertTriangle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userManager } from '../auth/auth';

/**
 * IdP chuyển về đây kèm ?code=...; đổi code lấy token rồi về trang chủ. Thiếu `code`, sai `state` hoặc IdP trả `error` thì báo
 * "Đăng nhập không thành công" kèm nút "Thử lại" (UC8 E1, AC-8.1.11): không lưu token, không tự chuyển hướng lại để tránh lặp,
 * không hiện chi tiết kỹ thuật (chỉ ghi ra console).
 */
export function CallbackPage() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return; // StrictMode gọi effect 2 lần, code chỉ đổi được 1 lần
    done.current = true;
    userManager
      .signinRedirectCallback()
      .then(() => navigate('/', { replace: true }))
      .catch(async (e) => {
        console.warn('Đăng nhập không thành công', e);
        await userManager.removeUser().catch(() => undefined);
        // Bỏ code, state khỏi thanh địa chỉ: tải lại trang không thử đổi code cũ lần nữa.
        window.history.replaceState(null, '', '/callback');
        setFailed(true);
      });
  }, [navigate]);

  if (!failed) return <p className="center">Đang đăng nhập…</p>;
  return (
    <div className="center card narrow" role="alert">
      <span className="auth-icon bad"><AlertTriangle size={24} aria-hidden="true" /></span>
      <h2>Đăng nhập không thành công</h2>
      <p className="muted">Phiên đăng nhập đã hết hạn hoặc bị gián đoạn. Hãy thử lại.</p>
      <button
        type="button"
        className="primary"
        disabled={retrying}
        onClick={() => {
          setRetrying(true);
          userManager.signinRedirect().catch(() => setRetrying(false));
        }}
      >
        Thử lại
      </button>
    </div>
  );
}
