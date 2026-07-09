import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  Role,
  type CreateUserRequest,
  type UpdateUserRequest,
  type User,
} from '@mold-tracker/shared'
import { useAuth } from '../features/auth/authContextValue'

const roleOptions = [Role.ADMIN, Role.PENYEDIA, Role.PENYEWA, Role.OPERATOR]

const emptyCreateForm: CreateUserRequest = {
  nama: '',
  email: '',
  password: '',
  role: Role.PENYEWA,
  parentId: '',
}

export function UsersPage() {
  const { listUsers, createUser, updateUser, deactivateUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [roleFilter, setRoleFilter] = useState<Role | 'SEMUA'>('SEMUA')
  const [activeFilter, setActiveFilter] = useState<'SEMUA' | 'AKTIF' | 'NONAKTIF'>('SEMUA')
  const [createForm, setCreateForm] = useState<CreateUserRequest>(emptyCreateForm)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState<UpdateUserRequest>({})
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const loadUsers = useCallback(async () => {
    try {
      const data = await listUsers({
        role: roleFilter === 'SEMUA' ? undefined : roleFilter,
        isActive: activeFilter === 'SEMUA' ? undefined : activeFilter === 'AKTIF',
      })
      setUsers(data)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Gagal memuat pengguna.')
    }
  }, [listUsers, roleFilter, activeFilter])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const resetMessages = () => {
    setNotice('')
    setError('')
  }

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    resetMessages()

    try {
      await createUser({
        ...createForm,
        parentId: createForm.parentId || undefined,
      })
      setCreateForm(emptyCreateForm)
      await loadUsers()
      setNotice('Pengguna baru berhasil dibuat.')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Pengguna tidak dapat dibuat.',
      )
    }
  }

  const startEdit = (selectedUser: User) => {
    resetMessages()
    setEditingUser(selectedUser)
    setEditForm({
      nama: selectedUser.nama,
      email: selectedUser.email,
      role: selectedUser.role,
      isActive: selectedUser.isActive,
    })
  }

  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!editingUser) {
      return
    }

    resetMessages()

    try {
      await updateUser(editingUser.id, editForm)
      setEditingUser(null)
      setEditForm({})
      await loadUsers()
      setNotice('Informasi pengguna berhasil diperbarui.')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Pengguna tidak dapat diperbarui.',
      )
    }
  }

  const deactivate = async (selectedUser: User) => {
    resetMessages()

    try {
      await deactivateUser(selectedUser.id)
      await loadUsers()
      setNotice('Pengguna berhasil dinonaktifkan.')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Pengguna tidak dapat dinonaktifkan.',
      )
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-bold text-slate-950">
          Manajemen Pengguna
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Admin dapat melihat, membuat, memperbarui, dan menonaktifkan seluruh
          akun.
        </p>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <form
          onSubmit={submitCreate}
          className="rounded-lg bg-white p-5 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-slate-950">
            Buat akun baru
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <UserTextInput
              label="Nama"
              value={createForm.nama}
              onChange={(value) =>
                setCreateForm((current) => ({ ...current, nama: value }))
              }
            />
            <UserTextInput
              label="Email"
              type="email"
              value={createForm.email}
              onChange={(value) =>
                setCreateForm((current) => ({ ...current, email: value }))
              }
            />
            <UserTextInput
              label="Kata sandi"
              type="password"
              value={createForm.password}
              onChange={(value) =>
                setCreateForm((current) => ({ ...current, password: value }))
              }
            />
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Role</span>
              <select
                value={createForm.role}
                onChange={(event) =>
                  setCreateForm((current) => ({
                    ...current,
                    role: event.target.value as Role,
                  }))
                }
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <UserTextInput
              label="Parent ID"
              value={createForm.parentId ?? ''}
              required={false}
              onChange={(value) =>
                setCreateForm((current) => ({ ...current, parentId: value }))
              }
            />
          </div>
          <button
            type="submit"
            className="mt-5 rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Simpan pengguna
          </button>
        </form>

        <section className="rounded-lg bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                Daftar pengguna
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Data berasal dari API `/users`.
              </p>
            </div>
            <div className="flex gap-2">
              <select
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(event.target.value as Role | 'SEMUA')
                }
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
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
                onChange={(event) =>
                  setActiveFilter(
                    event.target.value as 'SEMUA' | 'AKTIF' | 'NONAKTIF',
                  )
                }
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="SEMUA">Semua status</option>
                <option value="AKTIF">Aktif</option>
                <option value="NONAKTIF">Nonaktif</option>
              </select>
            </div>
          </div>

          <Feedback notice={notice} error={error} />

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-3 pr-4 font-semibold">Nama</th>
                  <th className="py-3 pr-4 font-semibold">Role</th>
                  <th className="py-3 pr-4 font-semibold">Status</th>
                  <th className="py-3 pr-4 font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((item) => (
                  <tr key={item.id}>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-slate-950">{item.nama}</p>
                      <p className="text-slate-500">{item.email}</p>
                    </td>
                    <td className="py-3 pr-4 text-slate-700">{item.role}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={[
                          'rounded-md px-2 py-1 text-xs font-semibold',
                          item.isActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600',
                        ].join(' ')}
                      >
                        {item.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deactivate(item)}
                          disabled={!item.isActive}
                          className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Nonaktifkan
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      {editingUser ? (
        <section className="rounded-lg bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">
            Edit pengguna
          </h2>
          <form className="mt-4 grid gap-4 md:grid-cols-5" onSubmit={submitEdit}>
            <UserTextInput
              label="Nama"
              value={editForm.nama ?? ''}
              onChange={(value) =>
                setEditForm((current) => ({ ...current, nama: value }))
              }
            />
            <UserTextInput
              label="Email"
              type="email"
              value={editForm.email ?? ''}
              onChange={(value) =>
                setEditForm((current) => ({ ...current, email: value }))
              }
            />
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Role</span>
              <select
                value={editForm.role ?? editingUser.role}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    role: event.target.value as Role,
                  }))
                }
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Status</span>
              <select
                value={String(editForm.isActive ?? editingUser.isActive)}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    isActive: event.target.value === 'true',
                  }))
                }
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              >
                <option value="true">Aktif</option>
                <option value="false">Nonaktif</option>
              </select>
            </label>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Simpan
              </button>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </div>
  )
}

function UserTextInput({
  label,
  value,
  onChange,
  type = 'text',
  required = true,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
    </label>
  )
}

function Feedback({ notice, error }: { notice: string; error: string }) {
  if (!notice && !error) {
    return null
  }

  return (
    <div className="mt-4 space-y-2">
      {notice ? (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  )
}
