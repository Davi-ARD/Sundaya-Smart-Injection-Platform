import { Link, Navigate } from 'react-router-dom'
import {
  ArrowRight,
  Boxes,
  CircuitBoard,
  ClipboardList,
  Gauge,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import { useAuth } from '../features/auth/authContextValue'
import { homePathForRole } from '../features/auth/roleLabels'

const features = [
  { icon: Boxes, title: 'Kelola Cetakan', desc: 'Daftarkan mold beserta rencana material dan target produksi.' },
  { icon: Gauge, title: 'Booking Mesin', desc: 'Ajukan sewa tanpa memilih mesin; Sundaya yang meng-assign.' },
  { icon: ClipboardList, title: 'Log Produksi', desc: 'Catat timeline produksi harian langsung dari lokasi Sundaya.' },
  { icon: Truck, title: 'Log Pengiriman', desc: 'Bandingkan rencana vs aktual kedatangan mold dan material.' },
]

export function LandingPage() {
  const { isAuthenticated, user } = useAuth()
  if (isAuthenticated && user) return <Navigate to={homePathForRole(user.role)} replace />

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="flex items-center gap-2 text-sm font-bold tracking-wide text-slate-900">
          <CircuitBoard className="h-5 w-5 text-brand-700" /> SSIP
        </span>
        <nav className="flex items-center gap-2">
          <Link
            to="/login"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
          >
            Masuk
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-800 hover:-translate-y-0.5"
          >
            Daftar <ArrowRight className="h-4 w-4" />
          </Link>
        </nav>
      </header>

      <section
        className="relative overflow-hidden text-white"
        style={{ background: 'linear-gradient(150deg, #0f1e3d 0%, #1e40af 100%)' }}
      >
        <div className="absolute inset-0 hero-glow" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-6 py-24 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-100 ring-1 ring-inset ring-white/15">
            PT Sundaya Indonesia
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
            Platform sewa dan monitoring mesin injection molding
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-brand-100/85">
            Sundaya Smart Injection Platform menghubungkan perusahaan penyewa dengan Sundaya:
            booking mesin, tracking cetakan, dan log produksi dalam satu sistem terpadu.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-accent-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-accent-600/25 transition-all hover:bg-accent-700 hover:-translate-y-0.5"
            >
              Daftar sebagai Manager <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-lg border border-white/25 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              Masuk
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-soft transition-shadow hover:shadow-soft-lg"
            >
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <feature.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-slate-500">{feature.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center gap-2 rounded-2xl border border-brand-100 bg-brand-50/60 px-6 py-8 text-center">
          <ShieldCheck className="h-6 w-6 text-brand-700" />
          <p className="text-sm font-medium text-slate-700">
            Data setiap perusahaan penyewa terisolasi dan hanya dapat diakses oleh timnya sendiri.
          </p>
        </div>
      </section>

      <footer className="border-t border-slate-200 px-6 py-8">
        <p className="mx-auto max-w-6xl text-center text-xs text-slate-400">
          &copy; {new Date().getFullYear()} PT Sundaya Indonesia. Sundaya Smart Injection Platform.
        </p>
      </footer>
    </div>
  )
}
