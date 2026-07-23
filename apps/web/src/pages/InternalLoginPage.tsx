import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../features/auth/authContextValue'
import { homePathForRole } from '../features/auth/roleLabels'
import { AuthShell, AuthField } from '../features/auth/AuthShell'
import { Button } from '../components/ui/Button'
import { errorMessage } from '../lib/errorMessage'

// Portal internal staf Sundaya (Super Admin, Admin Sundaya, Teknisi). Tidak ada
// self-register; akun dibuat internal oleh Super Admin. Backend auth sama.
export function InternalLoginPage() {
  const { isAuthenticated, user, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
      const response = await login({ identifier: email, password })
      navigate(homePathForRole(response.user.role), { replace: true })
    } catch (caught) {
      setError(errorMessage(caught, 'Login gagal. Periksa email dan kata sandi.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthShell
      eyebrow="Portal Internal Sundaya"
      title="Masuk staf Sundaya"
      subtitle="Khusus Super Admin, Admin Sundaya, dan Teknisi."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField label="Email" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="nama@sundaya.com" />
        <AuthField label="Kata sandi" type="password" value={password} onChange={setPassword} autoComplete="current-password" placeholder="••••••••" />

        {error ? (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 ring-1 ring-inset ring-rose-600/15">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Memproses...' : 'Masuk'}
        </Button>
      </form>

      <p className="mt-6 text-xs text-slate-400">
        Penyewa?{' '}
        <Link to="/login" className="font-medium text-slate-500 hover:text-slate-700">
          Masuk lewat portal Penyewa
        </Link>
      </p>
    </AuthShell>
  )
}
