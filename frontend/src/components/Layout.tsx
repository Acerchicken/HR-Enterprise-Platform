import { Bell, LogOut, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/auth';
import { useOpenProfile } from '../profile/navigation';
import { SearchBox } from './SearchBox';
import { useShell } from './shell';
import { Avatar } from './ui';

const ROLE_LABEL: Record<string, string> = { EMPLOYEE: 'Nhân viên', MANAGER: 'Quản lý', HR: 'HR', ADMIN: 'Quản trị' };

/**
 * Nav bar mọi trang (frontend.md 2.1, AC-0.1.1): logo về trang chủ, ô tìm đồng nghiệp, chuông, menu ảnh đại diện.
 * Các link chức năng chuyển xuống ô chức năng ở trang chủ.
 */
export function Layout() {
  const { me, openQuickView } = useShell();

  return (
    <div className="shell">
      <header className="navbar">
        <Link to="/" className="logo" aria-label="HRHelper – về trang chủ" title="HR Enterprise Platform">
          <b aria-hidden="true">H</b>
          <span>HRHelper</span>
        </Link>
        <SearchBox onPick={openQuickView} />
        <div className="nav-right">
          <NotificationBell />
          <AvatarMenu />
        </div>
      </header>
      <main>
        <Outlet context={me} />
      </main>
    </div>
  );
}

/** Chuông: số việc chờ lấy từ `GET /me/todo-counts` khi có (nhánh `feat/app-shell-todo`); hiện chưa có số. */
function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));
  return (
    <div className="menu-wrap" ref={ref}>
      <button type="button" className="icon-btn" aria-label="Thông báo" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Bell size={20} />
      </button>
      {open && (
        <div className="menu" role="menu">
          <p className="muted small pad">Chưa có thông báo nào.</p>
        </div>
      )}
    </div>
  );
}

function AvatarMenu() {
  const { me } = useShell();
  const { logout } = useAuth();
  const openProfile = useOpenProfile();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const name = me?.employee?.fullName ?? me?.email ?? '';

  return (
    <div className="menu-wrap" ref={ref}>
      <button type="button" className="avatar-btn" aria-label="Menu tài khoản" aria-expanded={open} onClick={() => setOpen(!open)}>
        <Avatar name={name} />
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-head">
            <strong>{name}</strong>
            <span className="muted small">{(me?.roles ?? []).map((r) => ROLE_LABEL[r] ?? r).join(', ')}</span>
          </div>
          {me?.employee && (
            <button type="button" role="menuitem" onClick={() => (setOpen(false), openProfile('me'))}>
              <UserRound size={18} /> Hồ sơ của tôi
            </button>
          )}
          <button type="button" role="menuitem" onClick={() => logout()}>
            <LogOut size={18} /> Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}

function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  });
  return ref;
}
