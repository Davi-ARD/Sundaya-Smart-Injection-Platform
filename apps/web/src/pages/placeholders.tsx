import { Factory, LayoutDashboard, Users, Wrench, Route } from 'lucide-react'
import { PagePlaceholder } from '../components/PagePlaceholder'

// ponytail: sisa placeholder tinggal halaman staf Sundaya; dipindah ke
// features/<domain>/ oleh Dev A saat konten fungsionalnya diimplementasi.

// --- Staf Sundaya (diimplementasi Dev A) ---
export const SundayaDashboardPage = () => (
  <PagePlaceholder
    icon={LayoutDashboard}
    title="Dashboard Sundaya"
    description="Monitoring OEE armada dan status booking."
  />
)

export const MachinesPage = () => (
  <PagePlaceholder
    icon={Factory}
    title="Mesin"
    description="Kelola mesin, ketersediaan, dan input status operasional (Layer 1)."
  />
)

export const MoldTrackingPage = () => (
  <PagePlaceholder
    icon={Route}
    title="Mold Tracking"
    description="Transisi status fisik cetakan sepanjang siklus produksi."
  />
)

export const MaintenancePage = () => (
  <PagePlaceholder
    icon={Wrench}
    title="Maintenance"
    description="Jadwalkan dan eksekusi maintenance mesin."
  />
)

export const UsersPage = () => (
  <PagePlaceholder
    icon={Users}
    title="Pengguna"
    description="Kelola akun staf Sundaya (Super Admin)."
  />
)
