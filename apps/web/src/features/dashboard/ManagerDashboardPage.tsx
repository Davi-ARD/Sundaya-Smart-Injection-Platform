import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Boxes, CalendarPlus } from 'lucide-react'
import {
  JobLifecycle,
  ProgressMolding,
  type Job,
  type ManagerDashboard,
  type Mold,
  type MoldPlanRow,
} from '@mold-tracker/shared'
import { useAuth } from '../auth/authContextValue'
import { api } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Card, StatCard } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import {
  JobLifecycleBadge,
  MoldTrackingBadge,
  ProgressMoldingBadge,
  progressMoldingLabel,
} from '../../components/ui/Badge'
import { CardSkeleton, TableSkeleton } from '../../components/ui/Skeleton'
import { useToast } from '../../components/ui/Toast'
import { errorMessage } from '../../lib/errorMessage'
import { formatDate, formatNumber } from '../../lib/format'
import { MoldPlanDetail } from '../molds/MoldPlanDetail'

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
  const [plan, setPlan] = useState<MoldPlanRow[]>([])
  const [detailMoldId, setDetailMoldId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [dashboard, jobList, moldList, planList] = await Promise.all([
        api.getManagerDashboard(accessToken),
        api.listJobs(accessToken),
        api.listMolds(accessToken),
        api.getMoldPlan(accessToken),
      ])
      setSummary(dashboard)
      setJobs(jobList)
      setMolds(moldList)
      setPlan(planList)
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

  // Baris pertama dipilih otomatis supaya detail cepat langsung terisi.
  const detailRow = useMemo(
    () => plan.find((row) => row.moldId === detailMoldId) ?? plan[0] ?? null,
    [plan, detailMoldId],
  )

  const moldingCounts = useMemo(() => {
    const counts = { [ProgressMolding.PLANNING]: 0, [ProgressMolding.ONGOING]: 0, [ProgressMolding.SUDAH_DIPRODUKSI]: 0 }
    for (const row of plan) counts[row.progressMolding ?? ProgressMolding.PLANNING] += 1
    return counts
  }, [plan])

  const planTotals = useMemo(
    () =>
      plan.reduce(
        (acc, row) => ({
          target: acc.target + (row.targetOutput ?? 0),
          good: acc.good + row.totalGoodProduct,
          reject: acc.reject + row.totalReject,
        }),
        { target: 0, good: 0, reject: 0 },
      ),
    [plan],
  )

  const planColumns: Column<MoldPlanRow>[] = [
    { header: 'Mold', cell: (r) => <span className="font-semibold text-slate-900">{r.kodeMold}</span> },
    { header: 'Produk', cell: (r) => r.namaProduk },
    { header: 'Job', cell: (r) => r.jobNumber ?? <span className="text-slate-400">-</span> },
    { header: 'Mesin', cell: (r) => r.machineNumber ?? <span className="text-slate-400">Belum assign</span> },
    { header: 'Tracking', cell: (r) => <MoldTrackingBadge status={r.trackingStatus} /> },
    {
      header: 'Progress molding',
      cell: (r) =>
        r.progressMolding ? (
          <ProgressMoldingBadge status={r.progressMolding} />
        ) : (
          <span className="text-slate-400">{progressMoldingLabel[ProgressMolding.PLANNING]}</span>
        ),
    },
    { header: 'Target', cell: (r) => (r.targetOutput != null ? formatNumber(r.targetOutput) : '-') },
    { header: 'Good', cell: (r) => formatNumber(r.totalGoodProduct) },
    { header: 'Reject', cell: (r) => formatNumber(r.totalReject) },
    {
      header: 'Achievement',
      cell: (r) => (
        <div className="min-w-24">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-brand-600 transition-[width] duration-500"
              style={{ width: `${Math.min(r.achievement, 100)}%` }}
            />
          </div>
          <span className="mt-1 block text-xs text-slate-500">{r.achievement}%</span>
        </div>
      ),
    },
    {
      header: 'ETA',
      cell: (r) => (r.etaHari == null ? '-' : r.etaHari === 0 ? 'Selesai' : `${r.etaHari} hari`),
    },
    {
      header: '',
      className: 'text-right',
      cell: (r) => (
        <Button size="sm" variant="secondary" onClick={() => setDetailMoldId(r.moldId)}>
          Detail cepat
        </Button>
      ),
    },
  ]

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

      <Card
        className="mt-5"
        title="Perkembangan plan mold"
        subtitle="Satu baris per cetakan: posisi fisik, mesin, dan capaian produksi yang dijalankan Admin Penyewa di lokasi."
      >
        {isLoading ? (
          <TableSkeleton rows={4} columns={7} />
        ) : plan.length === 0 ? (
          <div className="grid place-items-center py-12 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <Boxes className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-800">Belum ada cetakan</p>
            <p className="mt-1 text-sm text-slate-500">
              Daftarkan cetakan di halaman Cetakan agar perkembangannya terpantau di sini.
            </p>
          </div>
        ) : (
          <DataTable columns={planColumns} rows={plan} rowKey={(r) => r.moldId} />
        )}
      </Card>

      {plan.length > 0 ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <Card title="Ringkasan status molding">
            <dl className="divide-y divide-slate-100">
              <SummaryRow label="Planning" value={`${moldingCounts.PLANNING} mold`} />
              <SummaryRow label="Ongoing" value={`${moldingCounts.ONGOING} mold`} />
              <SummaryRow label="Sudah diproduksi" value={`${moldingCounts.SUDAH_DIPRODUKSI} mold`} />
            </dl>
          </Card>

          <Card title="Produksi vs target (agregat)">
            <dl className="divide-y divide-slate-100">
              <SummaryRow label="Total target" value={`${formatNumber(planTotals.target)} pcs`} />
              <SummaryRow label="Total good" value={`${formatNumber(planTotals.good)} pcs`} />
              <SummaryRow label="Total reject" value={`${formatNumber(planTotals.reject)} pcs`} />
              <SummaryRow
                label="Sisa target"
                value={`${formatNumber(Math.max(planTotals.target - planTotals.good, 0))} pcs`}
              />
            </dl>
          </Card>
        </div>
      ) : null}

      {detailRow ? (
        <section className="mt-5">
          <h2 className="text-sm font-semibold text-slate-500">
            Detail cepat - {detailRow.kodeMold}
            {detailRow.progressMolding ? ` (${progressMoldingLabel[detailRow.progressMolding]})` : ''}
          </h2>
          <div className="mt-3">
            <MoldPlanDetail row={detailRow} />
          </div>
        </section>
      ) : null}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  )
}
