import {
  CalendarDays,
  CalendarPlus,
  ClipboardCheck,
  FileSearch,
  History,
  Inbox,
  List,
  LucideIcon,
  Network,
  Upload,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, LeaveBalance, Role } from '../api/client';
import { useApi } from '../api/useApi';
import { useShell } from '../components/shell';
import { givenName, Skeleton, TodoBadge } from '../components/ui';
import { useOpenProfile } from '../profile/navigation';

interface Tile {
  title: string;
  desc: string;
  icon: LucideIcon;
  /** Đường dẫn; `profile` mở popup hồ sơ của mình. */
  to: string | 'profile';
  /** Ai thấy ô này; bỏ trống là mọi người. `employee`: cần có hồ sơ. */
  who?: (Role | 'employee')[];
  /** false: chức năng chưa làm, tên đỏ kèm "Chưa có" (AC-0.2.1). */
  ready?: boolean;
}

/** Ô chung theo thứ tự cố định ở frontend.md 2.2. */
const COMMON: Tile[] = [
  { title: 'Hồ sơ của tôi', desc: 'Thông tin cá nhân, công việc, giấy tờ', icon: UserRound, to: 'profile', who: ['employee'] },
  { title: 'Đăng ký nghỉ', desc: 'Tạo đơn nghỉ phép, nghỉ ốm, nghỉ việc riêng', icon: CalendarPlus, to: '/leave/new', who: ['employee'] },
  { title: 'Đơn nghỉ của tôi', desc: 'Trạng thái các đơn đã gửi', icon: List, to: '/leave', who: ['employee'] },
  { title: 'Việc cần duyệt', desc: 'Đơn nghỉ của nhân viên cấp dưới', icon: ClipboardCheck, to: '/leave/approvals', who: ['MANAGER'] },
  { title: 'Danh bạ', desc: 'Tra cứu đồng nghiệp', icon: Users, to: '/directory' },
  { title: 'Sơ đồ tổ chức', desc: 'Phòng ban và quản lý', icon: Network, to: '/org' },
  { title: 'Tra cứu tài liệu', desc: 'Tìm quy chế, chính sách; hỏi trợ lý AI', icon: FileSearch, to: '/coming-soon', ready: false },
];

/** Nhóm "Chức năng HR" (bản vẽ 10.2). Trang "Việc cần duyệt" có tab (frontend.md 2.4) làm ở tuần 12; tạm dẫn tới trang cũ. */
const HR_TILES: Tile[] = [
  { title: 'Việc cần duyệt', desc: 'Đơn nghỉ của CEO, đơn chờ HR', icon: Inbox, to: '/leave/approvals', who: ['HR'] },
  { title: 'Hoàn tất đơn nghỉ', desc: 'Đơn đã duyệt chờ HR hoàn tất', icon: CalendarDays, to: '/leave/hr', who: ['HR'] },
  { title: 'Quản lý nhân viên', desc: 'Thêm, sửa hồ sơ, nghỉ việc', icon: UserPlus, to: '/employees/new', who: ['HR'] },
  { title: 'Đăng tài liệu', desc: 'Quy chế, biểu mẫu, phạm vi xem', icon: Upload, to: '/coming-soon', who: ['HR'], ready: false },
  { title: 'Lịch sử thao tác', desc: 'Ai làm gì, lúc nào', icon: History, to: '/coming-soon', who: ['HR', 'ADMIN'], ready: false },
];

const DAY = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

/** Trang chủ (frontend.md 2.2): lời chào, ô chức năng theo vai trò, số dư phép năm. */
export function HomePage() {
  const { me, meError } = useShell();
  const openProfile = useOpenProfile();
  const hasEmployee = !!me?.employee;
  const balance = useApi(
    () => (hasEmployee ? api<LeaveBalance[]>('/leave-balances/me').catch(() => []) : Promise.resolve([] as LeaveBalance[])),
    [hasEmployee],
  );

  // Ví dụ tài khoản đã nghỉ việc (AC-1.7.2): API trả 403 kèm lý do.
  if (meError) return <p className="warn-box">{meError.message}</p>;
  if (!me) return <Skeleton lines={4} />;
  const canSee = (t: Tile) =>
    !t.who || t.who.some((w) => (w === 'employee' ? hasEmployee : me.roles.includes(w)));
  const common = COMMON.filter(canSee).filter((t) => !(t.to === '/leave/approvals' && me.roles.includes('HR')));
  const hr = HR_TILES.filter(canSee);
  const annual = balance.data?.find((b) => b.leaveType === 'ANNUAL');

  const tile = (t: Tile) => {
    const Icon = t.icon;
    const body = (
      <>
        <span className="tile-ic"><Icon size={20} /></span>
        <span>
          <h3>{t.title}{t.ready === false && <TodoBadge />}</h3>
          <p>{t.desc}</p>
        </span>
      </>
    );
    const cls = `tile ${t.ready === false ? 'no' : ''}`;
    return t.to === 'profile' ? (
      <button type="button" key={t.title} className={cls} onClick={() => openProfile('me')}>{body}</button>
    ) : (
      <Link key={t.title} className={cls} to={t.to}>{body}</Link>
    );
  };

  return (
    <div className="home">
      <h1>Chào {givenName(me.employee?.fullName) || me.email}</h1>
      <p className="muted sub">
        {me.roles.includes('HR') ? 'HR · ' : ''}
        {DAY.format(new Date())}
      </p>
      {!hasEmployee && (
        <p className="warn-box">Tài khoản {me.email} chưa gắn với hồ sơ nhân viên nào. Liên hệ HR.</p>
      )}
      {hr.length > 0 && (
        <>
          <h2 className="sect">Chức năng HR</h2>
          <div className="tiles">{hr.map(tile)}</div>
        </>
      )}
      <h2 className="sect">{hr.length > 0 ? 'Chức năng chung' : 'Chức năng'}</h2>
      <div className="tiles">{common.map(tile)}</div>
      {annual && (
        <Link to="/leave" className="balance-line">
          <CalendarDays size={20} aria-hidden="true" />
          <span>Còn <b>{annual.available} ngày</b> phép năm {annual.year}</span>
          <span className="more">Xem nghỉ phép ›</span>
        </Link>
      )}
    </div>
  );
}

/** Trang cho chức năng chưa làm (UC1 AC-1.8.2): không gọi API nào. */
export function ComingSoonPage() {
  return (
    <section className="card coming">
      <h2>Chức năng đang phát triển</h2>
      <p className="muted">Chức năng này chưa có trong phiên bản hiện tại.</p>
      <Link className="button primary" to="/">Về trang chủ</Link>
    </section>
  );
}
