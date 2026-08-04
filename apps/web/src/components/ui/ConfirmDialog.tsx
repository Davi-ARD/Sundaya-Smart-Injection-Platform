import { useState } from 'react'
import { Modal } from './Modal'
import { Button } from './Button'

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Konfirmasi',
  tone = 'primary',
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel?: string
  tone?: 'primary' | 'danger' | 'warning'
  onConfirm: () => Promise<void> | void
  onCancel: () => void
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleConfirm = async () => {
    setIsSubmitting(true)
    try {
      await onConfirm()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm leading-normal text-slate-600">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" type="button" onClick={onCancel} disabled={isSubmitting}>
          Batal
        </Button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isSubmitting}
          className={[
            'inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-50 disabled:hover:translate-y-0',
            tone === 'danger'
              ? 'bg-rose-600 shadow-rose-600/20 hover:bg-rose-700'
              : tone === 'warning'
                ? 'bg-amber-500 shadow-amber-500/20 hover:bg-amber-600'
                : 'bg-brand-600 shadow-brand-600/20 hover:bg-brand-700',
          ].join(' ')}
        >
          {isSubmitting ? 'Memproses...' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
