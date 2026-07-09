import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { CreateOperatorRequest, User } from '@mold-tracker/shared'
import { useAuth } from '../features/auth/authContextValue'

const emptyForm: CreateOperatorRequest = {
  nama: '',
  email: '',
  password: '',
}

export function OperatorsPage() {
  const { listOperators, createOperator } = useAuth()
  const [operators, setOperators] = useState<User[]>([])
  const [form, setForm] = useState<CreateOperatorRequest>(emptyForm)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const loadOperators = useCallback(async () => {
    try {
      setOperators(await listOperators())
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Gagal memuat operator.')
    }
  }, [listOperators])

  useEffect(() => {
    void loadOperators()
  }, [loadOperators])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotice('')
    setError('')

    try {
      await createOperator(form)
      setForm(emptyForm)
      await loadOperators()
      setNotice('Operator berhasil dibuat.')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Operator tidak dapat dibuat.',
      )
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-bold text-slate-950">
          Manajemen Operator
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Penyewa dapat membuat dan melihat sub-akun Operator di bawah akun
          miliknya.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <form onSubmit={submit} className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Buat operator
          </h2>
          <div className="mt-4 space-y-4">
            <OperatorInput
              label="Nama"
              value={form.nama}
              onChange={(value) =>
                setForm((current) => ({ ...current, nama: value }))
              }
            />
            <OperatorInput
              label="Email"
              type="email"
              value={form.email}
              onChange={(value) =>
                setForm((current) => ({ ...current, email: value }))
              }
            />
            <OperatorInput
              label="Kata sandi"
              type="password"
              value={form.password}
              onChange={(value) =>
                setForm((current) => ({ ...current, password: value }))
              }
            />
          </div>

          {notice ? (
            <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {notice}
            </p>
          ) : null}
          {error ? (
            <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="mt-5 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Simpan operator
          </button>
        </form>

        <section className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Daftar operator
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Data mengikuti kontrak `GET /operators`.
          </p>

          <div className="mt-4 divide-y divide-slate-100">
            {operators.length ? (
              operators.map((operator) => (
                <article
                  key={operator.id}
                  className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <h3 className="font-semibold text-slate-950">
                      {operator.nama}
                    </h3>
                    <p className="text-sm text-slate-500">{operator.email}</p>
                  </div>
                  <span className="w-fit rounded-md bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-700">
                    {operator.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </article>
              ))
            ) : (
              <p className="py-6 text-sm text-slate-500">
                Belum ada operator untuk Penyewa ini.
              </p>
            )}
          </div>
        </section>
      </section>
    </div>
  )
}

function OperatorInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        required
      />
    </label>
  )
}
