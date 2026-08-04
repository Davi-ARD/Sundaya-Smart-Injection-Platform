import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Crumb = { label: string; to?: string }

// Header halaman standar: breadcrumb opsional, judul + deskripsi, dan slot
// actions opsional di kanan. Band gradien tipis di belakang jadi "bingkai"
// yang memisahkan judul dari widget di bawahnya.
export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
}: {
  title: string
  description: string
  breadcrumb?: Crumb[]
  actions?: ReactNode
}) {
  return (
    <div
      className="relative mb-6 overflow-hidden rounded-2xl px-6 py-6"
      style={{ background: 'linear-gradient(180deg, rgba(37,99,235,0.07) 0%, rgba(37,99,235,0) 100%)' }}
    >
      {breadcrumb ? (
        <nav className="mb-2 flex items-center gap-1.5 text-xs text-slate-400">
          {breadcrumb.map((crumb, index) => (
            <span key={crumb.label} className="flex items-center gap-1.5">
              {index > 0 ? <span aria-hidden>/</span> : null}
              {crumb.to ? (
                <Link to={crumb.to} className="transition-colors hover:text-slate-600">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-slate-500">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}
