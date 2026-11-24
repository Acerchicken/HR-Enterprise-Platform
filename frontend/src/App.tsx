import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/auth';
import { IdleGuard } from './auth/idle';
import { Layout } from './components/Layout';
import { ShellProvider } from './components/shell';
import { AssistantConfigPage } from './pages/admin/AssistantConfigPage';
import { RolesPage } from './pages/admin/RolesPage';
import { ApprovalsPage } from './pages/ApprovalsPage';
import { AuditPage } from './pages/AuditPage';
import { ExpiringContractsPage } from './pages/ExpiringContractsPage';
import { CallbackPage } from './pages/CallbackPage';
import { DirectoryPage } from './pages/DirectoryPage';
import { DocumentDetailPage } from './pages/documents/DocumentDetailPage';
import { DocumentManagePage } from './pages/documents/DocumentManagePage';
import { DocumentsPage } from './pages/documents/DocumentsPage';
import { EmployeeFormPage } from './pages/employee/EmployeeFormPage';
import { ComingSoonPage, HomePage } from './pages/HomePage';
import { LeaveDetailPage } from './pages/leave/LeaveDetailPage';
import { LeaveListPage } from './pages/leave/LeaveListPage';
import { NewLeavePage } from './pages/leave/NewLeavePage';
import { DelegationsPage, HolidaysPage, LeaveBalancesPage } from './pages/leave/LeaveHrPages';
import { LoginPage } from './pages/LoginPage';
import { OrgPage } from './pages/OrgPage';
import { PositionsPage } from './pages/org/PositionsPage';
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
      <IdleGuard />
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
          <Route path="org/positions" element={<PositionsPage />} />
          <Route path="leave" element={<LeaveListPage />} />
          <Route path="leave/new" element={<NewLeavePage />} />
          {/* Link cũ chuyển sang trang "Việc cần duyệt" (AC-0.6.4). */}
          <Route path="leave/approvals" element={<Navigate to="/approvals?type=leave" replace />} />
          <Route path="leave/hr" element={<Navigate to="/approvals?type=leave-complete" replace />} />
          <Route path="leave/balances" element={<LeaveBalancesPage />} />
          <Route path="leave/holidays" element={<HolidaysPage />} />
          <Route path="leave/:id" element={<LeaveDetailPage />} />
          <Route path="approvals" element={<ApprovalsPage />} />
          <Route path="approvals/delegations" element={<DelegationsPage />} />
          <Route path="approvals/:type/:id" element={<ApprovalsPage />} />
          <Route path="contracts/expiring" element={<ExpiringContractsPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="documents/manage" element={<DocumentManagePage />} />
          <Route path="documents/:id" element={<DocumentDetailPage />} />
          <Route path="admin/roles" element={<RolesPage />} />
          <Route path="admin/assistant" element={<AssistantConfigPage />} />
          <Route path="audit" element={<AuditPage />} />
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
