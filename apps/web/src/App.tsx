import { Navigate, Route, Routes } from 'react-router-dom';
import { Role } from '@mold-tracker/shared';
import { AppLayout } from './components/AppLayout';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { CatalogPage } from './pages/CatalogPage';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { MachinesPage } from './pages/MachinesPage';
import { OperatorsPage } from './pages/OperatorsPage';
import { ProductionPage } from './pages/ProductionPage';
import { ProfilePage } from './pages/ProfilePage';
import { RegisterPage } from './pages/RegisterPage';
import { ReportsPage } from './pages/ReportsPage';
import { RentalCyclePage } from './pages/RentalCyclePage';
import { RentalsPage } from './pages/RentalsPage';
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
          <Route path="/profile" element={<ProfilePage />} />

          {/* Proteksi khusus untuk Role ADMIN */}
          <Route element={<ProtectedRoute allowedRoles={[Role.ADMIN]} />}>
            <Route path="/users" element={<UsersPage />} />
          </Route>

          {/* Proteksi khusus untuk Role PENYEWA */}
          <Route element={<ProtectedRoute allowedRoles={[Role.PENYEWA]} />}>
            <Route path="/operators" element={<OperatorsPage />} />
          </Route>

          {/* Proteksi khusus untuk Role ADMIN & PENYEDIA */}
          <Route element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.PENYEDIA]} />}>
            <Route path="/machines" element={<MachinesPage />} />
          </Route>

          {/* Katalog: ADMIN lihat saja, PENYEWA bisa mengajukan sewa */}
          <Route element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.PENYEWA]} />}>
            <Route path="/catalog" element={<CatalogPage />} />
          </Route>

          {/* Proteksi khusus untuk Role PENYEWA: status sewa */}
          <Route element={<ProtectedRoute allowedRoles={[Role.PENYEWA]} />}>
            <Route path="/rentals" element={<RentalsPage />} />
          </Route>

          {/* Panel siklus sewa: ADMIN dan PENYEDIA sama-sama berwenang penuh (lihat @Roles di rentals.controller) */}
          <Route element={<ProtectedRoute allowedRoles={[Role.ADMIN, Role.PENYEDIA]} />}>
            <Route path="/rental-cycle" element={<RentalCyclePage />} />
          </Route>

          {/* Batch produksi: semua role bisa lihat (disaring server), hanya OPERATOR bisa input */}
          <Route path="/production" element={<ProductionPage />} />

          {/* Laporan: sama seperti backend @Roles di ReportsController (PENYEWA, ADMIN) */}
          <Route element={<ProtectedRoute allowedRoles={[Role.PENYEWA, Role.ADMIN]} />}>
            <Route path="/reports" element={<ReportsPage />} />
          </Route>
        </Route>
      </Route>

      {/* Fallback route */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}