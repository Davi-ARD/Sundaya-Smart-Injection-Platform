import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarClock, CheckCircle2, XCircle } from 'lucide-react'
import {
  JobLifecycle,
  MachineStatus,
  Role,
  type AssignJobRequest,
  type Job,
  type Machine,
  type Mold,
  type RejectJobRequest,
  type SundayaDashboard,
} from '@mold-tracker/shared'
import { useAuth } from '../auth/authContextValue'
import { api } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Card, StatCard } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { JobLifecycleBadge } from '../../components/ui/Badge'
import { CardSkeleton, TableSkeleton } from '../../components/ui/Skeleton'
import { Modal } from '../../components/ui/Modal'
import { SelectField, TextAreaField } from '../../components/ui/FormField'
import { useToast } from '../../components/ui/Toast'
import { errorMessage } from '../../lib/errorMessage'
import { formatDate } from '../../lib/format'

const ONGOING_LIFECYCLES = [
  JobLifecycle.DIKONFIRMASI,
  JobLifecycle.DIKIRIM,
  JobLifecycle.AKTIF,
  JobLifecycle.SELESAI_SEWA,
  JobLifecycle.DIKEMBALIKAN,
]

// Dashboard Sundaya (staf): metrik OEE armada + approval booking + rental management.
// Metrik dari GET /dashboard/sundaya (Layer 1). ADMIN_SUNDAYA satu-satunya role
// yang boleh approve/assign/reject dan menjalankan lifecycle job selanjutnya.
export function SundayaDashboardPage() {
  const { accessToken, user } = useAuth()
  const toast = useToast()
  const canManage = user?.role === Role.ADMIN_SUNDAYA

  const [summary, setSummary] = useState<SundayaDashboard | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [molds, setMolds] = useState<Mold[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [assignTarget, setAssignTarget] = useState<Job | null>(null)
  const [rejectTarget, setRejectTarget] = useState<Job | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [dashboard, jobList, moldList, machineList] = await Promise.all([
        api.getSundayaDashboard(accessToken),
        api.listJobs(accessToken),
        api.listMolds(accessToken),
        api.listMachines(accessToken, { status: MachineStatus.TERSEDIA }),
      ])
      setSummary(dashboard)
      setJobs(jobList)
      setMolds(moldList)
      setMachines(machineList)
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal memuat dashboard'))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, toast])

  useEffect(() => {
    void load()
  }, [load])

  const moldById = useMemo(() => new Map(molds.map((m) => [m.id, m])), [molds])
  const pendingApproval = useMemo(() => jobs.filter((j) => j.lifecycle === JobLifecycle.DIAJUKAN), [jobs])
  const ongoingJobs = useMemo(() => jobs.filter((j) => ONGOING_LIFECYCLES.includes(j.lifecycle)), [jobs])

  const runLifecycleAction = async (job: Job, action: (id: string) => Promise<Job>, successLabel: string) => {
    setPendingId(job.id)
    try {
      await action(job.id)
      toast.success(successLabel)
      void load()
    } catch (caught) {
      toast.error(errorMessage(caught, 'Aksi gagal'))
    } finally {
      setPendingId(null)
    }
  }

  const lifecycleAction = (job: Job): { label: string; run: () => void } | null => {
    switch (job.lifecycle) {
      case JobLifecycle.DIKONFIRMASI:
        return { label: 'Kirim mesin', run: () => void runLifecycleAction(job, (id) => api.shipJob(accessToken, id), 'Mesin dikirim') }
      case JobLifecycle.DIKIRIM:
        return { label: 'Aktifkan', run: () => void runLifecycleAction(job, (id) => api.activateJob(accessToken, id), 'Job aktif') }
      case JobLifecycle.AKTIF:
        return { label: 'Tandai selesai sewa', run: () => void runLifecycleAction(job, (id) => api.returnJob(accessToken, id), 'Selesai sewa') }
      case JobLifecycle.SELESAI_SEWA:
        return { label: 'Ambil mesin', run: () => void runLifecycleAction(job, (id) => api.collectJob(accessToken, id), 'Mesin dikembalikan') }
      case JobLifecycle.DIKEMBALIKAN:
        return { label: 'Selesaikan job', run: () => void runLifecycleAction(job, (id) => api.completeJob(accessToken, id), 'Job selesai') }
      default:
        return null
    }
  }

  const approvalColumns: Column<Job>[] = [
    { header: 'No. Job', cell: (j) => <span className="font-semibold text-slate-900">{j.jobNumber}</span> },
    { header: 'Cetakan', cell: (j) => moldById.get(j.moldId)?.kodeMold ?? <span className="text-slate-400">-</span> },
    { header: 'Tonase', cell: (j) => (moldById.get(j.moldId) ? `${moldById.get(j.moldId)!.tonaseTon} ton` : '-') },
    { header: 'Tujuan', cell: (j) => j.destinationLocation },
    { header: 'Durasi', cell: (j) => `${j.requestedDurationDays} hari` },
    {
      header: '',
      className: 'text-right',
      cell: (j) =>
        canManage ? (
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => setAssignTarget(j)}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Setujui + assign
            </Button>
            <Button size="sm" variant="danger" onClick={() => setRejectTarget(j)}>
              <XCircle className="h-3.5 w-3.5" /> Tolak
            </Button>
          </div>
        ) : (
          <JobLifecycleBadge status={j.lifecycle} />
        ),
    },
  ]

  const ongoingColumns: Column<Job>[] = [
    { header: 'No. Job', cell: (j) => <span className="font-semibold text-slate-900">{j.jobNumber}</span> },
    { header: 'Cetakan', cell: (j) => moldById.get(j.moldId)?.kodeMold ?? <span className="text-slate-400">-</span> },
    { header: 'Mesin', cell: (j) => j.machineNumber ?? '-' },
    { header: 'Status', cell: (j) => <JobLifecycleBadge status={j.lifecycle} /> },
    { header: 'Selesai sewa', cell: (j) => formatDate(j.endDate) },
    {
      header: '',
      className: 'text-right',
      cell: (j) => {
        if (!canManage) return null
        const action = lifecycleAction(j)
        if (!action) return null
        return (
          <Button size="sm" variant="secondary" disabled={pendingId === j.id} onClick={action.run}>
            {action.label}
          </Button>
        )
      },
    },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard Sundaya</h1>
        <p className="mt-1 text-sm text-slate-500">Monitoring OEE armada dan status booking.</p>
      </div>

      {isLoading || !summary ? (
        <Card>
          <CardSkeleton lines={4} />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Mesin running"
            value={`${summary.runningMachines}/${summary.totalMachines}`}
            tone="brand"
          />
          <StatCard label="Rata-rata OEE" value={`${summary.avgOee}%`} tone={summary.avgOee >= 70 ? 'emerald' : 'amber'} />
          <StatCard label="Utilisasi" value={`${summary.utilization}%`} tone="slate" />
          <StatCard label="Booking aktif" value={summary.activeBookings} tone="brand" />
        </div>
      )}

      <Card
        className="mt-5"
        title="Menunggu approval"
        subtitle="Booking baru dari Manager Penyewa, belum di-assign mesin."
      >
        {isLoading ? (
          <TableSkeleton rows={2} columns={5} />
        ) : pendingApproval.length === 0 ? (
          <div className="grid place-items-center py-10 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <CalendarClock className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-800">Tidak ada booking menunggu</p>
          </div>
        ) : (
          <DataTable columns={approvalColumns} rows={pendingApproval} rowKey={(j) => j.id} />
        )}
      </Card>

      <Card className="mt-5" title="Job berjalan" subtitle="Rental management: lifecycle pasca-assign.">
        {isLoading ? (
          <TableSkeleton rows={3} columns={5} />
        ) : ongoingJobs.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">Belum ada job berjalan.</p>
        ) : (
          <DataTable columns={ongoingColumns} rows={ongoingJobs} rowKey={(j) => j.id} />
        )}
      </Card>

      {assignTarget ? (
        <AssignModal
          job={assignTarget}
          mold={moldById.get(assignTarget.moldId)}
          machines={machines}
          onClose={() => setAssignTarget(null)}
          onSaved={() => {
            setAssignTarget(null)
            void load()
          }}
        />
      ) : null}

      {rejectTarget ? (
        <RejectModal
          job={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onSaved={() => {
            setRejectTarget(null)
            void load()
          }}
        />
      ) : null}
    </div>
  )
}

