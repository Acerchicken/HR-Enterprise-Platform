import {
  Award,
  BadgeDollarSign,
  BookOpen,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  FileText,
  Flag,
  Gift,
  Heart,
  History,
  Landmark,
  LucideIcon,
  Mail,
  Network,
  Percent,
  Phone,
  ShieldCheck,
  Siren,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useRef } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, ProfileSummary, SalarySection, SectionGroup, SectionSummary } from '../api/client';
import { getSummary } from '../api/cache';
import { useApi } from '../api/useApi';
import { useShell } from '../components/shell';
import { Avatar, errorText, formatMoney, MaskedValue, Skeleton, TodoBadge } from '../components/ui';
import { useDialog } from '../components/useDialog';
import { ProfileState, useOpenProfile } from './navigation';
import { SectionPage } from './SectionPage';

export const SECTION_ICON: Record<string, LucideIcon> = {
  personal: UserRound,
  'emergency-contacts': Siren,
  relatives: Users,
  'career-history': Clock,
  contracts: ClipboardList,
  'long-leaves': CalendarClock,
  milestones: Flag,
  salary: BadgeDollarSign,
  'insurance-salary': ShieldCheck,
  'bank-account': Landmark,
  tax: Percent,
  'social-insurance': ShieldCheck,
  'health-insurance': Heart,
  allowances: Gift,
  'rewards-discipline': Award,
  qualifications: BookOpen,
  cv: FileText,
  history: History,
};

const GROUP_TITLE: Record<SectionGroup, string> = {
  personal: 'Thông tin cá nhân',
  work: 'Công việc',
  finance: 'Tài chính',
  benefits: 'Phúc lợi',
  other: 'Khác',
};

/**
 * Popup hồ sơ (frontend.md 4.2, UC1 spec 9.1): ngăn phải 720 px trên màn hình rộng, toàn màn hình dưới 1024 px; có URL
 * (`/me/profile`, `/employees/:id`, `/employees/:id/:section`); mục con mở bên trong popup. Mở popup chỉ gọi `summary`.
 */
export function ProfilePanel({ self = false }: { self?: boolean }) {
  const params = useParams();
  const { me } = useShell();
  const navigate = useNavigate();
  const location = useLocation();
  const background = (location.state as ProfileState | null)?.background;
  const id = self ? me?.employee?.id : params.id;
  const section = params.section;

  const box = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  // Mở từ trong ứng dụng thì Back đóng popup; mở thẳng URL thì về trang chủ.
  const close = () => navigate(background ? { pathname: background.pathname, search: background.search } : '/', { replace: true });
  useDialog(box, title, close);

  const summary = useApi<ProfileSummary | null>(() => (id ? getSummary(id) : Promise.resolve(null)), [id]);
  const s = summary.data;
  const current = section ? s?.sections.find((x) => x.code === section) : undefined;

  const back = () => navigate(-1);
  const heading = section ? (current?.title ?? 'Hồ sơ') : 'Hồ sơ';

  return (
    <div className="overlay panel-overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="panel" role="dialog" aria-modal="true" aria-labelledby="panel-title" ref={box}>
        <div className={section ? 'panel-bar sub' : 'panel-bar'}>
          {section ? (
            <button type="button" className="icon-btn" aria-label="Quay lại hồ sơ" onClick={back}>
              <ChevronLeft size={22} />
            </button>
          ) : (
            <button type="button" className="icon-btn only-mobile" aria-label="Đóng hồ sơ" onClick={close}>
              <ChevronLeft size={22} />
            </button>
          )}
          <h2 id="panel-title" tabIndex={-1} ref={title}>
            {heading}
            {s && !section && <span className="sr-only">: {s.fullName}</span>}
          </h2>
          <button type="button" className="icon-btn panel-x" aria-label="Đóng hồ sơ" onClick={close}>
            <X size={20} />
          </button>
        </div>

        <div className="panel-body">
          {self && me && !me.employee && <p className="pad">Tài khoản chưa gắn với hồ sơ nhân viên nào. Liên hệ HR.</p>}
          {summary.error && <p className="error pad">{errorText(summary.error)}</p>}
          {!s && !summary.error && id && <div className="pad"><Skeleton lines={6} /></div>}
          {s && section && <SectionPage summary={s} code={section} def={current} />}
          {s && !section && <ProfileHome s={s} />}
        </div>
      </div>
    </div>
  );
}

