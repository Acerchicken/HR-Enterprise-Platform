import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/auth';
import { Layout } from './components/Layout';
import { CallbackPage } from './pages/CallbackPage';
import { DirectoryPage } from './pages/DirectoryPage';
import { EmployeePage } from './pages/EmployeePage';
import { EmployeeFormPage } from './pages/employee/EmployeeFormPage';
import { LeaveDetailPage } from './pages/leave/LeaveDetailPage';
import { LeaveListPage } from './pages/leave/LeaveListPage';
import { NewLeavePage } from './pages/leave/NewLeavePage';
import { LoginPage } from './pages/LoginPage';
import { OrgPage } from './pages/OrgPage';
import { ProfilePage } from './pages/ProfilePage';

export function App() {
  const { ready, token } = useAuth();
  if (!ready) return <p className="center">Đang tải…</p>;

  return (
    <Routes>
      <Route path="/callback" element={<CallbackPage />} />
      {!token ? (
        <Route path="*" element={<LoginPage />} />
      ) : (
        <Route element={<Layout />}>
          <Route index element={<ProfilePage />} />
          <Route path="directory" element={<DirectoryPage />} />
          <Route path="employees/new" element={<EmployeeFormPage key="new" mode="create" />} />
          <Route path="employees/:id/edit" element={<EmployeeFormPage key="edit" mode="edit" />} />
          <Route path="employees/:id" element={<EmployeePage />} />
          <Route path="org" element={<OrgPage />} />
          <Route path="leave" element={<LeaveListPage key="mine" mode="mine" />} />
          <Route path="leave/new" element={<NewLeavePage />} />
          <Route path="leave/approvals" element={<LeaveListPage key="approvals" mode="approvals" />} />
          <Route path="leave/hr" element={<LeaveListPage key="hr" mode="hr" />} />
          <Route path="leave/:id" element={<LeaveDetailPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      )}
    </Routes>
  );
}
