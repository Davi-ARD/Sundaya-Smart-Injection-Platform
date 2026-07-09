import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Role, type RegisterRequest } from '@mold-tracker/shared'
import { useAuth } from '../features/auth/authContextValue'
import logo from '../assets/sundaya-Logo.png'

export function RegisterPage() {
  const { register, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState<RegisterRequest>({
    nama: '',
    email: '',
    password: '',
    role: Role.PENYEWA,
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

    register(form)
      .then(() => {
        navigate('/dashboard', { replace: true })
      })
      .catch((caughtError) => {
        setIsSubmitting(false)
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Registrasi tidak dapat diproses.',
        )
      })
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,#d1fae5_0,#f8fafc_34%,#eef2f7_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <section className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl overflow-hidden rounded-[28px] border border-white/70 bg-white/75 shadow-2xl shadow-slate-300/40 backdrop-blur lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative hidden overflow-hidden bg-slate-950 px-10 py-8 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 opacity-75">
            <div className="auth-scanline absolute inset-0"></div>
            <div className="absolute -right-16 top-24 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl"></div>
            <div className="absolute bottom-4 left-0 h-72 w-72 rounded-full bg-brand-500/25 blur-3xl"></div>
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
            <h1 className="mt-5 max-w-lg text-4xl font-bold leading-tight">
              Buat akses baru dalam beberapa langkah
            </h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-slate-300">
              Registrasi mandiri disiapkan untuk Penyewa dan Penyedia. Operator
              dibuat oleh Penyewa dari halaman manajemen operator.
            </p>
          </div>

          <div className="relative space-y-10">
            {[
              ['Penyewa', 'Ajukan sewa dan pantau produksi harian.'],
              ['Penyedia', 'Kelola mesin dan proses permintaan sewa.'],
              ['Operator', 'Dibuat sebagai sub-akun oleh Penyewa.'],
            ].map(([title, description]) => (
              <div
                key={title}
                className="rounded-xl border border-white/10 bg-white/10 p-4 transition duration-300 hover:-translate-y-1 hover:bg-white/15"
              >
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-1 text-sm text-slate-300">{description}</p>
              </div>
            ))}
          </div>
        </div>

        <section className="flex items-center justify-center px-4 py-8 sm:px-8 lg:px-10">
          <div className="w-full max-w-xl">
            <div className="rounded-2xl border border-white bg-white p-6 shadow-xl shadow-slate-200/70 transition duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-300/60 sm:p-8">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
                  Mold Tracker
                </p>
                <h1 className="mt-2 text-3xl font-bold text-slate-950">
                  Registrasi akun
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  Pilih role, lengkapi data, lalu masuk ke dashboard sesuai
                  akses yang dibuat.
                </p>
              </div>

              <form className="mt-7 space-y-5" onSubmit={submit}>
                <div>
                  <span className="text-sm font-semibold text-slate-700">
                    Role
                  </span>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <RoleCard
                      title="Penyewa"
                      description="Sewa mesin dan kelola operator."
                      selected={form.role === Role.PENYEWA}
                      onClick={() =>
                        setForm((current: RegisterRequest) => ({
                          ...current,
                          role: Role.PENYEWA,
                        }))
                      }
                    />
                    <RoleCard
                      title="Penyedia"
                      description="Sediakan mesin dan kelola rental."
                      selected={form.role === Role.PENYEDIA}
                      onClick={() =>
                        setForm((current: RegisterRequest) => ({
                          ...current,
                          role: Role.PENYEDIA,
                        }))
                      }
                    />
                  </div>
                </div>

                <RegisterInput
                  label="Nama"
                  value={form.nama}
                  placeholder="Nama lengkap atau nama perusahaan"
                  onChange={(value) =>
                    setForm((current: RegisterRequest) => ({ ...current, nama: value }))
                  }
                />

                <RegisterInput
                  label="Email"
                  type="email"
                  value={form.email}
                  placeholder="nama@perusahaan.com"
                  onChange={(value) =>
                    setForm((current: RegisterRequest) => ({ ...current, email: value }))
                  }
                />

                <label className="group block">
                  <span className="text-sm font-semibold text-slate-700">
                    Kata sandi
                  </span>
                  <div className="mt-2 flex rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 transition group-focus-within:border-brand-500 group-focus-within:bg-white group-focus-within:ring-4 group-focus-within:ring-brand-100">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      minLength={6}
                      value={form.password}
                      onChange={(event) =>
                        setForm((current: RegisterRequest) => ({
                          ...current,
                          password: event.target.value,
                        }))
                      }
                      className="w-full bg-transparent text-slate-950 outline-none placeholder:text-slate-400"
                      placeholder="Minimal 6 karakter"
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
                  <span>{isSubmitting ? 'Memproses...' : 'Buat akun'}</span>
                  <span className="transition group-hover:translate-x-1">
                    {isSubmitting ? '' : '>'}
                  </span>
                </button>
              </form>

              <p className="mt-7 text-center text-sm text-slate-600">
                Sudah punya akun?{' '}
                <Link
                  className="font-semibold text-brand-700 hover:text-brand-600"
                  to="/login"
                >
                  Masuk
                </Link>
              </p>
            </div>
          </div>
        </section>
      </section>
    </main>
  )
}

function RegisterInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  type?: string
}) {
  return (
    <label className="group block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 transition group-focus-within:border-brand-500 group-focus-within:bg-white group-focus-within:ring-4 group-focus-within:ring-brand-100">
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full bg-transparent text-slate-950 outline-none placeholder:text-slate-400"
          placeholder={placeholder}
          required
        />
      </div>
    </label>
  )
}

function RoleCard({
  title,
  description,
  selected,
  onClick,
}: {
  title: string
  description: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-xl border p-4 text-left transition duration-300 hover:-translate-y-0.5',
        selected
          ? 'border-brand-500 bg-brand-50 shadow-lg shadow-brand-100'
          : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white',
      ].join(' ')}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="font-semibold text-slate-950">{title}</span>
        <span
          className={[
            'h-3 w-3 rounded-full border',
            selected ? 'border-brand-600 bg-brand-600' : 'border-slate-300',
          ].join(' ')}
        ></span>
      </span>
      <span className="mt-2 block text-sm leading-5 text-slate-500">
        {description}
      </span>
    </button>
  )
}
