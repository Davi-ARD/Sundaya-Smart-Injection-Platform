import { useState, type ComponentType, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Eye, EyeOff } from 'lucide-react'
import sundayaIcon from '../../assets/icon-sundaya.png'

// Kerangka dua-kolom untuk halaman auth (login/register). Panel kiri brand
// (Persuade ringkas), kanan form. Panel kiri disembunyikan di mobile.
export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
  leftPanel,
}: {
  eyebrow: string
  title: string
  subtitle: string
  children: ReactNode
  // Override konten tengah panel kiri (badge/heading/kartu khusus halaman).
  // Kalau tidak diisi, pakai pitch generik default di bawah.
  leftPanel?: ReactNode
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-5">
      <aside
        className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:col-span-3 lg:flex"
        style={{ background: 'linear-gradient(150deg, #0f1e3d 0%, #1e40af 100%)' }}
      >
        {/* Foto mesin injection molding, opacity rendah sebagai tekstur latar. */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.12]"
          style={{ backgroundImage: "url('/mesin_molding.jpeg')" }}
          aria-hidden
        />
        <div className="absolute inset-0 hero-glow" aria-hidden />
        <div className="absolute inset-0 hero-pattern" aria-hidden />
        <Link to="/" className="relative flex items-center gap-2 text-base font-bold tracking-wide">
          <img src={sundayaIcon} alt="Sundaya" className="h-8 w-8 object-contain" />
          Sundaya Smart Injection Platform
        </Link>

        {leftPanel ?? (
          <div className="relative">
            <h2 className="max-w-md text-3xl font-bold leading-tight">
              Sundaya Smart Injection Platform
            </h2>
            <p className="mt-3 max-w-md text-sm leading-normal text-brand-100/80">
              Kolaborasi digital antara Penyewa dan Sundaya untuk booking mesin injection
              molding, tracking cetakan, dan monitoring produksi secara real time.
            </p>

            <ul className="mt-8 space-y-3 text-sm">
              <li className="flex items-center gap-3 text-brand-50">
                <CheckCircle2 className="h-5= w-5 shrink-0 text-accent-500" strokeWidth={2.5} />
                Data perusahaan terisolasi per tenant
              </li>
              <li className="flex items-center gap-3 text-brand-50">
                <CheckCircle2 className="h-6 w-6 shrink-0 text-accent-500" strokeWidth={2.5} />
                Pantau ketepatan pengiriman dan progress
              </li>
            </ul>
          </div>
        )}

        <p className="relative text-xs text-brand-200/70">PT. Sundaya Indonesia</p>
      </aside>

      <main className="flex items-center justify-center bg-surface px-8 py-12 lg:col-span-2 lg:px-12">
        <div className="w-full max-w-sm">
          <span className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-700">
            {eyebrow}
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-800">{title}</h1>
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
  icon: Icon,
  labelRight,
  uppercaseLabel = false,
}: {
  label: string
  type?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  autoComplete?: string
  icon?: ComponentType<{ className?: string }>
  labelRight?: ReactNode
  uppercaseLabel?: boolean
}) {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type

  return (
    <label className="block">
      <span className="flex items-center justify-between gap-2">
        <span
          className={
            uppercaseLabel
              ? 'text-xs font-semibold uppercase tracking-wider text-slate-500'
              : 'text-sm font-medium text-slate-700'
          }
        >
          {label}
        </span>
        {labelRight}
      </span>
      <div className="relative mt-1.5">
        {Icon ? (
          <Icon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        ) : null}
        <input
          type={inputType}
          value={value}
          required
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          className={[
            'w-full rounded-lg border border-slate-200/80 bg-[#F9FAFB] py-2.5 text-slate-800 outline-none transition-all duration-150 placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-600 focus:bg-white focus:shadow-[0_0_0_4px_rgba(37,99,235,0.12)]',
            Icon ? 'pl-10' : 'pl-3',
            isPassword ? 'pr-10' : 'pr-3',
          ].join(' ')}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors duration-150 hover:text-slate-600"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        ) : null}
      </div>
    </label>
  )
}
