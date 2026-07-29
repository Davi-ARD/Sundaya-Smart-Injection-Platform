import {
  Factory,
  Gauge,
  LayoutDashboard,
  ClipboardList,
  UserCog,
  Users,
  Wrench,
  Route,
} from 'lucide-react'
import { PagePlaceholder } from '../components/PagePlaceholder'

// ponytail: semua halaman fase 6 masih placeholder di satu file; tiap halaman
// dipindah ke features/<domain>/ saat konten fungsionalnya diimplementasi.

// --- Manager Penyewa ---
export const PenyewaAdminsPage = () => (
  <PagePlaceholder
    icon={UserCog}
    title="Akun Admin Penyewa"
    description="Undang dan kelola akun Admin Penyewa di bawah perusahaan Anda."
  />
)

// --- Admin Penyewa ---
export const JobDashboardPage = () => (
  <PagePlaceholder
    icon={Gauge}
    title="Dashboard Job"
    description="Pantau job aktif di lokasi Sundaya: progress, mesin, dan material."
  />
)

export const LogProduksiPage = () => (
  <PagePlaceholder
    icon={ClipboardList}
    title="Log Produksi"
    description="Catat timeline produksi: material datang, produksi harian, progress molding."
  />
)

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
