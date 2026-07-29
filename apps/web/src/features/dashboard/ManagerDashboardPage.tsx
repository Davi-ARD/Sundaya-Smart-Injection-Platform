import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Boxes, CalendarPlus } from 'lucide-react'
import { JobLifecycle, type Job, type ManagerDashboard, type Mold } from '@mold-tracker/shared'
import { useAuth } from '../auth/authContextValue'
import { api } from '../../lib/api'
import { Card, StatCard } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { JobLifecycleBadge } from '../../components/ui/Badge'
import { CardSkeleton, TableSkeleton } from '../../components/ui/Skeleton'
import { useToast } from '../../components/ui/Toast'
import { errorMessage } from '../../lib/errorMessage'
import { formatDate } from '../../lib/format'

// Lifecycle yang dianggap masih berjalan (bukan terminal).
const ACTIVE_LIFECYCLES = [
  JobLifecycle.DIAJUKAN,
  JobLifecycle.DIKONFIRMASI,
  JobLifecycle.DIKIRIM,
  JobLifecycle.AKTIF,
  JobLifecycle.SELESAI_SEWA,
  JobLifecycle.DIKEMBALIKAN,
]

// Dashboard Manager: ringkasan tenant sendiri. Semua angka dihitung server dari
// data yang sudah ada (mold tracking, job, log produksi, log pengiriman).
export function ManagerDashboardPage() {
  const { accessToken, user } = useAuth()
  const toast = useToast()

  const [summary, setSummary] = useState<ManagerDashboard | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [molds, setMolds] = useState<Mold[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [dashboard, jobList, moldList] = await Promise.all([
        api.getManagerDashboard(accessToken),
        api.listJobs(accessToken),
        api.listMolds(accessToken),
      ])
      setSummary(dashboard)
      setJobs(jobList)
      setMolds(moldList)
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
  const activeJobs = useMemo(
    () => jobs.filter((job) => ACTIVE_LIFECYCLES.includes(job.lifecycle)),
    [jobs],
  )

  const columns: Column<Job>[] = [
    { header: 'No. Job', cell: (j) => <span className="font-semibold text-slate-900">{j.jobNumber}</span> },
    {
      header: 'Cetakan',
      cell: (j) => moldById.get(j.moldId)?.kodeMold ?? <span className="text-slate-400">-</span>,
    },
    { header: 'Status', cell: (j) => <JobLifecycleBadge status={j.lifecycle} /> },
    { header: 'Mesin', cell: (j) => j.machineNumber ?? <span className="text-slate-400">Menunggu assign</span> },
    { header: 'Selesai sewa', cell: (j) => formatDate(j.endDate) },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ringkasan produksi dan pengiriman {user?.companyName ?? 'perusahaan Anda'}.
        </p>
      </div>

      {isLoading || !summary ? (
        <Card>
          <CardSkeleton lines={4} />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Cetakan di Sundaya"
              value={summary.moldsAtSundaya}
              hint="Sudah diterima, belum dikirim balik"
              tone="brand"
            />
            <StatCard label="Job berjalan" value={summary.ongoing} tone="slate" />
            <StatCard
              label="Total produk baik"
              value={summary.totalGoodProduct.toLocaleString('id-ID')}
              hint="Akumulasi dari Log Produksi"
              tone="emerald"
            />
            <StatCard
              label="Ketepatan pengiriman"
              value={`${summary.onTimeDeliveryRate}%`}
              hint="Dari Log Pengiriman"
              tone={summary.onTimeDeliveryRate >= 80 ? 'emerald' : 'amber'}
            />
          </div>

          <Card
            className="mt-5"
            title="Pencapaian target"
            subtitle="Rata-rata produk baik dibanding target output job."
          >
            <div className="flex items-end gap-4">
              <p className="text-3xl font-bold text-brand-700">{summary.avgAchievement}%</p>
              <div className="mb-1.5 h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-brand-600 transition-[width] duration-500"
                  style={{ width: `${Math.min(summary.avgAchievement, 100)}%` }}
                />
              </div>
            </div>
          </Card>
        </>
      )}

      <Card
        className="mt-5"
        title="Job berjalan"
        subtitle="Booking yang belum selesai."
        actions={
          <Link
            to="/booking"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Semua booking <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      >
        {isLoading ? (
          <TableSkeleton rows={3} columns={5} />
        ) : activeJobs.length === 0 ? (
          <div className="grid place-items-center py-12 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700">
              {molds.length === 0 ? <Boxes className="h-6 w-6" /> : <CalendarPlus className="h-6 w-6" />}
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-800">
              {molds.length === 0 ? 'Belum ada cetakan' : 'Belum ada job berjalan'}
            </p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              {molds.length === 0
                ? 'Daftarkan cetakan terlebih dahulu sebelum mengajukan booking.'
                : 'Ajukan booking untuk mulai produksi.'}
            </p>
            <Link
              to={molds.length === 0 ? '/molds' : '/booking'}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
            >
              {molds.length === 0 ? 'Tambah cetakan' : 'Ajukan booking'} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <DataTable columns={columns} rows={activeJobs} rowKey={(j) => j.id} />
        )}
      </Card>
    </div>
  )
}
