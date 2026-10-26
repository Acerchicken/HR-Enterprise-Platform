import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/auth';
import { Layout } from './components/Layout';
import { CallbackPage } from './pages/CallbackPage';
import { DirectoryPage } from './pages/DirectoryPage';
import { EmployeePage } from './pages/EmployeePage';
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
          <Route path="employees/:id" element={<EmployeePage />} />
          <Route path="org" element={<OrgPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      )}
    </Routes>
  );
}
