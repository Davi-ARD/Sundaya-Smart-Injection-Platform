import { Navigate, Route, Routes } from 'react-router-dom'
import { Role } from '@mold-tracker/shared'
import { AppLayout } from './components/AppLayout'
import { ProtectedRoute } from './features/auth/ProtectedRoute'
import { LandingPage } from './pages/LandingPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { KontakPage, FaqPage, SyaratKetentuanPage } from './pages/InfoPages'
import { ProfilePage } from './pages/ProfilePage'
import { MoldsPage } from './features/molds/MoldsPage'
import { MachinesPage } from './features/machines/MachinesPage'
import { SundayaDashboardPage } from './features/dashboard/SundayaDashboardPage'
import { SundayaBookingPage } from './features/booking/SundayaBookingPage'
import { MaintenancePage } from './features/maintenance/MaintenancePage'
import { UsersPage } from './features/users/UsersPage'
import { ManagerDashboardPage } from './features/dashboard/ManagerDashboardPage'
import { JobDashboardPage } from './features/dashboard/JobDashboardPage'
import { BookingPage } from './features/booking/BookingPage'
import { PengirimanPage } from './features/pengiriman/PengirimanPage'
import { PenerimaanPage } from './features/penerimaan/PenerimaanPage'
import { PenyewaAdminsPage } from './features/penyewa-admins/PenyewaAdminsPage'
import { LogProduksiPage } from './features/log-produksi/LogProduksiPage'

const MANAGER = [Role.MANAGER_PENYEWA]
const ADMIN_PENYEWA = [Role.ADMIN_PENYEWA]
const STAF = [Role.SUPER_ADMIN, Role.ADMIN_SUNDAYA, Role.TEKNISI_SUNDAYA]

export default function App() {
  return (
    <Routes>
      {/* Publik */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/kontak" element={<KontakPage />} />
      <Route path="/faq" element={<FaqPage />} />
      <Route path="/syarat-ketentuan" element={<SyaratKetentuanPage />} />

      {/* Butuh login */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/profile" element={<ProfilePage />} />

          {/* Manager Penyewa */}
          <Route element={<ProtectedRoute allowedRoles={MANAGER} />}>
            <Route path="/manager" element={<ManagerDashboardPage />} />
            <Route path="/molds" element={<MoldsPage />} />
            <Route path="/booking" element={<BookingPage />} />
            <Route path="/pengiriman" element={<PengirimanPage />} />
            <Route path="/penyewa-admins" element={<PenyewaAdminsPage />} />
          </Route>

          {/* Admin Penyewa */}
          <Route element={<ProtectedRoute allowedRoles={ADMIN_PENYEWA} />}>
            <Route path="/job" element={<JobDashboardPage />} />
            <Route path="/logs" element={<LogProduksiPage />} />
            <Route path="/penerimaan" element={<PenerimaanPage />} />
          </Route>

          {/* Staf Sundaya */}
          <Route element={<ProtectedRoute allowedRoles={STAF} />}>
            <Route path="/staff" element={<SundayaDashboardPage />} />
            <Route path="/staff/booking" element={<SundayaBookingPage />} />
            <Route path="/machines" element={<MachinesPage />} />
            <Route path="/maintenance" element={<MaintenancePage />} />
          </Route>

          {/* Pengguna: Super Admin */}
          <Route element={<ProtectedRoute allowedRoles={[Role.SUPER_ADMIN]} />}>
            <Route path="/users" element={<UsersPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
