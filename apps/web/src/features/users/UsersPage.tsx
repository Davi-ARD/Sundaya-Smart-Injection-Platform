import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Ban, Pencil, Trash2, UserPlus, Users as UsersIcon } from 'lucide-react'
import { Role, type CreateStaffRequest, type UpdateUserRequest, type User } from '@mold-tracker/shared'
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
import { SelectField, TextField } from '../../components/ui/FormField'
import { useToast } from '../../components/ui/Toast'
import { errorMessage } from '../../lib/errorMessage'
import { formatDate } from '../../lib/format'
import { roleLabels } from '../auth/roleLabels'

const STAFF_ROLES = [Role.SUPER_ADMIN, Role.ADMIN_SUNDAYA, Role.TEKNISI_SUNDAYA] as const

type Pending = { action: 'deactivate' | 'delete'; target: User }

// Kelola akun staf Sundaya (Super Admin). Menonaktifkan/menghapus akun sendiri
// yang sedang login ditolak server (cegah lockout).
export function UsersPage() {
  const { accessToken, user: currentUser } = useAuth()
  const toast = useToast()

  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [panel, setPanel] = useState<{ mode: 'create' } | { mode: 'edit'; target: User } | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      setUsers(await api.listUsers(accessToken, { role: undefined }))
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal memuat pengguna'))
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
        await api.deactivateUser(accessToken, pending.target.id)
        toast.success('Akun dinonaktifkan')
      } else {
        await api.deleteUser(accessToken, pending.target.id)
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
    { header: 'Role', cell: (u) => <Badge tone="brand">{roleLabels[u.role]}</Badge> },
    { header: 'Dibuat', cell: (u) => formatDate(u.createdAt) },
    {
      header: 'Status',
      cell: (u) => <Badge tone={u.isActive ? 'emerald' : 'slate'}>{u.isActive ? 'Aktif' : 'Nonaktif'}</Badge>,
    },
    {
      header: '',
      className: 'text-right',
      cell: (u) => {
        const isSelf = u.id === currentUser?.id
        return (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => setPanel({ mode: 'edit', target: u })}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            {u.isActive && !isSelf ? (
              <Button size="sm" variant="secondary" onClick={() => setPending({ action: 'deactivate', target: u })}>
                <Ban className="h-4 w-4" /> Nonaktifkan
              </Button>
            ) : null}
            {!isSelf ? (
              <Button size="sm" variant="danger" onClick={() => setPending({ action: 'delete', target: u })}>
                <Trash2 className="h-4 w-4" /> Hapus
              </Button>
            ) : null}
          </div>
        )
      },
    },
  ]

  return (
    <div className="mx-auto max-w-screen-2xl">
      <PageHeader
        breadcrumb={[{ label: 'Beranda', to: '/staff' }, { label: 'Pengguna' }]}
        title="Pengguna"
        description="Kelola akun staf Sundaya: Super Admin, Admin Sundaya, Teknisi."
        actions={
          <Button onClick={() => setPanel({ mode: 'create' })}>
            <UserPlus className="h-5 w-5" /> Tambah akun
          </Button>
        }
      />

      <Card>
        {isLoading ? (
          <TableSkeleton rows={4} columns={6} />
        ) : users.length === 0 ? (
          <div className="grid place-items-center py-14 text-center">
            <span className="grid h-12 w-12 place-items-center text-brand-700">
              <UsersIcon className="h-7 w-7" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-800">Belum ada akun staf</p>
          </div>
        ) : (
          <DataTable columns={columns} rows={users} rowKey={(u) => u.id} />
        )}
      </Card>

      {panel ? (
        <UserFormPanel
          key={panel.mode === 'edit' ? panel.target.id : 'create'}
          panel={panel}
          onClose={() => setPanel(null)}
          onSaved={() => {
            setPanel(null)
            void load()
          }}
        />
      ) : null}

      {pending ? (
        <ConfirmDialog
          title={pending.action === 'deactivate' ? 'Nonaktifkan akun' : 'Hapus akun'}
          message={
            pending.action === 'deactivate'
              ? `${pending.target.nama} tidak akan bisa masuk lagi.`
              : `Hapus permanen akun ${pending.target.nama}. Akun dengan riwayat data terkait tidak bisa dihapus, nonaktifkan saja.`
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

function UserFormPanel({
  panel,
  onClose,
  onSaved,
}: {
  panel: { mode: 'create' } | { mode: 'edit'; target: User }
  onClose: () => void
  onSaved: () => void
}) {
  const { accessToken } = useAuth()
  const toast = useToast()
  const isEdit = panel.mode === 'edit'

  const [nama, setNama] = useState(isEdit ? panel.target.nama : '')
  const [email, setEmail] = useState(isEdit ? panel.target.email : '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>(isEdit ? panel.target.role : Role.ADMIN_SUNDAYA)
  const [isActive, setIsActive] = useState(isEdit ? panel.target.isActive : true)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      if (isEdit) {
        const body: UpdateUserRequest = { nama, email, isActive }
        await api.updateUser(accessToken, panel.target.id, body)
        toast.success('Akun diperbarui')
      } else {
        const body: CreateStaffRequest = { nama, email, password, role: role as CreateStaffRequest['role'] }
        await api.createStaff(accessToken, body)
        toast.success('Akun staf dibuat')
      }
      onSaved()
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal menyimpan akun'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SidePanel
      title={isEdit ? 'Edit akun' : 'Tambah akun staf'}
      subtitle={isEdit ? 'Role tidak dapat diubah setelah dibuat.' : 'Hanya role staf Sundaya.'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField label="Nama" value={nama} onChange={setNama} />
        <TextField label="Email" type="email" value={email} onChange={setEmail} />
        {!isEdit ? (
          <>
            <TextField label="Kata sandi awal" type="password" value={password} onChange={setPassword} />
            <SelectField
              label="Role"
              value={role}
              onChange={setRole}
              options={STAFF_ROLES.map((value) => ({ value, label: roleLabels[value] }))}
            />
          </>
        ) : (
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Akun aktif
          </label>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </div>
      </form>
    </SidePanel>
  )
}
