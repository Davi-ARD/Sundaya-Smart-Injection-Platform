import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Boxes, Gauge, Info } from 'lucide-react'
import type {
  JobCycleProduction,
  ManagerDashboard,
  MoldCycleProduction,
  MoldPlanRow,
} from '@mold-tracker/shared'
import { useAuth } from '../auth/authContextValue'
import { api } from '../../lib/api'
import { Card, StatCard } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import {
  JobLifecycleBadge,
  MoldTrackingBadge,
  ProgressMoldingBadge,
} from '../../components/ui/Badge'
import { CardSkeleton, TableSkeleton } from '../../components/ui/Skeleton'
import { useToast } from '../../components/ui/Toast'
import { errorMessage } from '../../lib/errorMessage'
import { formatDate, formatNumber, formatSisaHari } from '../../lib/format'

// Dashboard Manager Penyewa: MURNI VISUALISASI. Tidak ada tombol aksi maupun panel
// detail di sini; tombol yang ada hanya mengarahkan ke tab terkait. Detail cetakan
// dilihat di tab Cetakan, aksi booking di tab Booking Mesin.
//
// Satu tabel "Perkembangan cetakan" menggantikan dua tabel lama (Job berjalan dan
// Perkembangan plan mold) yang isinya bertumpang tindih.
export function ManagerDashboardPage() {
  const { accessToken, user } = useAuth()
  const toast = useToast()

  const [summary, setSummary] = useState<ManagerDashboard | null>(null)
  const [rows, setRows] = useState<MoldPlanRow[]>([])
  const [cycles, setCycles] = useState<JobCycleProduction[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [dashboard, planRows, cycleBlocks] = await Promise.all([
        api.getManagerDashboard(accessToken),
        api.getMoldPlan(accessToken),
        api.getCycleProduction(accessToken),
      ])
      setSummary(dashboard)
      setRows(planRows)
      setCycles(cycleBlocks)
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal memuat dashboard'))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, toast])

  useEffect(() => {
    void load()
  }, [load])

  const columns: Column<MoldPlanRow>[] = [
    {
      header: 'Cetakan',
      cell: (r) => (
        <span className="flex flex-col gap-0.5">
          <span className="font-semibold text-slate-900">{r.kodeMold}</span>
          <span className="text-xs text-slate-500">{r.namaProduk}</span>
        </span>
      ),
    },
    { header: 'Tracking', cell: (r) => <MoldTrackingBadge status={r.trackingStatus} /> },
    {
      header: 'Booking',
      cell: (r) =>
        r.jobNumber ? (
          <span className="flex flex-col gap-1">
            <span className="text-sm">{r.jobNumber}</span>
            {r.lifecycle ? <JobLifecycleBadge status={r.lifecycle} /> : null}
          </span>
        ) : (
          <span className="text-slate-400">Belum dibooking</span>
        ),
    },
    {
      header: 'Mesin',
      cell: (r) => r.machineNumber ?? <span className="text-slate-400">Belum assign</span>,
    },
    {
      header: 'Progress',
      cell: (r) =>
        r.progressMolding ? (
          <ProgressMoldingBadge status={r.progressMolding} />
        ) : (
          <span className="text-slate-400">-</span>
        ),
    },
    {
      header: 'Capaian',
      cell: (r) => (
        <span className="flex min-w-32 flex-col gap-1">
          <span className="text-sm">
            {formatNumber(r.totalGoodProduct)}
            {r.targetOutput != null ? ` / ${formatNumber(r.targetOutput)}` : ''}
          </span>
          <ProgressBar percent={r.achievement} tone={r.achievement >= 80 ? 'emerald' : 'brand'} />
        </span>
      ),
    },
    {
      header: 'Material',
      cell: (r) =>
        r.estimasiKg == null ? (
          <span className="text-slate-400">Tanpa plan</span>
        ) : (
          <span className="flex min-w-32 flex-col gap-1">
            <span className="text-sm">
              {formatNumber(r.materialUsedKg)} / {formatNumber(r.estimasiKg)} kg
            </span>
            <ProgressBar
              percent={r.materialUsagePercent ?? 0}
              tone={(r.materialUsagePercent ?? 0) >= 90 ? 'amber' : 'slate'}
            />
          </span>
        ),
    },
    { header: 'Sisa sewa', cell: (r) => formatSisaHari(r.sisaHariSewa) },
    {
      header: 'ETA',
      cell: (r) =>
        r.etaHari == null ? (
          <span className="text-slate-400">-</span>
        ) : r.etaHari === 0 ? (
          'Selesai'
        ) : (
          `${r.etaHari} hari`
        ),
    },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ringkasan produksi {user?.companyName ?? 'perusahaan Anda'}. Halaman ini hanya menampilkan
          informasi; aksi ada di tab masing-masing.
        </p>
      </div>

      {isLoading || !summary ? (
        <Card>
          <CardSkeleton lines={4} />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Cetakan di Sundaya"
            value={summary.moldsAtSundaya}
            hint="Sudah diterima, belum dikirim balik"
            tone="brand"
          />
          <StatCard label="Booking berjalan" value={summary.ongoing} tone="slate" />
          <StatCard
            label="Total produk baik"
            value={formatNumber(summary.totalGoodProduct)}
            hint="Akumulasi dari Log Produksi"
            tone="emerald"
          />
          <StatCard
            label="Pencapaian target"
            value={`${summary.avgAchievement}%`}
            hint="Rata-rata seluruh cetakan bertarget"
            tone={summary.avgAchievement >= 80 ? 'emerald' : 'amber'}
          />
        </div>
      )}

      <Card
        className="mt-5"
        title="Perkembangan cetakan"
        subtitle="Satu baris per cetakan: posisi fisik, booking, mesin, capaian produksi, dan kuota material."
        actions={
          <Link
            to="/molds"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Buka Cetakan <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      >
        {isLoading ? (
          <TableSkeleton rows={4} columns={8} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="Belum ada cetakan"
            message="Daftarkan cetakan di tab Cetakan agar perkembangannya terpantau di sini."
          />
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={(r) => r.moldId} />
        )}
      </Card>

      <div className="mt-6">
        <h2 className="text-lg font-semibold text-slate-950">Cycle production</h2>
        <p className="mt-1 text-sm text-slate-500">
          Capaian produksi dan pemakaian material per booking, dirinci tiap cetakan.
        </p>
      </div>

      {isLoading ? (
        <Card className="mt-3">
          <CardSkeleton lines={5} />
        </Card>
      ) : cycles.length === 0 ? (
        <Card className="mt-3">
          <EmptyState
            icon={Gauge}
            title="Belum ada booking berjalan"
            message="Cycle production muncul setelah booking disetujui dan produksi dicatat."
          />
        </Card>
      ) : (
        cycles.map((blok) => (
          <Card
            key={blok.jobId}
            className="mt-3"
            title={blok.jobNumber}
            subtitle={`Mesin ${blok.machineNumber ?? 'belum assign'}, sisa sewa ${formatSisaHari(
              blok.sisaHariSewa,
            )}`}
            actions={<JobLifecycleBadge status={blok.lifecycle} />}
          >
            <div className="space-y-5">
              {blok.molds.map((cycle) => (
                <MoldCycleBlock key={cycle.moldId} cycle={cycle} />
              ))}
            </div>
          </Card>
        ))
      )}

      <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Plan material tiap cetakan adalah batas maksimal pemakaian, bukan target yang dibandingkan.
        Admin Penyewa tidak dapat mencatat pemakaian melebihi plan.
      </p>
    </div>
  )
}

const barTone = {
  brand: 'bg-brand-600',
  emerald: 'bg-emerald-600',
  amber: 'bg-amber-500',
  slate: 'bg-slate-400',
} as const

function ProgressBar({
  percent,
  tone = 'brand',
}: {
  percent: number
  tone?: keyof typeof barTone
}) {
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <span
        className={['block h-full rounded-full transition-[width] duration-500', barTone[tone]].join(
          ' ',
        )}
        style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
      />
    </span>
  )
}

// Cycle production satu cetakan: angka ringkas, progress terhadap target, kuota
// material, dan rekap harian. Semuanya turunan Log Produksi.
function MoldCycleBlock({ cycle }: { cycle: MoldCycleProduction }) {
  return (
    <section className="rounded-xl border border-slate-200/70 bg-slate-50/40 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">
          {cycle.kodeMold} <span className="font-normal text-slate-500">{cycle.namaProduk}</span>
        </p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniStat
          label="Target produksi"
          value={cycle.targetOutput != null ? formatNumber(cycle.targetOutput) : '-'}
        />
        <MiniStat label="Good product" value={formatNumber(cycle.totalGoodProduct)} tone="emerald" />
        <MiniStat label="Reject" value={formatNumber(cycle.totalReject)} tone="rose" />
        <MiniStat label="Achievement" value={`${cycle.achievement}%`} tone="brand" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200/70 bg-white p-3.5">
          <p className="text-sm font-semibold text-slate-950">Progress vs target</p>
          <div className="mt-2">
            <ProgressBar
              percent={cycle.achievement}
              tone={cycle.achievement >= 80 ? 'emerald' : 'brand'}
            />
          </div>
          <dl className="mt-2 divide-y divide-slate-100">
            <MiniRow
              label="Sisa target"
              value={
                cycle.remainingTarget != null ? `${formatNumber(cycle.remainingTarget)} pcs` : '-'
              }
            />
            <MiniRow label="Reject rate" value={`${cycle.rejectRate}%`} />
            <MiniRow label="Total output" value={`${formatNumber(cycle.totalOutput)} pcs`} />
          </dl>

          <p className="mt-4 text-sm font-semibold text-slate-950">Material</p>
          <div className="mt-2">
            <ProgressBar
              percent={cycle.materialUsagePercent ?? 0}
              tone={(cycle.materialUsagePercent ?? 0) >= 90 ? 'amber' : 'slate'}
            />
          </div>
          <dl className="mt-2 divide-y divide-slate-100">
            <MiniRow label="Material" value={cycle.planMaterialUtama ?? 'Belum ditentukan'} />
            <MiniRow
              label="Plan (batas maksimal)"
              value={
                cycle.planMaterialKg != null
                  ? `${formatNumber(cycle.planMaterialKg)} kg`
                  : 'Tanpa batas'
              }
            />
            <MiniRow label="Terpakai" value={`${formatNumber(cycle.materialUsedKg)} kg`} />
            <MiniRow
              label="Sisa kuota"
              value={
                cycle.materialRemainingKg != null
                  ? `${formatNumber(cycle.materialRemainingKg)} kg`
                  : '-'
              }
            />
          </dl>
        </div>

        <div className="rounded-lg border border-slate-200/70 bg-white p-3.5">
          <p className="text-sm font-semibold text-slate-950">Ringkasan cycle harian</p>
          {cycle.harian.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Belum ada produksi harian tercatat.</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200/70 text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4">Tanggal</th>
                    <th className="py-2 pr-4">Good</th>
                    <th className="py-2 pr-4">Reject</th>
                    <th className="py-2 pr-4">Material</th>
                    <th className="py-2">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cycle.harian.map((hari) => (
                    <tr key={hari.occurredAt}>
                      <td className="py-2 pr-4 whitespace-nowrap">{formatDate(hari.occurredAt)}</td>
                      <td className="py-2 pr-4">{formatNumber(hari.goodProduct)}</td>
                      <td className="py-2 pr-4">{formatNumber(hari.rejectCount)}</td>
                      <td className="py-2 pr-4">
                        {hari.materialUsedKg != null ? `${formatNumber(hari.materialUsedKg)} kg` : '-'}
                      </td>
                      <td className="py-2 text-slate-500">{hari.catatan ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

const miniTone = {
  brand: 'text-brand-700',
  emerald: 'text-emerald-700',
  rose: 'text-rose-700',
  slate: 'text-slate-950',
} as const

function MiniStat({
  label,
  value,
  tone = 'slate',
}: {
  label: string
  value: string
  tone?: keyof typeof miniTone
}) {
  return (
    <div className="rounded-lg border border-slate-200/70 bg-white px-3.5 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={['mt-1 text-xl font-bold', miniTone[tone]].join(' ')}>{value}</p>
    </div>
  )
}

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-slate-900">{value}</dd>
    </div>
  )
}
