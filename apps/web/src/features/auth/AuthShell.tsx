import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CircuitBoard, ShieldCheck, Timer } from 'lucide-react'

// Kerangka dua-kolom untuk halaman auth (login/register/internal). Panel kiri
// brand (Persuade ringkas), kanan form. Panel kiri disembunyikan di mobile.
export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside
        className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex"
        style={{ background: 'linear-gradient(150deg, #0f1e3d 0%, #1e40af 100%)' }}
      >
        <div className="absolute inset-0 hero-glow" aria-hidden />
        <Link to="/" className="relative flex items-center gap-2 text-sm font-bold tracking-wide">
          <CircuitBoard className="h-5 w-5 text-brand-300" />
          SSIP
        </Link>

        <div className="relative">
          <h2 className="max-w-md text-3xl font-bold leading-tight">
            Sundaya Smart Injection Platform
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-brand-100/80">
            Kolaborasi digital antara Penyewa dan Sundaya untuk booking mesin injection
            molding, tracking cetakan, dan monitoring produksi secara real time.
          </p>

          <ul className="mt-8 space-y-3 text-sm">
            <li className="flex items-center gap-3 text-brand-50">
              <ShieldCheck className="h-4 w-4 text-accent-500" /> Data perusahaan terisolasi per tenant
            </li>
            <li className="flex items-center gap-3 text-brand-50">
              <Timer className="h-4 w-4 text-accent-500" /> Pantau ketepatan pengiriman dan progress
            </li>
          </ul>
        </div>

        <p className="relative text-xs text-brand-200/70">PT Sundaya Indonesia</p>
      </aside>

      <main className="flex items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">{eyebrow}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  )
}

export function AuthField({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  label: string
  type?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoComplete?: string
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        required
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none transition-all duration-150 placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
      />
    </label>
  )
}
