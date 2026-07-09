import { Navigate, Route, Routes } from 'react-router-dom';
import { Role } from '@mold-tracker/shared';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { OperatorsPage } from './pages/OperatorsPage';
import { RegisterPage } from './pages/RegisterPage';
import { UsersPage } from './pages/UsersPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Wrapper utama untuk semua route yang butuh login */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* Proteksi khusus untuk Role ADMIN */}
          <Route element={<ProtectedRoute allowedRoles={[Role.ADMIN]} />}>
            <Route path="/users" element={<UsersPage />} />
          </Route>

          {/* Proteksi khusus untuk Role PENYEWA */}
          <Route element={<ProtectedRoute allowedRoles={[Role.PENYEWA]} />}>
            <Route path="/operators" element={<OperatorsPage />} />
          </Route>
        </Route>
      </Route>

      {/* Fallback route */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}