import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import {
  Role,
  type CreateUserRequest,
  type UpdateUserRequest,
  type User,
} from '@mold-tracker/shared'
import { useAuth } from '../features/auth/authContextValue'
import { api } from '../lib/api'
import { useToast } from '../components/ui/Toast'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { DataTable, type Column } from '../components/ui/DataTable'
import { FieldGroup, SelectField, TextField } from '../components/ui/FormField'
import { SidePanel } from '../components/ui/SidePanel'
import { TableSkeleton } from '../components/ui/Skeleton'

const roleOptions = [Role.ADMIN, Role.PENYEDIA, Role.PENYEWA, Role.OPERATOR]
const roleSelectOptions = roleOptions.map((role) => ({ value: role, label: role }))

const emptyCreateForm: CreateUserRequest = {
  nama: '',
  email: '',
  password: '',
  role: Role.PENYEWA,
  parentId: '',
}

const displayEmail = (email: string | null) => email ?? '(login dengan nama, tanpa email)'

const errorMessage = (caughtError: unknown, fallback: string) =>
  caughtError instanceof Error ? caughtError.message : fallback

export function UsersPage() {
  const { accessToken } = useAuth()
  const toast = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreatePanelOpen, setIsCreatePanelOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [roleFilter, setRoleFilter] = useState<Role | 'SEMUA'>('SEMUA')
  const [activeFilter, setActiveFilter] = useState<'SEMUA' | 'AKTIF' | 'NONAKTIF'>('SEMUA')
  const [createForm, setCreateForm] = useState<CreateUserRequest>(emptyCreateForm)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState<UpdateUserRequest>({})
  const [deletingUser, setDeletingUser] = useState<User | null>(null)
  const [penyewaOptions, setPenyewaOptions] = useState<User[]>([])

  const loadUsers = useCallback(async () => {
    try {
      const data = await api.listUsers(accessToken, {
        role: roleFilter === 'SEMUA' ? undefined : roleFilter,
        isActive: activeFilter === 'SEMUA' ? undefined : activeFilter === 'AKTIF',
      })
      setUsers(data)
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Gagal memuat pengguna.'))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, roleFilter, activeFilter, toast])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  // Untuk dropdown "Penyewa induk" saat membuat OPERATOR — terpisah dari daftar
  // utama yang bisa difilter, supaya selalu berisi seluruh akun PENYEWA aktif.
  useEffect(() => {
    api
      .listUsers(accessToken, { role: Role.PENYEWA })
      .then(setPenyewaOptions)
      .catch(() => undefined)
  }, [accessToken])

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsCreating(true)

    try {
      await api.createUser(accessToken, {
        ...createForm,
        email: createForm.role === Role.OPERATOR ? undefined : createForm.email,
        parentId: createForm.role === Role.OPERATOR ? createForm.parentId || undefined : undefined,
      })
      setCreateForm(emptyCreateForm)
      setIsCreatePanelOpen(false)
      await loadUsers()
      toast.success('Pengguna baru berhasil dibuat.')
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Pengguna tidak dapat dibuat.'))
    } finally {
      setIsCreating(false)
    }
  }

  const startEdit = (selectedUser: User) => {
    setEditingUser(selectedUser)
    setEditForm({
      nama: selectedUser.nama,
      email: selectedUser.email ?? undefined,
      role: selectedUser.role,
      isActive: selectedUser.isActive,
    })
  }

  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!editingUser) {
      return
    }

    setIsSavingEdit(true)

    try {
      await api.updateUser(accessToken, editingUser.id, editForm)
      setEditingUser(null)
      setEditForm({})
      await loadUsers()
      toast.success('Informasi pengguna berhasil diperbarui.')
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Pengguna tidak dapat diperbarui.'))
    } finally {
      setIsSavingEdit(false)
    }
  }

  const deactivate = async (selectedUser: User) => {
    try {
      await api.deactivateUser(accessToken, selectedUser.id)
      await loadUsers()
      toast.success('Pengguna berhasil dinonaktifkan.')
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Pengguna tidak dapat dinonaktifkan.'))
    }
  }

  const confirmDelete = async () => {
    if (!deletingUser) return
    try {
      await api.deleteUser(accessToken, deletingUser.id)
      setDeletingUser(null)
      await loadUsers()
      toast.success('Pengguna berhasil dihapus.')
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Pengguna tidak dapat dihapus.'))
    }
  }

  const columns: Column<User>[] = [
    {
      header: 'Nama',
      cell: (item) => (
        <>
          <p className="font-medium text-slate-950">{item.nama}</p>
          <p className="text-slate-500">{displayEmail(item.email)}</p>
        </>
      ),
    },
    { header: 'Role', cell: (item) => <span className="text-slate-700">{item.role}</span> },
    {
      header: 'Status',
      cell: (item) => <Badge tone={item.isActive ? 'emerald' : 'slate'}>{item.isActive ? 'Aktif' : 'Nonaktif'}</Badge>,
    },
    {
      header: 'Aksi',
      cell: (item) => (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" type="button" onClick={() => startEdit(item)}>
            Edit
          </Button>
          <Button
            variant="danger"
            size="sm"
            type="button"
            onClick={() => deactivate(item)}
            disabled={!item.isActive}
          >
            Nonaktifkan
          </Button>
          <Button variant="danger" size="sm" type="button" onClick={() => setDeletingUser(item)}>
            Hapus
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Manajemen Pengguna</h1>
          <p className="mt-2 text-sm text-slate-600">
            Admin dapat melihat, membuat, memperbarui, dan menonaktifkan seluruh akun.
          </p>
        </div>
        <Button type="button" onClick={() => setIsCreatePanelOpen(true)}>
          <Plus className="h-4 w-4" />
          Tambah Akun
        </Button>
      </section>

      <section>
        <Card
          title="Daftar pengguna"
          subtitle="Data dibuat oleh admin dan vendor."
          actions={
            <>
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as Role | 'SEMUA')}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm transition-colors duration-150 hover:border-slate-300"
              >
                <option value="SEMUA">Semua role</option>
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <select
                value={activeFilter}
                onChange={(event) => setActiveFilter(event.target.value as 'SEMUA' | 'AKTIF' | 'NONAKTIF')}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm transition-colors duration-150 hover:border-slate-300"
              >
                <option value="SEMUA">Semua status</option>
                <option value="AKTIF">Aktif</option>
                <option value="NONAKTIF">Nonaktif</option>
              </select>
            </>
          }
        >
          <div className="mt-4">
            {isLoading ? (
              <TableSkeleton rows={4} columns={4} />
            ) : (
              <DataTable columns={columns} rows={users} rowKey={(item) => item.id} emptyMessage="Belum ada pengguna." />
            )}
          </div>
        </Card>
      </section>

      {editingUser ? (
        <Card title="Edit pengguna">
          <form className="grid gap-4 md:grid-cols-5" onSubmit={submitEdit}>
            <TextField
              label="Nama"
              value={editForm.nama ?? ''}
              onChange={(value) => setEditForm((current) => ({ ...current, nama: value }))}
            />
            <SelectField
              label="Role"
              value={editForm.role ?? editingUser.role}
              onChange={(value) => setEditForm((current) => ({ ...current, role: value }))}
              options={roleSelectOptions}
            />
            {(editForm.role ?? editingUser.role) !== Role.OPERATOR ? (
              <TextField
                label="Email"
                type="email"
                value={editForm.email ?? ''}
                onChange={(value) => setEditForm((current) => ({ ...current, email: value }))}
              />
            ) : null}
            <SelectField
              label="Status"
              value={String(editForm.isActive ?? editingUser.isActive) as 'true' | 'false'}
              onChange={(value) => setEditForm((current) => ({ ...current, isActive: value === 'true' }))}
              options={[
                { value: 'true', label: 'Aktif' },
                { value: 'false', label: 'Nonaktif' },
              ]}
            />
            <div className="flex items-end gap-2">
              <Button type="submit" disabled={isSavingEdit}>
                {isSavingEdit ? 'Menyimpan...' : 'Simpan'}
              </Button>
              <Button variant="secondary" type="button" onClick={() => setEditingUser(null)}>
                Batal
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {isCreatePanelOpen ? (
        <SidePanel
          title="Tambah Akun"
          subtitle="Buat akun baru untuk role apa pun."
          onClose={() => setIsCreatePanelOpen(false)}
        >
          <form onSubmit={submitCreate}>
            <FieldGroup>
              <TextField
                label="Nama"
                value={createForm.nama}
                onChange={(value) => setCreateForm((current) => ({ ...current, nama: value }))}
              />
              <SelectField
                label="Role"
                value={createForm.role}
                onChange={(value) => setCreateForm((current) => ({ ...current, role: value }))}
                options={roleSelectOptions}
              />
              {createForm.role !== Role.OPERATOR ? (
                <TextField
                  label="Email"
                  type="email"
                  value={createForm.email ?? ''}
                  onChange={(value) => setCreateForm((current) => ({ ...current, email: value }))}
                />
              ) : null}
              <TextField
                label="Kata sandi"
                type="password"
                value={createForm.password}
                onChange={(value) => setCreateForm((current) => ({ ...current, password: value }))}
              />
              {createForm.role === Role.OPERATOR ? (
                <SelectField
                  label="Penyewa induk"
                  value={createForm.parentId ?? ''}
                  required={false}
                  onChange={(value) => setCreateForm((current) => ({ ...current, parentId: value }))}
                  options={[
                    { value: '', label: '(Tidak ada)' },
                    ...penyewaOptions.map((penyewa) => ({ value: penyewa.id, label: penyewa.nama })),
                  ]}
                />
              ) : null}
            </FieldGroup>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setIsCreatePanelOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Menyimpan...' : 'Simpan pengguna'}
              </Button>
            </div>
          </form>
        </SidePanel>
      ) : null}

      {deletingUser ? (
        <ConfirmDialog
          title={`Hapus akun ${deletingUser.nama}`}
          message="Akun yang dihapus tidak bisa dikembalikan. Bila akun ini masih punya riwayat data terkait (mesin, sewa, batch, dst.), sistem akan menolak dan Anda perlu menonaktifkannya saja."
          confirmLabel="Hapus"
          tone="danger"
          onConfirm={confirmDelete}
          onCancel={() => setDeletingUser(null)}
        />
      ) : null}
    </div>
  )
}
