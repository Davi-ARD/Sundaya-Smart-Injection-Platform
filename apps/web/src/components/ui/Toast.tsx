import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

type ToastTone = 'success' | 'error' | 'info'
type ToastItem = { id: number; tone: ToastTone; message: string }

type ToastContextValue = {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast harus digunakan di dalam ToastProvider.')
  }
  return context
}

const toneClasses: Record<ToastTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  info: 'border-brand-200 bg-brand-50 text-brand-800',
}

const toneIcon: Record<ToastTone, string> = {
  success: '✓',
  error: '!',
  info: '🔔',
}

const toneIconClasses: Record<ToastTone, string> = {
  success: 'bg-emerald-500 text-white',
  error: 'bg-rose-500 text-white',
  info: 'bg-brand-600 text-white',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const push = useCallback((tone: ToastTone, message: string) => {
    const id = nextId.current++
    setToasts((current) => [...current, { id, tone, message }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 4000)
  }, [])

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      info: (message) => push('info', message),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6">
        {toasts.map((toast) => (
          <ToastItemView key={toast.id} toast={toast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItemView({ toast }: { toast: ToastItem }) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div
      role="status"
      className={[
        'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg shadow-slate-900/10 backdrop-blur transition-all duration-300 ease-out',
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0',
        toneClasses[toast.tone],
      ].join(' ')}
    >
      <span
        className={[
          'grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-bold',
          toneIconClasses[toast.tone],
        ].join(' ')}
      >
        {toneIcon[toast.tone]}
      </span>
      <p className="text-sm font-medium leading-5">{toast.message}</p>
    </div>
  )
}
