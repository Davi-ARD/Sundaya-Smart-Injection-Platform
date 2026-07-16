import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { errorMessage } from '../lib/errorMessage'
import type { CreateOperatorRequest, User } from '@mold-tracker/shared'
import { useAuth } from '../features/auth/authContextValue'
import { api } from '../lib/api'
import { useToast } from '../components/ui/Toast'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { TextField } from '../components/ui/FormField'
import { Skeleton } from '../components/ui/Skeleton'

const emptyForm: CreateOperatorRequest = {
  nama: '',
  password: '',
}

export function OperatorsPage() {
  const { accessToken } = useAuth()
  const toast = useToast()
  const [operators, setOperators] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState<CreateOperatorRequest>(emptyForm)
  const [deletingOperator, setDeletingOperator] = useState<User | null>(null)

  const loadOperators = useCallback(async () => {
    try {
      setOperators(await api.listOperators(accessToken))
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Gagal memuat operator.'))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, toast])

  useEffect(() => {
    void loadOperators()
  }, [loadOperators])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      await api.createOperator(accessToken, form)
      setForm(emptyForm)
      await loadOperators()
      toast.success('Operator berhasil dibuat.')
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Operator tidak dapat dibuat.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const confirmDeleteOperator = async () => {
    if (!deletingOperator) {
      return
    }

    try {
      await api.deleteOperator(accessToken, deletingOperator.id)
      await loadOperators()
      toast.success(`Operator ${deletingOperator.nama} berhasil dihapus.`)
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Operator tidak dapat dihapus.'))
    } finally {
      setDeletingOperator(null)
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-bold text-slate-950">Manajemen Operator</h1>
        <p className="mt-2 text-sm text-slate-600">
          Penyewa dapat membuat dan melihat sub-akun Operator di bawah akun miliknya.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <Card title="Buat operator" subtitle="Operator masuk memakai nama dan kata sandi ini, tanpa email.">
          <form onSubmit={submit} className="space-y-4">
            <TextField
              label="Nama"
              value={form.nama}
              onChange={(value) => setForm((current) => ({ ...current, nama: value }))}
            />
            <TextField
              label="Kata sandi"
              type="password"
              value={form.password}
              onChange={(value) => setForm((current) => ({ ...current, password: value }))}
            />

            <Button type="submit" className="mt-1" disabled={isSubmitting}>
              {isSubmitting ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </form>
        </Card>

        <Card title="Daftar operator" subtitle="Data mengikuti kontrak `GET /operators`.">
          {isLoading ? (
            <div className="space-y-4 py-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {operators.length ? (
                operators.map((operator) => (
                  <article
                    key={operator.id}
                    className="flex flex-col gap-2 py-4 transition-colors duration-150 hover:bg-slate-50/60 sm:flex-row sm:items-center sm:justify-between sm:rounded-lg sm:px-2"
                  >
                    <div>
                      <h3 className="font-semibold text-slate-950">{operator.nama}</h3>
                      <p className="text-sm text-slate-500">Login dengan nama &amp; kata sandi</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={operator.isActive ? 'brand' : 'slate'}>
                        {operator.isActive ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                      <Button variant="danger" size="sm" type="button" onClick={() => setDeletingOperator(operator)}>
                        Hapus
                      </Button>
                    </div>
                  </article>
                ))
              ) : (
                <p className="py-8 text-center text-sm text-slate-500">Belum ada operator untuk Penyewa ini.</p>
              )}
            </div>
          )}
        </Card>
      </section>

      {deletingOperator ? (
        <ConfirmDialog
          title="Hapus operator"
          message={`Hapus operator ${deletingOperator.nama}? Tindakan ini tidak dapat dibatalkan. Operator yang sudah punya riwayat batch produksi tidak bisa dihapus.`}
          confirmLabel="Hapus"
          tone="danger"
          onConfirm={confirmDeleteOperator}
          onCancel={() => setDeletingOperator(null)}
        />
      ) : null}
    </div>
  )
}
