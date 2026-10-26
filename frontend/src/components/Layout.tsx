import { NavLink, Outlet } from 'react-router-dom';
import { api, Me } from '../api/client';
import { useApi } from '../api/useApi';
import { useAuth } from '../auth/auth';

export function Layout() {
  const { logout } = useAuth();
  const { data: me } = useApi(() => api<Me>('/me'), []);

  return (
    <div className="shell">
      <header className="topbar">
        <strong className="brand">HR Platform</strong>
        <nav>
          <NavLink to="/" end>Hồ sơ của tôi</NavLink>
          <NavLink to="/directory">Danh bạ</NavLink>
          <NavLink to="/org">Sơ đồ tổ chức</NavLink>
        </nav>
        <div className="who">
          {me && (
            <>
              <span>{me.employee?.fullName ?? me.email}</span>
              {me.roles.map((r) => (
                <span key={r} className={`badge role-${r.toLowerCase()}`}>{r}</span>
              ))}
            </>
          )}
          <button className="link" onClick={() => logout()}>Đăng xuất</button>
        </div>
      </header>
      <main>
        <Outlet context={me} />
      </main>
    </div>
  );
}
