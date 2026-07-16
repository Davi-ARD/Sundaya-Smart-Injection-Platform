import { useEffect, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'

// Panel yang muncul dari sisi kanan (bukan modal tengah) — dipakai untuk form
// yang lebih panjang seperti "Tambah Akun" agar tabel di belakangnya tetap terlihat.
export function SidePanel({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: ReactNode
  subtitle?: ReactNode
  onClose: () => void
  children: ReactNode
}) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end p-4 sm:p-6">
      <button
        type="button"
        aria-label="Tutup"
        onClick={onClose}
        className={[
          'absolute inset-0 bg-slate-950/40 backdrop-blur-sm transition-opacity duration-200',
          isVisible ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      />
      <div
        className={[
          'relative flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-900/20 transition-all duration-300 ease-out',
          isVisible ? 'translate-x-0 opacity-100' : 'translate-x-6 opacity-0',
        ].join(' ')}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            aria-label="Tutup"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
