import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Boxes, ClipboardList, Factory, Gauge, Layers, PackagePlus } from 'lucide-react'
import { LogProduksiEventType, type JobDashboard, type JobLogEntry } from '@mold-tracker/shared'
import { useAuth } from '../auth/authContextValue'
import { api } from '../../lib/api'
import { JobLifecycleBadge, ProgressMoldingBadge, progressMoldingLabel } from '../../components/ui/Badge'
import { Card, StatCard } from '../../components/ui/Card'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { useToast } from '../../components/ui/Toast'
import { errorMessage } from '../../lib/errorMessage'
import { formatDate, formatDateTime, formatNumber, formatSisaHari } from '../../lib/format'

const eventLabel: Record<LogProduksiEventType, string> = {
  [LogProduksiEventType.MATERIAL_DATANG]: 'Material datang',
  [LogProduksiEventType.PRODUKSI_HARIAN]: 'Produksi harian',
  [LogProduksiEventType.PROGRESS_MOLDING]: 'Progress molding',
}

const eventIcon = {
  [LogProduksiEventType.MATERIAL_DATANG]: PackagePlus,
  [LogProduksiEventType.PRODUKSI_HARIAN]: Factory,
  [LogProduksiEventType.PROGRESS_MOLDING]: Layers,
}

// Persentase reject dari total yang diproduksi, satu desimal.
const rejectRate = (good: number, reject: number) => {
  const produced = good + reject
  return produced ? Math.round((reject / produced) * 1000) / 10 : 0
}

// Ringkasan satu baris per event, sama seperti timeline di halaman Log Produksi.
const logSummary = (log: JobLogEntry) => {
  switch (log.eventType) {
    case LogProduksiEventType.MATERIAL_DATANG:
      return `${log.materialName ?? '-'} - ${log.jumlahKg ?? 0} kg${log.noSuratJalan ? ` (surat jalan ${log.noSuratJalan})` : ''}`
    case LogProduksiEventType.PRODUKSI_HARIAN:
      return `${formatNumber(log.goodProduct ?? 0)} baik, ${formatNumber(log.rejectCount ?? 0)} reject${
        log.materialRemainingKg != null ? `, sisa material ${log.materialRemainingKg} kg` : ''
      }`
    default:
      return `${log.progressMolding ? progressMoldingLabel[log.progressMolding] : '-'}${
        log.keteranganProgress ? ` - ${log.keteranganProgress}` : ''
      }`
  }
}

