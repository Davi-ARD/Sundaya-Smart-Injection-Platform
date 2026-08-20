import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Gauge, Lock, Mail, ShieldCheck } from 'lucide-react'
import { useAuth } from '../features/auth/authContextValue'
import { homePathForRole } from '../features/auth/roleLabels'
import { AuthShell, AuthField } from '../features/auth/AuthShell'
import { Button } from '../components/ui/Button'
import { useToast } from '../components/ui/Toast'
import { errorMessage } from '../lib/errorMessage'

// Satu form login untuk semua role (Penyewa maupun staf Sundaya). Role akun
// dideteksi backend dari database; redirect tujuan mengikuti role itu lewat
// homePathForRole, tidak ada pemilihan portal di UI.
export function LoginPage() {
  const { isAuthenticated, user, login } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isAuthenticated && user) {
    return <Navigate to={homePathForRole(user.role)} replace />
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const response = await login({ identifier: email, password }, remember)
      navigate(homePathForRole(response.user.role), { replace: true })
    } catch (caught) {
      setError(errorMessage(caught, 'Login gagal. Periksa email dan kata sandi.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell
      eyebrow="Portal Masuk"
      title="Masuk ke Akun Anda"
      subtitle="Masukkan email dan kata sandi Anda untuk melanjutkan ke SSIP."
      leftPanel={
        <div className="relative">
          <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-brand-50 backdrop-blur">
            PT Sundaya Indonesia · Platform Digital
          </span>
          <h2 className="mt-5 max-w-md text-3xl font-bold leading-tight">
            Selamat Datang Kembali di SSIP
          </h2>
          <p className="mt-3 max-w-md text-sm leading-normal text-brand-100/80">
            Satu portal untuk staf Sundaya dan perusahaan penyewa: booking mesin, tracking
            cetakan, dan monitoring produksi dalam satu sistem terpadu.
          </p>

          <div className="mt-8 space-y-3">
            <div className="flex items-start gap-3 rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center text-cyan-300">
                <ShieldCheck className="h-6 w-6" strokeWidth={2.5} />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Data Terisolasi</p>
                <p className="mt-0.5 text-xs leading-normal text-brand-100/70">
                  Setiap perusahaan penyewa memiliki ruang data terpisah dan aman.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center text-cyan-300">
                <Gauge className="h-6 w-6" strokeWidth={2.5} />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Monitoring Real-time</p>
                <p className="mt-0.5 text-xs leading-normal text-brand-100/70">
                  Pantau status mesin, booking, dan ketepatan pengiriman kapan saja.
                </p>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField
          label="Email"
          uppercaseLabel
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          placeholder="nama@email.com"
          icon={Mail}
        />
        <AuthField
          label="Kata sandi"
          uppercaseLabel
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          placeholder="••••••••"
          icon={Lock}
          labelRight={
            <button
              type="button"
              onClick={() => toast.error('Fitur reset kata sandi belum tersedia. Hubungi Admin Sundaya.')}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700"
            >
              Lupa kata sandi?
            </button>
          }
        />

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-2 focus:ring-brand-100"
          />
          Ingat saya di perangkat ini
        </label>

        {error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 ring-1 ring-inset ring-rose-600/15">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? (
            'Memproses...'
          ) : (
            <>
              Masuk Sekarang
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </Button>
      </form>

      <p className="mt-8 text-sm text-slate-500">
        Belum punya akun perusahaan?{' '}
        <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700">
          Daftar sebagai Manager
        </Link>
      </p>
    </AuthShell>
  )
}
