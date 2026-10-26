import { AUTH_MODE, DEMO_ACCOUNTS, useAuth } from '../auth/auth';

export function LoginPage() {
  const { login } = useAuth();
  return (
    <div className="center card narrow">
      <h1>Enterprise HR Platform</h1>
      {AUTH_MODE === 'oidc' ? (
        <>
          <p>Đăng nhập bằng tài khoản công ty (SSO qua Keycloak).</p>
          <button className="primary" onClick={() => login()}>Đăng nhập</button>
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
