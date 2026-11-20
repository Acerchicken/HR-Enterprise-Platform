import { Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AUTH_MODE, DEMO_ACCOUNTS, clearSessionExpired, sessionExpired, useAuth } from '../auth/auth';

export function LoginPage() {
  const { login } = useAuth();
  // Đọc một lần khi mở trang: lần đăng xuất trước là do không thao tác (UC8 A4, AC-8.1.6).
  // Xóa cờ trong effect, không trong hàm khởi tạo: StrictMode gọi hàm khởi tạo hai lần.
  const [expired] = useState(sessionExpired);
  useEffect(clearSessionExpired, []);
  return (
    <div className="center card narrow">
      {expired && (
        <div role="status">
          <span className="auth-icon info"><Clock size={24} aria-hidden="true" /></span>
          <h2>Phiên đã hết</h2>
          <p>Phiên đã hết, vui lòng đăng nhập lại.</p>
          <hr />
        </div>
      )}
      <h1>HRHelper</h1>
      <p className="muted">HR Enterprise Platform</p>
      {AUTH_MODE === 'oidc' ? (
        <>
          <p>Đăng nhập bằng tài khoản công ty (SSO qua Keycloak).</p>
          <button className="primary" onClick={() => login()}>{expired ? 'Đăng nhập lại' : 'Đăng nhập'}</button>
          <p className="muted small">
            Tài khoản demo: employee / manager / hr / admin, mật khẩu <code>Passw0rd!</code>
          </p>
        </>
      ) : (
        <>
          <p>Chế độ dev: chọn một tài khoản demo.</p>
          {DEMO_ACCOUNTS.map((a) => (
            <button key={a.email} className="block" onClick={() => login(a.email)}>{a.label}</button>
          ))}
        </>
      )}
    </div>
  );
}