function AssignModal({
  job,
  mold,
  machines,
  onClose,
  onSaved,
}: {
  job: Job
  mold: Mold | undefined
  machines: Machine[]
  onClose: () => void
  onSaved: () => void
}) {
  const { accessToken } = useAuth()
  const toast = useToast()
  const matching = mold ? machines.filter((m) => m.tonaseTon === mold.tonaseTon) : machines
  const [machineId, setMachineId] = useState(matching[0]?.id ?? '')
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      const body: AssignJobRequest = { machineId }
      await api.assignJob(accessToken, job.id, body)
      toast.success('Booking disetujui dan mesin di-assign')
      onSaved()
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal assign mesin'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal title={`Setujui ${job.jobNumber}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {matching.length === 0 ? (
          <p className="text-sm text-rose-600">
            Tidak ada mesin tersedia{mold ? ` dengan tonase ${mold.tonaseTon} ton` : ''}.
          </p>
        ) : (
          <SelectField
            label="Mesin"
            value={machineId}
            onChange={setMachineId}
            options={matching.map((m) => ({ value: m.id, label: `${m.machineNumber} (${m.tonaseTon} ton)` }))}
          />
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={isSaving || !machineId}>
            {isSaving ? 'Memproses...' : 'Setujui + assign'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function RejectModal({ job, onClose, onSaved }: { job: Job; onClose: () => void; onSaved: () => void }) {
  const { accessToken } = useAuth()
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      const body: RejectJobRequest = { reason: reason.trim() }
      await api.rejectJob(accessToken, job.id, body)
      toast.success('Booking ditolak')
      onSaved()
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal menolak booking'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal title={`Tolak ${job.jobNumber}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextAreaField label="Alasan penolakan" value={reason} onChange={setReason} required />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" variant="danger" disabled={isSaving || reason.trim() === ''}>
            {isSaving ? 'Memproses...' : 'Tolak booking'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
