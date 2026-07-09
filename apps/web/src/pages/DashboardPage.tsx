import { Role } from '@mold-tracker/shared'
import { useAuth } from '../features/auth/authContextValue'

const roleDescriptions: Record<Role, string> = {
  [Role.ADMIN]:
    'Admin dapat melihat seluruh pengguna, membuat akun, memperbarui informasi, dan menonaktifkan akun.',
  [Role.PENYEDIA]:
    'Penyedia dapat mengelola mesin, konfirmasi sewa, pengiriman, dan pengecekan kondisi mesin.',
  [Role.PENYEWA]:
    'Penyewa dapat mengajukan sewa, memantau produksi, dan mengelola sub-akun Operator.',
  [Role.OPERATOR]:
    'Operator dapat mengisi batch produksi untuk rental aktif milik Penyewa induknya.',
}

const roleActions: Record<Role, string[]> = {
  [Role.ADMIN]: ['Kelola pengguna global', 'Pantau status akun'],
  [Role.PENYEDIA]: ['Kelola katalog mesin', 'Proses permintaan sewa'],
  [Role.PENYEWA]: ['Kelola operator', 'Pantau performa produksi'],
  [Role.OPERATOR]: ['Input batch produksi', 'Lihat tugas produksi aktif'],
}

export function DashboardPage() {
  const { user } = useAuth()

  if (!user) {
    return null
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
          Dashboard {user.role}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Selamat datang, {user.nama}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          {roleDescriptions[user.role]}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {roleActions[user.role].map((action) => (
          <article
            key={action}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-semibold text-slate-950">{action}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Fitur ini mengikuti role aktif dan siap diganti ke endpoint nyata
              saat backend tersedia.
            </p>
          </article>
        ))}
      </section>
    </div>
  )
}
