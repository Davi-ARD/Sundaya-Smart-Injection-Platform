import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { UploadCloud } from 'lucide-react'
import { useAuth } from '../features/auth/authContextValue'
import { initialsFromName, roleLabels } from '../features/auth/roleLabels'
import { api, API_BASE_URL } from '../lib/api'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { TextField } from '../components/ui/FormField'
import { useToast } from '../components/ui/Toast'
import { errorMessage } from '../lib/errorMessage'

// Edit profil sendiri: nama, email, ganti kata sandi, dan avatar. Memakai
// endpoint /auth/me yang berlaku untuk semua role.
export function ProfilePage() {
  const { accessToken, user, updateUser } = useAuth()
  const toast = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [nama, setNama] = useState(user?.nama ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  if (!user) return null

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      const updated = await api.updateProfile(accessToken, {
        nama,
        email,
        currentPassword: newPassword ? currentPassword : undefined,
        newPassword: newPassword || undefined,
      })
      updateUser(updated)
      setCurrentPassword('')
      setNewPassword('')
      toast.success('Profil diperbarui')
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal memperbarui profil'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const updated = await api.uploadAvatar(accessToken, file)
      updateUser(updated)
      toast.success('Foto profil diperbarui')
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal mengunggah foto'))
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold tracking-tight text-slate-800">Profil</h1>
      <p className="mt-1 text-sm text-slate-500">Kelola informasi akun Anda.</p>

      <Card className="mt-6">
        <div className="flex items-center gap-4">
          {user.avatarUrl ? (
            <img src={`${API_BASE_URL}${user.avatarUrl}`} alt={user.nama} className="h-16 w-16 rounded-xl object-cover" />
          ) : (
            <span className="grid h-16 w-16 place-items-center rounded-xl bg-brand-600 text-lg font-bold text-white">
              {initialsFromName(user.nama)}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-800">{user.nama}</p>
            <p className="text-sm text-slate-500">{roleLabels[user.role]}</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="ml-auto"
            onClick={() => fileInputRef.current?.click()}
          >
            <UploadCloud className="h-5 w-5" /> Ganti foto
          </Button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
        </div>
      </Card>

      <Card className="mt-5" title="Informasi akun">
        <form onSubmit={handleSubmit} className="space-y-4">
          <TextField label="Nama" value={nama} onChange={setNama} />
          <TextField label="Email" type="email" value={email} onChange={setEmail} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Kata sandi saat ini" type="password" value={currentPassword} onChange={setCurrentPassword} required={false} />
            <TextField label="Kata sandi baru" type="password" value={newPassword} onChange={setNewPassword} required={false} />
          </div>
          <p className="text-xs text-slate-400">Isi kata sandi hanya jika ingin menggantinya.</p>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Menyimpan...' : 'Simpan perubahan'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
