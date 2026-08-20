import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Ban, Trash2, UserCog, UserPlus } from 'lucide-react'
import type { User } from '@mold-tracker/shared'
import { useAuth } from '../auth/authContextValue'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { SidePanel } from '../../components/ui/SidePanel'
import { TableSkeleton } from '../../components/ui/Skeleton'
import { TextField } from '../../components/ui/FormField'
import { useToast } from '../../components/ui/Toast'
import { errorMessage } from '../../lib/errorMessage'
import { formatDate } from '../../lib/format'

type Pending = { action: 'deactivate' | 'delete'; admin: User }

// Akun Admin Penyewa: child dari Manager, dibuat lewat undangan Manager dan
// tidak bisa mendaftar sendiri. Admin Penyewa menginput Log Produksi di lokasi.
export function PenyewaAdminsPage() {
  const { accessToken } = useAuth()
  const toast = useToast()

  const [admins, setAdmins] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      setAdmins(await api.listPenyewaAdmins(accessToken))
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal memuat akun Admin Penyewa'))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, toast])

  useEffect(() => {
    void load()
  }, [load])

  const runPending = async () => {
    if (!pending) return
    try {
      if (pending.action === 'deactivate') {
        await api.deactivatePenyewaAdmin(accessToken, pending.admin.id)
        toast.success('Akun dinonaktifkan')
      } else {
        await api.deletePenyewaAdmin(accessToken, pending.admin.id)
        toast.success('Akun dihapus')
      }
      setPending(null)
      void load()
    } catch (caught) {
      toast.error(errorMessage(caught, 'Aksi gagal'))
      setPending(null)
    }
  }

  const columns: Column<User>[] = [
    { header: 'Nama', cell: (u) => <span className="font-semibold text-slate-900">{u.nama}</span> },
    { header: 'Email', cell: (u) => u.email },
    { header: 'Dibuat', cell: (u) => formatDate(u.createdAt) },
    {
      header: 'Status',
      cell: (u) => <Badge tone={u.isActive ? 'emerald' : 'slate'}>{u.isActive ? 'Aktif' : 'Nonaktif'}</Badge>,
    },
    {
      header: '',
      className: 'text-right',
      cell: (u) => (
        <div className="flex justify-end gap-2">
          {u.isActive ? (
            <Button size="sm" variant="secondary" onClick={() => setPending({ action: 'deactivate', admin: u })}>
              <Ban className="h-4 w-4" /> Nonaktifkan
            </Button>
          ) : null}
          <Button size="sm" variant="danger" onClick={() => setPending({ action: 'delete', admin: u })}>
            <Trash2 className="h-4 w-4" /> Hapus
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="mx-auto max-w-screen-2xl">
      <PageHeader
        breadcrumb={[{ label: 'Beranda', to: '/manager' }, { label: 'Akun Admin Penyewa' }]}
        title="Akun Admin Penyewa"
        description="Admin Penyewa berada di lokasi Sundaya dan menginput Log Produksi harian."
        actions={
          <Button onClick={() => setIsPanelOpen(true)}>
            <UserPlus className="h-5 w-5" /> Tambah akun
          </Button>
        }
      />

      <Card>
        {isLoading ? (
          <TableSkeleton rows={3} columns={5} />
        ) : admins.length === 0 ? (
          <div className="grid place-items-center py-14 text-center">
            <span className="grid h-12 w-12 place-items-center text-brand-700">
              <UserCog className="h-7 w-7" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-800">Belum ada Admin Penyewa</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Buat akun untuk staf Anda yang bertugas di lokasi Sundaya agar dapat menginput Log
              Produksi.
            </p>
          </div>
        ) : (
          <DataTable columns={columns} rows={admins} rowKey={(u) => u.id} />
        )}
      </Card>

      {isPanelOpen ? (
        <AdminFormPanel
          onClose={() => setIsPanelOpen(false)}
          onSaved={() => {
            setIsPanelOpen(false)
            void load()
          }}
        />
      ) : null}

      {pending ? (
        <ConfirmDialog
          title={pending.action === 'deactivate' ? 'Nonaktifkan akun' : 'Hapus akun'}
          message={
            pending.action === 'deactivate'
              ? `${pending.admin.nama} tidak akan bisa masuk lagi. Riwayat Log Produksinya tetap tersimpan.`
              : `Hapus permanen akun ${pending.admin.nama}. Akun yang sudah punya riwayat Log Produksi tidak dapat dihapus, nonaktifkan saja.`
          }
          confirmLabel={pending.action === 'deactivate' ? 'Nonaktifkan' : 'Hapus'}
          tone={pending.action === 'deactivate' ? 'warning' : 'danger'}
          onConfirm={runPending}
          onCancel={() => setPending(null)}
        />
      ) : null}
    </div>
  )
}

function AdminFormPanel({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { accessToken } = useAuth()
  const toast = useToast()
  const [nama, setNama] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      await api.createPenyewaAdmin(accessToken, { nama, email, password })
      toast.success('Akun Admin Penyewa dibuat')
      onSaved()
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal membuat akun'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SidePanel
      title="Tambah Admin Penyewa"
      subtitle="Akun berada di bawah perusahaan Anda dan memakai kata sandi awal ini."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField label="Nama" value={nama} onChange={setNama} />
        <TextField label="Email" type="email" value={email} onChange={setEmail} />
        <TextField label="Kata sandi awal" type="password" value={password} onChange={setPassword} />
        <p className="text-xs text-slate-400">
          Minimal 6 karakter. Sampaikan kata sandi ini langsung kepada yang bersangkutan agar dapat
          diganti setelah masuk.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Menyimpan...' : 'Buat akun'}
          </Button>
        </div>
      </form>
    </SidePanel>
  )
}
