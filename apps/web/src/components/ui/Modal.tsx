import { useEffect, useState, type ReactNode } from 'react'

// lg dipakai konten baca yang lebar (detail cetakan), md untuk form biasa.
const sizeClasses = { md: 'max-w-lg', lg: 'max-w-4xl' } as const

export function Modal({
  title,
  onClose,
  children,
  size = 'md',
}: {
  title: ReactNode
  onClose: () => void
  children: ReactNode
  size?: keyof typeof sizeClasses
}) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Tutup"
        onClick={onClose}
        className={[
          'absolute inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity duration-200',
          isVisible ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
      />
      <div
        className={[
          'relative max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white p-6 shadow-2xl shadow-slate-900/20 transition-all duration-200 ease-out',
          sizeClasses[size],
          isVisible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-2 scale-[0.98] opacity-0',
        ].join(' ')}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          <button
            type="button"
            aria-label="Tutup"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-100"
          >
            x
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}
