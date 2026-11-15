import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/auth';
import { Layout } from './components/Layout';
import { ShellProvider } from './components/shell';
import { CallbackPage } from './pages/CallbackPage';
import { DirectoryPage } from './pages/DirectoryPage';
import { EmployeeFormPage } from './pages/employee/EmployeeFormPage';
import { ComingSoonPage, HomePage } from './pages/HomePage';
import { LeaveDetailPage } from './pages/leave/LeaveDetailPage';
import { LeaveListPage } from './pages/leave/LeaveListPage';
import { NewLeavePage } from './pages/leave/NewLeavePage';
import { LoginPage } from './pages/LoginPage';
import { OrgPage } from './pages/OrgPage';
import { ProfileState } from './profile/navigation';
import { ProfilePanel } from './profile/ProfilePanel';

export function App() {
  const { ready, token } = useAuth();
  if (!ready) return <p className="center">Đang tải…</p>;
  if (!token) {
    return (
      <Routes>
        <Route path="/callback" element={<CallbackPage />} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }
  return (
    <ShellProvider>
      <AppRoutes />
    </ShellProvider>
  );
}

/**
 * Popup hồ sơ có URL (frontend.md 4.2): khi mở từ trong ứng dụng, trang phía sau render theo `state.background`; mở thẳng URL
 * hồ sơ thì trang chủ hiện phía sau. Popup luôn render theo URL thật.
 */
function AppRoutes() {
  const location = useLocation();
  const background = (location.state as ProfileState | null)?.background;

  return (
    <>
      <Routes location={background ?? location}>
        <Route path="/callback" element={<CallbackPage />} />
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="me/profile" element={<HomePage />} />
          <Route path="directory" element={<DirectoryPage />} />
          <Route path="employees/new" element={<EmployeeFormPage key="new" mode="create" />} />
          <Route path="employees/:id/edit" element={<EmployeeFormPage key="edit" mode="edit" />} />
          <Route path="employees/:id" element={<HomePage />} />
          <Route path="employees/:id/:section" element={<HomePage />} />
          <Route path="org" element={<OrgPage />} />
          <Route path="leave" element={<LeaveListPage key="mine" mode="mine" />} />
          <Route path="leave/new" element={<NewLeavePage />} />
          <Route path="leave/approvals" element={<LeaveListPage key="approvals" mode="approvals" />} />
          <Route path="leave/hr" element={<LeaveListPage key="hr" mode="hr" />} />
          <Route path="leave/:id" element={<LeaveDetailPage />} />
          <Route path="coming-soon" element={<ComingSoonPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Routes>
        <Route path="/me/profile" element={<ProfilePanel key="me" self />} />
        <Route path="/employees/new" element={null} />
        <Route path="/employees/:id/edit" element={null} />
        <Route path="/employees/:id" element={<ProfilePanel />} />
        <Route path="/employees/:id/:section" element={<ProfilePanel />} />
        <Route path="*" element={null} />
      </Routes>
    </>
  );
}
