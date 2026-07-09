import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import type { LoginRequest } from '@mold-tracker/shared'
import { useAuth } from '../features/auth/authContextValue'
import logo from '../assets/sundaya-Logo.png'

export function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState<LoginRequest>({
    email: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    login(form)
      .then(() => {
        const pathname =
          typeof location.state === 'object' &&
          location.state &&
          'from' in location.state
            ? location.state.from?.pathname
            : '/dashboard'
        navigate(pathname ?? '/dashboard', { replace: true })
      })
      .catch((caughtError) => {
        setIsSubmitting(false)
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Login tidak dapat diproses.',
        )
      })
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dbeafe_0,#f8fafc_36%,#eef2f7_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl overflow-hidden rounded-[28px] border border-white/70 bg-white/75 shadow-2xl shadow-slate-300/40 backdrop-blur lg:grid-cols-[1.08fr_0.92fr]">
        <div className="relative flex min-h-[44vh] flex-col justify-between overflow-hidden bg-slate-950 px-6 py-8 text-white sm:px-10 lg:min-h-full">
          <div className="absolute inset-0 opacity-70">
            <div className="auth-scanline absolute inset-0"></div>
            <div className="absolute -left-20 top-20 h-60 w-60 rounded-full bg-brand-500/25 blur-3xl"></div>
            <div className="absolute bottom-10 right-0 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl"></div>
          </div>

          <div className="relative">
            <img
              src={logo}
              alt="Mold Tracker"
              className="mb-6 h-16 w-auto"
            />

            <p className="text-sm font-semibold uppercase tracking-wide text-brand-300">
              Mold Tracker
            </p>

            <h1 className="mt-5 max-w-2x text-4xl font-bold leading-tight sm:text-5xl">
              Ruang kontrol akses untuk produksi molding
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
              Pantau penyewaan, operator, dan akses pengguna dari satu pintu
              masuk yang rapi.
            </p>
          </div>

          <div className="relative mt-10 grid gap-3 sm:grid-cols-3">
            {[
              ['4', 'Role aktif'],
              ['24', 'Jam monitoring'],
              ['1', 'Akses terpadu'],
            ].map(([value, label]) => (
              <div
                key={label}
                className="group rounded-lg border border-white/10 bg-white/10 p-4 transition duration-300 hover:-translate-y-1 hover:bg-white/15"
              >
                <p className="text-3xl font-bold text-white">{value}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-300">
                  {label}
                </p>
              </div>
            ))}
          </div>

          <div className="relative mt-8 rounded-xl border border-white/10 bg-white/10 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white">
                  Status sistem
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  Mock service siap diganti ke API nyata.
                </p>
              </div>
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400"></span>
              </span>
            </div>
          </div>
        </div>

        <section className="flex items-center justify-center px-4 py-8 sm:px-8 lg:px-10">
          <div className="w-full max-w-md">
            <div className="rounded-2xl border border-white bg-white p-6 shadow-xl shadow-slate-200/70 transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-300/60 sm:p-8">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
                  Selamat datang
                </p>
                <h2 className="mt-2 text-3xl font-bold text-slate-950">
                  Masuk ke akun
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Gunakan akun yang sudah terdaftar untuk membuka dashboard.
                </p>
              </div>

              <form className="mt-7 space-y-5" onSubmit={submit}>
                <label className="group block">
                  <span className="text-sm font-semibold text-slate-700">
                    Email
                  </span>
                  <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 transition group-focus-within:border-brand-500 group-focus-within:bg-white group-focus-within:ring-4 group-focus-within:ring-brand-100">
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                      className="w-full bg-transparent text-slate-950 outline-none placeholder:text-slate-400"
                      placeholder="nama@perusahaan.com"
                      required
                    />
                  </div>
                </label>

                <label className="group block">
                  <span className="text-sm font-semibold text-slate-700">
                    Kata sandi
                  </span>
                  <div className="mt-2 flex rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 transition group-focus-within:border-brand-500 group-focus-within:bg-white group-focus-within:ring-4 group-focus-within:ring-brand-100">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          password: event.target.value,
                        }))
                      }
                      className="w-full bg-transparent text-slate-950 outline-none placeholder:text-slate-400"
                      placeholder="Masukkan kata sandi"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      className="ml-3 shrink-0 text-sm font-semibold text-brand-700 hover:text-brand-600"
                    >
                      {showPassword ? 'Sembunyikan' : 'Lihat'}
                    </button>
                  </div>
                </label>

                {error ? (
                  <p className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="group flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-300 transition hover:-translate-y-0.5 hover:bg-brand-700 disabled:cursor-wait disabled:opacity-70"
                >
                  <span>{isSubmitting ? 'Memproses...' : 'Masuk'}</span>
                  <span className="transition group-hover:translate-x-1">
                    {isSubmitting ? '' : '>'}
                  </span>
                </button>
              </form>

              <p className="mt-7 text-center text-sm text-slate-600">
                Belum punya akun?{' '}
                <Link
                  className="font-semibold text-brand-700 hover:text-brand-600"
                  to="/register"
                >
                  Daftar mandiri
                </Link>
              </p>
            </div>
          </div>
        </section>
      </section>
    </main>
  )
}
