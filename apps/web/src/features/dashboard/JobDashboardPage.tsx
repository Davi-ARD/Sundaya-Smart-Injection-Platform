import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Factory, Gauge } from 'lucide-react'
import type { JobDashboard } from '@mold-tracker/shared'
import { useAuth } from '../auth/authContextValue'
import { api } from '../../lib/api'
import { JobLifecycleBadge, ProgressMoldingBadge } from '../../components/ui/Badge'
import { Card, StatCard } from '../../components/ui/Card'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { useToast } from '../../components/ui/Toast'
import { errorMessage } from '../../lib/errorMessage'
import { formatDateTime } from '../../lib/format'

const nf = (value: number) => value.toLocaleString('id-ID')

// Persentase reject dari total yang diproduksi, satu desimal.
const rejectRate = (good: number, reject: number) => {
  const produced = good + reject
  return produced ? Math.round((reject / produced) * 1000) / 10 : 0
}

// Dashboard job (Admin Penyewa di lokasi Sundaya): ringkasan tiap job aktif
// perusahaan induk. Semua angka diturunkan dari Log Produksi, bukan input baru.
export function JobDashboardPage() {
  const { accessToken } = useAuth()
  const toast = useToast()

  const [jobs, setJobs] = useState<JobDashboard[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      setJobs(await api.getJobDashboard(accessToken))
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
    return { good, reject, rejectRate: rejectRate(good, reject) }
  }, [jobs])

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard Job</h1>
          <p className="mt-1 text-sm text-slate-500">
            Job aktif perusahaan Anda di lokasi Sundaya beserta capaian produksinya.
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
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Total produk baik" value={nf(totals.good)} tone="emerald" />
            <StatCard label="Total reject" value={nf(totals.reject)} tone={totals.reject ? 'amber' : 'slate'} />
            <StatCard
              label="Reject rate"
              value={`${totals.rejectRate}%`}
              hint="Dari seluruh job aktif"
              tone={totals.rejectRate > 5 ? 'rose' : 'emerald'}
            />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {jobs.map((job) => (
              <JobCard key={job.jobId} job={job} />
            ))}
          </div>
        </>
      )}
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
          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
            <Factory className="h-3.5 w-3.5" />
            {job.machineNumber ?? 'Mesin belum di-assign'}
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
          <dd className="mt-0.5 text-lg font-bold text-emerald-700">{nf(job.totalGoodProduct)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">Reject</dt>
          <dd className="mt-0.5 text-lg font-bold text-slate-900">{nf(job.totalReject)}</dd>
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
            {job.materialRemainingKg != null ? `${nf(job.materialRemainingKg)} kg` : '-'}
          </dd>
        </div>
      </dl>

      <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
        Log terakhir: {formatDateTime(job.latestLogAt)}
      </p>
    </Card>
  )
}
