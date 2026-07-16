import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { errorMessage } from '../lib/errorMessage'
import { Camera, Pencil } from 'lucide-react'
import { Role, type UpdateProfileRequest } from '@mold-tracker/shared'
import { useAuth } from '../features/auth/authContextValue'
import { initialsFromName, roleLabels, roleTagline } from '../features/auth/roleLabels'
import { api, API_BASE_URL } from '../lib/api'
import { useToast } from '../components/ui/Toast'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { TextField } from '../components/ui/FormField'

const AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function ProfilePage() {
  const { user, accessToken, updateUser } = useAuth()

  if (!user) return null

  const isOperator = user.role === Role.OPERATOR
  const initials = initialsFromName(user.nama)

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-bold text-slate-950">Profil Saya</h1>
        <p className="mt-2 text-sm text-slate-600">
          Kelola informasi akun dan keamanan login Anda.
        </p>
      </section>

      <Card>
        <ProfileHeader
          nama={user.nama}
          initials={initials}
          role={user.role}
          email={user.email}
          avatarUrl={user.avatarUrl}
          accessToken={accessToken}
          onAvatarUploaded={updateUser}
        />
      </Card>

      <AccountInfoCard
        nama={user.nama}
        email={user.email}
        isOperator={isOperator}
        accessToken={accessToken}
        onSaved={updateUser}
      />

      <SecurityCard accessToken={accessToken} onSaved={updateUser} />
    </div>
  )
}

function ProfileHeader({
  nama,
  initials,
  role,
  email,
  avatarUrl,
  accessToken,
  onAvatarUploaded,
}: {
  nama: string
  initials: string
  role: Role
  email: string | null
  avatarUrl: string | null
  accessToken: string | null
  onAvatarUploaded: ReturnType<typeof useAuth>['updateUser']
}) {
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)

  const pickFile = () => fileInputRef.current?.click()

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      toast.error('Format foto harus JPEG, PNG, atau WEBP.')
      return
    }
    if (file.size > AVATAR_MAX_SIZE_BYTES) {
      toast.error('Ukuran foto maksimal 5MB.')
      return
    }

    setIsUploading(true)
    try {
      const updated = await api.uploadAvatar(accessToken, file)
      onAvatarUploaded(updated)
      toast.success('Foto profil berhasil diperbarui.')
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Gagal mengunggah foto profil.'))
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative shrink-0">
        {avatarUrl ? (
          <img
            src={`${API_BASE_URL}${avatarUrl}`}
            alt={nama}
            className="h-20 w-20 rounded-full object-cover ring-1 ring-slate-900/5"
          />
        ) : (
          <span className="grid h-20 w-20 place-items-center rounded-full bg-brand-600 text-xl font-bold text-white">
            {initials}
          </span>
        )}
        <button
          type="button"
          aria-label="Ganti foto profil"
          onClick={pickFile}
          disabled={isUploading}
          className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition-colors duration-150 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-60"
        >
          <Camera className="h-4 w-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => void handleFileChange(event)}
        />
      </div>

      <div className="min-w-0 flex-1 text-center sm:text-left">
        <p className="truncate text-lg font-bold text-slate-950">{nama}</p>
        <p className="text-sm text-slate-500">
          {roleLabels[role]} · <span className="font-semibold text-brand-600">{roleTagline[role]}</span>
        </p>
        {email ? <p className="mt-1 truncate text-sm text-slate-400">{email}</p> : null}
      </div>
    </div>
  )
}

function AccountInfoCard({
  nama,
  email,
  isOperator,
  accessToken,
  onSaved,
}: {
  nama: string
  email: string | null
  isOperator: boolean
  accessToken: string | null
  onSaved: ReturnType<typeof useAuth>['updateUser']
}) {
  const toast = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [namaInput, setNamaInput] = useState(nama)
  const [emailInput, setEmailInput] = useState(email ?? '')

  const startEdit = () => {
    setNamaInput(nama)
    setEmailInput(email ?? '')
    setIsEditing(true)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const payload: UpdateProfileRequest = {}
    if (namaInput.trim() && namaInput.trim() !== nama) payload.nama = namaInput.trim()
    if (!isOperator && emailInput.trim() !== (email ?? '')) payload.email = emailInput.trim()

    if (Object.keys(payload).length === 0) {
      setIsEditing(false)
      return
    }

    setIsSubmitting(true)
    try {
      const updated = await api.updateProfile(accessToken, payload)
      onSaved(updated)
      toast.success('Informasi akun berhasil diperbarui.')
      setIsEditing(false)
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Gagal memperbarui informasi akun.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card
      title="Informasi Akun"
      actions={
        isEditing ? null : (
          <Button type="button" variant="secondary" size="sm" onClick={startEdit}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        )
      }
    >
      {isEditing ? (
        <form onSubmit={submit} className="space-y-4">
          <TextField label="Nama" value={namaInput} onChange={setNamaInput} />
          {isOperator ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Operator masuk memakai nama, bukan email.
            </p>
          ) : (
            <TextField label="Email" type="email" value={emailInput} onChange={setEmailInput} />
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setIsEditing(false)} disabled={isSubmitting}>
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </form>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Nama</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{nama}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Email</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {isOperator ? 'Login memakai nama' : (email ?? '-')}
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}

function SecurityCard({
  accessToken,
  onSaved,
}: {
  accessToken: string | null
  onSaved: ReturnType<typeof useAuth>['updateUser']
}) {
  const toast = useToast()
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const startEdit = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setIsEditing(true)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (newPassword.length < 6) {
      toast.error('Password baru minimal 6 karakter.')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Konfirmasi password tidak cocok.')
      return
    }

    setIsSubmitting(true)
    try {
      const updated = await api.updateProfile(accessToken, { currentPassword, newPassword })
      onSaved(updated)
      toast.success('Password berhasil diganti.')
      setIsEditing(false)
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Gagal mengganti password.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card
      title="Keamanan"
      subtitle={isEditing ? undefined : 'Ganti password login Anda secara berkala.'}
      actions={
        isEditing ? null : (
          <Button type="button" variant="secondary" size="sm" onClick={startEdit}>
            <Pencil className="h-3.5 w-3.5" />
            Ganti Password
          </Button>
        )
      }
    >
      {isEditing ? (
        <form onSubmit={submit} className="space-y-4">
          <TextField label="Password saat ini" type="password" value={currentPassword} onChange={setCurrentPassword} />
          <TextField label="Password baru" type="password" value={newPassword} onChange={setNewPassword} />
          <TextField
            label="Konfirmasi password baru"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setIsEditing(false)} disabled={isSubmitting}>
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  )
}
