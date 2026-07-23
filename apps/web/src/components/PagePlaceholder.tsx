import type { ComponentType, ReactNode } from 'react'

// Empty state branded untuk halaman fase 6 yang kerangkanya sudah dirute tapi
// isinya menyusul per task Dev B. Menjaga nav + role-gating bisa diuji end-to-end.
export function PagePlaceholder({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      <div className="grid place-items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-soft">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-700">
          <Icon className="h-7 w-7" />
        </span>
        <p className="mt-4 text-base font-semibold text-slate-800">Halaman sedang disiapkan</p>
        <p className="mt-1 max-w-sm text-sm text-slate-500">
          Kerangka rute dan navigasi sudah aktif. Konten fungsional menyusul pada tahap
          implementasi halaman ini.
        </p>
        {children ? <div className="mt-6 w-full">{children}</div> : null}
      </div>
    </div>
  )
}
