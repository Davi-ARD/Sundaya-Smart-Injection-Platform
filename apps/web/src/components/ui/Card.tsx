import type { ReactNode } from 'react'

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = '',
}: {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={[
        'rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm shadow-slate-200/50 transition-shadow duration-200 hover:shadow-md hover:shadow-slate-200/60',
        className,
      ].join(' ')}
    >
      {title || actions ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title ? <h2 className="text-lg font-semibold text-slate-950">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={title || actions ? 'mt-4' : undefined}>{children}</div>
    </section>
  )
}

const statValueToneClasses = {
  brand: 'text-brand-700',
  emerald: 'text-emerald-700',
  amber: 'text-amber-700',
  rose: 'text-rose-700',
  slate: 'text-slate-950',
} as const

export function StatCard({
  label,
  value,
  hint,
  tone = 'slate',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: keyof typeof statValueToneClasses
}) {
  return (
    <article className="rounded-xl border border-slate-200/70 bg-white p-5 shadow-sm shadow-slate-200/50 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-slate-200/60">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={['mt-2 text-2xl font-bold', statValueToneClasses[tone]].join(' ')}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </article>
  )
}
