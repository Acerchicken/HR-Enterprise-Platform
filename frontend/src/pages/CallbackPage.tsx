import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userManager } from '../auth/auth';

/** Keycloak chuyển về đây kèm ?code=...; đổi code lấy token rồi về trang chủ. */
export function CallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return; // StrictMode gọi effect 2 lần, code chỉ đổi được 1 lần
    done.current = true;
    userManager
      .signinRedirectCallback()
      .then(() => navigate('/', { replace: true }))
      .catch((e) => setError(String(e?.message ?? e)));
  }, [navigate]);

  return <p className="center">{error ? `Đăng nhập thất bại: ${error}` : 'Đang đăng nhập…'}</p>;
}