function ProfileHome({ s }: { s: ProfileSummary }) {
  const openProfile = useOpenProfile();
  const has = (code: string) => s.sections.find((x) => x.code === code);
  const salary = has('salary');
  const insurance = has('insurance-salary');
  const groups = (Object.keys(GROUP_TITLE) as SectionGroup[])
    .map((g) => ({ g, items: s.sections.filter((x) => x.group === g) }))
    .filter((x) => x.items.length > 0);

  return (
    <>
      <div className="profile-head">
        <Avatar name={s.fullName} size="lg" />
        <span className="code-badge">{s.employeeCode}</span>
        <div className="profile-name">{s.fullName}</div>
        <div className="profile-role">{s.positionTitle ?? '—'}</div>
      </div>

      <div className="cards">
        <button type="button" className="card-cell" disabled={!s.managerId} onClick={() => s.managerId && openProfile(s.managerId)}>
          <Avatar name={s.managerName ?? '—'} size="md" />
          <small>Quản lý trực tiếp</small>
          <b>{s.managerName ?? '—'}</b>
        </button>
        <Link className="card-cell" to={`/org?dept=${s.departmentId}`}>
          <span className="circ"><Network size={20} /></span>
          <small>Xem sơ đồ tổ chức</small>
          <b>{s.departmentName ?? '—'}</b>
        </Link>
      </div>

      <div className="blk">
        <div className="row static">
          <Phone size={18} className="ri" aria-hidden="true" />
          <span className="t">Điện thoại</span>
          <span className="v">{s.phone ? <a href={`tel:${s.phone.replace(/[^+0-9]/g, '')}`}>{s.phone}</a> : '—'}</span>
        </div>
        <div className="row static">
          <Mail size={18} className="ri" aria-hidden="true" />
          <span className="t">Email công ty</span>
          <span className="v ellipsis"><a href={`mailto:${s.workEmail}`}>{s.workEmail}</a></span>
        </div>
      </div>

      {(salary || insurance || s.contractType !== undefined) && (
        <div className="blk">
          {salary && (
            <div className="row static">
              <BadgeDollarSign size={18} className="ri" aria-hidden="true" />
              <span className="t">Lương mục tiêu</span>
              <span className="v">
                <MaskedValue
                  label="lương mục tiêu"
                  format={formatMoney}
                  load={() =>
                    api<SalarySection>(`/employees/${s.id}/profile/salary?reveal=true`).then((r) => r.salary.value)
                  }
                />
              </span>
            </div>
          )}
          {insurance && (
            <SectionRow s={s} def={insurance} label="Hệ số lương bảo hiểm" />
          )}
          {s.contractType !== undefined && (
            <div className={`row static ${s.contractType ? '' : 'no'}`}>
              <ClipboardList size={18} className="ri" aria-hidden="true" />
              <span className="t">Diện đối tượng</span>
              <span className="v">{s.contractType ?? <TodoBadge />}</span>
            </div>
          )}
        </div>
      )}

      {s.canEdit && (
        <div className="pad">
          <Link className="button primary" to={`/employees/${s.id}/edit`}>Sửa hồ sơ</Link>
        </div>
      )}

      <div className="groups">
        {groups.map(({ g, items }) => (
          <section key={g} className="group">
            <h3 className="group-title">{GROUP_TITLE[g]}</h3>
            <div className="blk">
              {items.map((d) => <SectionRow key={d.code} s={s} def={d} />)}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}

/** Một hàng mục: biểu tượng, tiêu đề, mũi tên; mục chưa làm có tiêu đề đỏ và nhãn "Chưa có" (AC-1.8.2). */
function SectionRow({ s, def, label }: { s: ProfileSummary; def: SectionSummary; label?: string }) {
  const openProfile = useOpenProfile();
  const Icon = SECTION_ICON[def.code] ?? FileText;
  return (
    <button type="button" className={`row ${def.available ? '' : 'no'}`} onClick={() => openProfile(s.id, def.code)}>
      <Icon size={18} className="ri" aria-hidden="true" />
      <span className="t">{label ?? def.title}</span>
      <span className="v">
        {!def.available && <TodoBadge />}
        {def.pendingRequests > 0 && <span className="pend">Chờ HR</span>}
        <ChevronRight size={18} className="ch" aria-hidden="true" />
      </span>
    </button>
  );
}
