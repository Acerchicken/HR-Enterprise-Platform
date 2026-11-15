import { Location, useLocation, useNavigate } from 'react-router-dom';

/**
 * Popup hồ sơ có URL riêng (frontend.md mục 4.2): mở popup thì URL đổi thành `/me/profile` hoặc `/employees/{id}[/{section}]`,
 * còn trang phía sau giữ nguyên nhờ `state.background`. Mở thẳng URL (link được gửi) thì không có `background`, trang chủ
 * hiện phía sau.
 */
export interface ProfileState {
  background?: Location;
}

export function profilePath(id: string | 'me', section?: string) {
  if (id === 'me' && !section) return '/me/profile';
  return section ? `/employees/${id}/${section}` : `/employees/${id}`;
}

export function useOpenProfile() {
  const navigate = useNavigate();
  const location = useLocation();
  const background = (location.state as ProfileState | null)?.background ?? location;
  return (id: string | 'me', section?: string) => navigate(profilePath(id, section), { state: { background } });
}
