import { RentalStatus } from '@mold-tracker/shared'

// Alur normal sewa. DITOLAK adalah cabang terminal dari DIAJUKAN, ditangani terpisah.
const HAPPY_PATH = [
  { status: RentalStatus.DIAJUKAN, label: 'Diajukan' },
  { status: RentalStatus.DIKONFIRMASI, label: 'Dikonfirmasi' },
  { status: RentalStatus.DIKIRIM, label: 'Dikirim' },
  { status: RentalStatus.AKTIF, label: 'Aktif' },
  { status: RentalStatus.SELESAI_SEWA, label: 'Selesai Masa Sewa' },
  { status: RentalStatus.SELESAI, label: 'Selesai' },
]

export function RentalStepper({ status }: { status: RentalStatus }) {
  if (status === RentalStatus.DITOLAK) {
    return (
      <div className="flex items-center gap-2">
        <StepDot state="done" />
        <span className="text-xs font-medium text-slate-500">Diajukan</span>
        <Connector state="rejected" />
        <StepDot state="rejected" />
        <span className="text-xs font-semibold text-rose-600">Ditolak</span>
      </div>
    )
  }

  // DIKEMBALIKAN tidak dipakai sebagai status rental oleh backend (lihat rentals.service.ts);
  // treat sebagai alias SELESAI_SEWA agar stepper tidak pernah "stuck" di posisi tak dikenal.
  const effectiveStatus = status === RentalStatus.DIKEMBALIKAN ? RentalStatus.SELESAI_SEWA : status
  const currentIndex = HAPPY_PATH.findIndex((step) => step.status === effectiveStatus)

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
      {HAPPY_PATH.map((step, index) => {
        const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'pending'
        return (
          <div key={step.status} className="flex items-center gap-1">
            {index > 0 ? <Connector state={index <= currentIndex ? 'done' : 'pending'} /> : null}
            <div className="flex items-center gap-1.5">
              <StepDot state={state} />
              <span
                className={[
                  'whitespace-nowrap text-xs font-medium',
                  state === 'current' ? 'font-semibold text-brand-700' : state === 'done' ? 'text-slate-600' : 'text-slate-400',
                ].join(' ')}
              >
                {step.label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StepDot({ state }: { state: 'done' | 'current' | 'pending' | 'rejected' }) {
  const classes = {
    done: 'bg-emerald-500',
    current: 'bg-brand-600 ring-4 ring-brand-100',
    pending: 'bg-slate-200',
    rejected: 'bg-rose-500',
  }[state]

  return <span className={['h-2.5 w-2.5 shrink-0 rounded-full', classes].join(' ')} />
}

function Connector({ state }: { state: 'done' | 'pending' | 'rejected' }) {
  const classes = {
    done: 'bg-emerald-400',
    pending: 'bg-slate-200',
    rejected: 'bg-rose-300',
  }[state]

  return <span className={['h-px w-4 shrink-0', classes].join(' ')} />
}
