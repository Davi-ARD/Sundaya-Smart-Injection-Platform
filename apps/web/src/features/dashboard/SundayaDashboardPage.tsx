import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarClock, TimerReset } from 'lucide-react'
import {
  ExtensionStatus,
  JobLifecycle,
  JobStatus,
  type ExtensionRequestRow,
  type Job,
  type Mold,
  type SundayaDashboard,
} from '@mold-tracker/shared'
import { useAuth } from '../auth/authContextValue'
import { api } from '../../lib/api'
import { Badge, ExtensionStatusBadge, type BadgeTone } from '../../components/ui/Badge'
import { Card, StatCard } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { CardSkeleton, TableSkeleton } from '../../components/ui/Skeleton'
import { useToast } from '../../components/ui/Toast'
import { errorMessage } from '../../lib/errorMessage'
import { formatDate, formatSisaHari } from '../../lib/format'

const ONGOING_LIFECYCLES = [
  JobLifecycle.DIKONFIRMASI,
  JobLifecycle.DIKIRIM,
  JobLifecycle.AKTIF,
  JobLifecycle.SELESAI_SEWA,
  JobLifecycle.DIKEMBALIKAN,
]

const jobStatusTone: Record<JobStatus, BadgeTone> = {
  [JobStatus.ON_SCHEDULE]: 'emerald',
  [JobStatus.WARNING]: 'amber',
  [JobStatus.CRITICAL]: 'rose',
  [JobStatus.COMPLETED]: 'slate',
}

const jobStatusLabel: Record<JobStatus, string> = {
  [JobStatus.ON_SCHEDULE]: 'On schedule',
  [JobStatus.WARNING]: 'Warning',
  [JobStatus.CRITICAL]: 'Critical',
  [JobStatus.COMPLETED]: 'Completed',
}

// Dashboard Sundaya (staf): pemantauan armada dan sewa berjalan. Semua aksi
// booking (approval, assign mesin, keputusan perpanjangan) ada di tab Booking,
// dashboard ini murni baca. Teknisi dan Admin Sundaya melihat halaman identik.
export function SundayaDashboardPage() {
  const { accessToken } = useAuth()
  const toast = useToast()

  const [summary, setSummary] = useState<SundayaDashboard | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [molds, setMolds] = useState<Mold[]>([])
  const [extensions, setExtensions] = useState<ExtensionRequestRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [dashboard, jobList, moldList, extensionList] = await Promise.all([
        api.getSundayaDashboard(accessToken),
        api.listJobs(accessToken),
        api.listMolds(accessToken),
        api.listExtensions(accessToken),
      ])
      setSummary(dashboard)
      setJobs(jobList)
      setMolds(moldList)
      setExtensions(extensionList)
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
  const ongoingJobs = useMemo(() => jobs.filter((j) => ONGOING_LIFECYCLES.includes(j.lifecycle)), [jobs])
  const pendingApprovalCount = useMemo(
    () => jobs.filter((j) => j.lifecycle === JobLifecycle.DIAJUKAN).length,
    [jobs],
  )
  const pendingExtensions = useMemo(
    () => extensions.filter((e) => e.status === ExtensionStatus.DIAJUKAN),
    [extensions],
  )

  const progressColumns: Column<Job>[] = [
    { header: 'Penyewa', cell: (j) => j.companyName ?? <span className="text-slate-400">-</span> },
    { header: 'Mesin', cell: (j) => j.machineNumber ?? <span className="text-slate-400">Belum assign</span> },
    { header: 'Cetakan', cell: (j) => moldById.get(j.moldId)?.kodeMold ?? <span className="text-slate-400">-</span> },
    { header: 'Selesai sewa', cell: (j) => formatDate(j.endDate) },
    { header: 'Status', cell: (j) => <Badge tone={jobStatusTone[j.jobStatus]}>{jobStatusLabel[j.jobStatus]}</Badge> },
  ]

  const extensionColumns: Column<ExtensionRequestRow>[] = [
    { header: 'No. Job', cell: (e) => <span className="font-semibold text-slate-900">{e.jobNumber}</span> },
    { header: 'Penyewa', cell: (e) => e.companyName ?? <span className="text-slate-400">-</span> },
    { header: 'Sisa sewa', cell: (e) => formatSisaHari(e.sisaHariSewa) },
    { header: 'Tambahan diminta', cell: (e) => `${e.additionalDays} hari` },
    { header: 'Status', cell: (e) => <ExtensionStatusBadge status={e.status} /> },
  ]

  const monitoring = summary?.rentalMonitoring

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard Sundaya</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ringkasan operasional seluruh mesin, job aktif, dan status sewa berjalan.
        </p>
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

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card
          title="Rental monitoring"
          subtitle="Cek berkala sewa yang mendekati jatuh tempo dan permintaan perpanjangan."
          actions={
            <Link
              to="/staff/booking"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Buka Booking <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {isLoading || !monitoring ? (
            <CardSkeleton lines={3} />
          ) : (
            <dl className="divide-y divide-slate-100">
              <MonitoringRow
                label="Sisa sewa terpendek"
                value={formatSisaHari(monitoring.shortestRemainingDays)}
                tone={
                  monitoring.shortestRemainingDays != null && monitoring.shortestRemainingDays <= 3
                    ? 'amber'
                    : 'slate'
                }
              />
              <MonitoringRow
                label="Permintaan perpanjangan"
                value={`${monitoring.pendingExtensions} menunggu`}
                tone={monitoring.pendingExtensions > 0 ? 'amber' : 'slate'}
              />
              <MonitoringRow
                label="Lewat jatuh tempo"
                value={`${monitoring.overdueJobs} mesin`}
                tone={monitoring.overdueJobs > 0 ? 'rose' : 'slate'}
              />
              <MonitoringRow
                label="Booking menunggu approval"
                value={`${pendingApprovalCount} booking`}
                tone={pendingApprovalCount > 0 ? 'amber' : 'slate'}
              />
            </dl>
          )}
        </Card>

        <Card
          title="Permintaan perpanjangan terbaru"
          subtitle="Keputusan diambil di tab Booking."
        >
          {isLoading ? (
            <TableSkeleton rows={2} columns={5} />
          ) : pendingExtensions.length === 0 ? (
            <div className="grid place-items-center py-10 text-center">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <TimerReset className="h-6 w-6" />
              </span>
              <p className="mt-3 text-sm font-semibold text-slate-800">Tidak ada permintaan</p>
              <p className="mt-1 text-sm text-slate-500">Semua sewa berjalan sesuai periode awal.</p>
            </div>
          ) : (
            <DataTable columns={extensionColumns} rows={pendingExtensions} rowKey={(e) => e.extensionId} />
          )}
        </Card>
      </div>

      <Card
        className="mt-5"
        title="Production progress"
        subtitle="Job yang sedang berjalan di seluruh penyewa."
      >
        {isLoading ? (
          <TableSkeleton rows={3} columns={5} />
        ) : ongoingJobs.length === 0 ? (
          <div className="grid place-items-center py-10 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <CalendarClock className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-800">Belum ada job berjalan</p>
          </div>
        ) : (
          <DataTable columns={progressColumns} rows={ongoingJobs} rowKey={(j) => j.id} />
        )}
      </Card>
    </div>
  )
}

const monitoringToneClasses: Record<'slate' | 'amber' | 'rose', string> = {
  slate: 'text-slate-900',
  amber: 'text-amber-700',
  rose: 'text-rose-700',
}

function MonitoringRow({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: keyof typeof monitoringToneClasses
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className={['text-sm font-semibold', monitoringToneClasses[tone]].join(' ')}>{value}</dd>
    </div>
  )
}