// Dashboard job (Admin Penyewa di lokasi Sundaya): ringkasan tiap job aktif
// perusahaan induk plus log utama seluruh job. Semua angka diturunkan dari Log
// Produksi dan data booking, bukan input baru.
export function JobDashboardPage() {
  const { accessToken } = useAuth()
  const toast = useToast()

  const [jobs, setJobs] = useState<JobDashboard[]>([])
  const [logs, setLogs] = useState<JobLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [jobList, logList] = await Promise.all([
        api.getJobDashboard(accessToken),
        api.getJobLogs(accessToken),
      ])
      setJobs(jobList)
      setLogs(logList)
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal memuat dashboard job'))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, toast])

  useEffect(() => {
    void load()
  }, [load])

  const totals = useMemo(() => {
    const good = jobs.reduce((sum, job) => sum + job.totalGoodProduct, 0)
    const reject = jobs.reduce((sum, job) => sum + job.totalReject, 0)
    // Sisa sewa terpendek: yang paling perlu diperhatikan Admin Penyewa.
    const sisa = jobs.map((job) => job.sisaHariSewa).filter((d): d is number => d != null)
    return {
      good,
      reject,
      rejectRate: rejectRate(good, reject),
      sisaTerpendek: sisa.length ? Math.min(...sisa) : null,
    }
  }, [jobs])

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard Job</h1>
          <p className="mt-1 text-sm text-slate-500">
            Job aktif perusahaan Anda di lokasi Sundaya beserta cetakan, capaian produksi, dan sisa
            masa sewa mesinnya.
          </p>
        </div>
        <Link
          to="/logs"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
        >
          Catat log produksi <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {isLoading ? (
        <Card>
          <CardSkeleton lines={4} />
        </Card>
      ) : jobs.length === 0 ? (
        <Card>
          <div className="grid place-items-center py-14 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <Gauge className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-800">Belum ada job aktif</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Job muncul di sini setelah booking perusahaan Anda disetujui dan mesin mulai aktif.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total produk baik" value={formatNumber(totals.good)} tone="emerald" />
            <StatCard label="Total reject" value={formatNumber(totals.reject)} tone={totals.reject ? 'amber' : 'slate'} />
            <StatCard
              label="Reject rate"
              value={`${totals.rejectRate}%`}
              hint="Dari seluruh job aktif"
              tone={totals.rejectRate > 5 ? 'rose' : 'emerald'}
            />
            <StatCard
              label="Sisa masa sewa terpendek"
              value={formatSisaHari(totals.sisaTerpendek)}
              hint="Hubungi Manager bila perlu perpanjangan"
              tone={totals.sisaTerpendek != null && totals.sisaTerpendek <= 3 ? 'amber' : 'slate'}
            />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {jobs.map((job) => (
              <JobCard key={job.jobId} job={job} />
            ))}
          </div>
        </>
      )}

      <Card
        className="mt-5"
        title="Log utama"
        subtitle="Seluruh event dari semua job perusahaan Anda, terbaru di atas."
        actions={
          <Link
            to="/logs"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Log per job <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      >
        {isLoading ? (
          <CardSkeleton lines={4} />
        ) : logs.length === 0 ? (
          <div className="grid place-items-center py-12 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <ClipboardList className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-800">Belum ada event tercatat</p>
            <p className="mt-1 text-sm text-slate-500">Catat event pertama di halaman Log Produksi.</p>
          </div>
        ) : (
          <ol className="space-y-3">
            {logs.map((log) => {
              const Icon = eventIcon[log.eventType]
              return (
                <li
                  key={log.id}
                  className="flex gap-3 rounded-xl border border-slate-200/70 bg-white p-4 shadow-soft"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {eventLabel[log.eventType]}
                        <span className="ml-2 font-medium text-slate-500">
                          {log.jobNumber} - {log.moldKode}
                        </span>
                      </p>
                      <p className="text-xs text-slate-400">{formatDateTime(log.occurredAt)}</p>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{logSummary(log)}</p>
                    {log.catatan ? <p className="mt-1 text-xs text-slate-500">{log.catatan}</p> : null}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </Card>
    </div>
  )
}

function JobCard({ job }: { job: JobDashboard }) {
  const rate = rejectRate(job.totalGoodProduct, job.totalReject)

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold text-slate-900">{job.jobNumber}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <Boxes className="h-3.5 w-3.5" />
              {job.moldKode} - {job.moldProduk} ({job.moldCavity} cavity)
            </span>
            <span className="flex items-center gap-1.5">
              <Factory className="h-3.5 w-3.5" />
              {job.machineNumber ?? 'Mesin belum di-assign'}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <JobLifecycleBadge status={job.lifecycle} />
          {job.progressMolding ? <ProgressMoldingBadge status={job.progressMolding} /> : null}
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <dt className="text-xs font-medium text-slate-500">Produk baik</dt>
          <dd className="mt-0.5 text-lg font-bold text-emerald-700">{formatNumber(job.totalGoodProduct)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Reject</dt>
          <dd className="mt-0.5 text-lg font-bold text-slate-900">{formatNumber(job.totalReject)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Reject rate</dt>
          <dd className={['mt-0.5 text-lg font-bold', rate > 5 ? 'text-rose-700' : 'text-slate-900'].join(' ')}>
            {rate}%
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Sisa material</dt>
          <dd className="mt-0.5 text-lg font-bold text-slate-900">
            {job.materialRemainingKg != null ? `${formatNumber(job.materialRemainingKg)} kg` : '-'}
          </dd>
        </div>
      </dl>

      {job.targetOutput ? (
        <div className="mt-4">
          <div className="flex items-baseline justify-between text-xs text-slate-500">
            <span>Achievement terhadap target {formatNumber(job.targetOutput)} pcs</span>
            <span className="font-semibold text-slate-900">{job.achievement}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-600 transition-[width] duration-500"
              style={{ width: `${Math.min(job.achievement, 100)}%` }}
            />
          </div>
        </div>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-3">
        <div>
          <dt className="text-xs font-medium text-slate-500">Sisa masa sewa</dt>
          <dd
            className={[
              'mt-0.5 text-sm font-semibold',
              job.sisaHariSewa != null && job.sisaHariSewa <= 3 ? 'text-amber-700' : 'text-slate-900',
            ].join(' ')}
          >
            {formatSisaHari(job.sisaHariSewa)}
            {job.endDate ? (
              <span className="ml-1 font-normal text-slate-500">({formatDate(job.endDate)})</span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Log terakhir</dt>
          <dd className="mt-0.5 text-sm font-semibold text-slate-900">{formatDateTime(job.latestLogAt)}</dd>
        </div>
      </dl>
    </Card>
  )
}
