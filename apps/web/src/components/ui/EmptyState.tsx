import type { ComponentType } from 'react'

// Keadaan kosong di dalam Card: ikon bulat, judul, dan satu kalimat arahan.
// Dipakai lintas halaman supaya tabel kosong terlihat sama di mana pun.
export function EmptyState({
  icon: Icon,
  title,
  message,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  message?: string
}) {
  return (
    <div className="grid place-items-center py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700">
        <Icon className="h-6 w-6" />
      </span>
      <p className="mt-3 text-sm font-semibold text-slate-800">{title}</p>
      {message ? <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p> : null}
    </div>
  )
}
