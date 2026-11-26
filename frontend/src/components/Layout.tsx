import { Bell, LogOut, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth';
import { useOpenProfile } from '../profile/navigation';
import { SearchBox } from './SearchBox';
import { useShell } from './shell';
import { countLabel, todoItems } from './todo';
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

/**
 * Chuông (frontend.md 2.1, AC-0.2.2): số việc đang chờ mình lấy từ `GET /me/todo-counts`, cùng số với dải "Việc cần làm" và
 * tab trang "Việc cần duyệt". Bấm mở danh sách ngắn, mỗi dòng dẫn tới đúng tab hoặc hồ sơ của mình.
 */
function NotificationBell() {
  const { todo } = useShell();
  const navigate = useNavigate();
  const openProfile = useOpenProfile();
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const items = todoItems(todo);
  const total = todo?.total ?? 0;
  return (
    <div className="menu-wrap" ref={ref}>
      <button
        type="button"
        className="icon-btn bell"
        aria-label={total ? `Thông báo, ${total} việc đang chờ` : 'Thông báo'}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Bell size={20} />
        {total > 0 && <span className="count-dot" aria-hidden="true">{countLabel(total)}</span>}
      </button>
      {open && (
        <div className="menu" role="menu">
          {items.length === 0 && <p className="muted small pad">Không có việc nào đang chờ bạn.</p>}
          {items.map((i) => (
            <button
              key={i.key}
              type="button"
              role="menuitem"
              className={i.action ? '' : 'muted'}
              onClick={() => (setOpen(false), i.to === 'profile' ? openProfile('me') : navigate(i.to))}
            >
              {i.text}
            </button>
          ))}
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
