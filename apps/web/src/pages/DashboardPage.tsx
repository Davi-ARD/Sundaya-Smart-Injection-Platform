import { useEffect, useState, type ComponentType } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts'
import { AlertTriangle, ClipboardList, Clock, Factory, PackageCheck, Percent } from 'lucide-react'
import {
  DEFAULT_EFFICIENCY_THRESHOLD,
  MachineStatus,
  ReviewStatus,
  Role,
  type AdminDashboard,
  type PenyediaDashboard,
  type ProductionBatch,
  type Rental,
} from '@mold-tracker/shared'
import { useAuth } from '../features/auth/authContextValue'
import { api } from '../lib/api'
import { useToast } from '../components/ui/Toast'
import { Card, StatCard } from '../components/ui/Card'
import { CountdownTimer } from '../components/ui/CountdownTimer'
import { DataTable } from '../components/ui/DataTable'
import { CardSkeleton } from '../components/ui/Skeleton'
import {
  machineStatusLabel,
  RentalStatusBadge,
  ReviewStatusBadge,
  WarrantyStatusBadge,
} from '../components/ui/Badge'

const errorMessage = (caughtError: unknown, fallback: string) =>
  caughtError instanceof Error ? caughtError.message : fallback

// Pola fetch + isLoading + toast-on-error yang sama dipakai ketiga dashboard role.
function useDashboardData<T>(fetcher: (token: string | null) => Promise<T>) {
  const { accessToken } = useAuth()
  const toast = useToast()
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetcher(accessToken)
      .then(setData)
      .catch((caughtError) =>
        toast.error(caughtError instanceof Error ? caughtError.message : 'Gagal memuat dashboard.'),
      )
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  return { data, isLoading }
}

// Palet status tetap (bukan kategori) agar warna membawa arti tingkat urgensi,
// bukan sekadar identitas — lihat dataviz skill: status color reserved.
const statusColor: Record<MachineStatus, string> = {
  [MachineStatus.TERSEDIA]: '#0ca30c',
  [MachineStatus.DIAJUKAN]: '#fab219',
  [MachineStatus.DIKONFIRMASI]: '#2a78d6',
  [MachineStatus.DIKIRIM]: '#2a78d6',
  [MachineStatus.AKTIF]: '#4a3aa7',
  [MachineStatus.SELESAI_SEWA]: '#fab219',
  [MachineStatus.DIKEMBALIKAN]: '#fab219',
  [MachineStatus.PENGECEKAN]: '#fab219',
  [MachineStatus.MAINTENANCE]: '#d03b3b',
}

const MUTED_GRAY = '#898781'
const BLUE = '#ea580c' // aksen brand (orange-600), dipakai untuk seri chart utama

export function DashboardPage() {
  const { user } = useAuth()

  if (!user) {
    return null
  }

  switch (user.role) {
    case Role.ADMIN:
      return <AdminDashboardView />
    case Role.PENYEDIA:
      return <PenyediaDashboardView />
    case Role.PENYEWA:
      return <PenyewaDashboardView />
    case Role.OPERATOR:
      return <OperatorDashboardView name={user.nama} />
    default:
      return null
  }
}

function DashboardHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <section className="rounded-xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-200/50">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">Dashboard</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-950">{title}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{subtitle}</p>
    </section>
  )
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardSkeleton lines={4} />
      </Card>
      <Card>
        <CardSkeleton lines={4} />
      </Card>
    </div>
  )
}

function StatusBreakdownChart({ counts }: { counts: { status: MachineStatus; count: number }[] }) {
  const data = counts.map((item) => ({
    label: machineStatusLabel[item.status],
    count: item.count,
    status: item.status,
  }))

  return (
    <ResponsiveContainer width="100%" height={Math.max(240, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
        <CartesianGrid horizontal={false} stroke="#e1e0d9" />
        <XAxis type="number" allowDecimals={false} stroke="#898781" fontSize={12} />
        <YAxis type="category" dataKey="label" stroke="#898781" fontSize={12} width={110} />
        <Tooltip cursor={{ fill: '#f9f9f7' }} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={18}>
          {data.map((item) => (
            <Cell key={item.status} fill={statusColor[item.status]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

type AdminBundle = {
  summary: AdminDashboard
  batches: ProductionBatch[]
  rentals: Rental[]
  penyewaNames: Record<string, string>
}

function useAdminBundle() {
  const { accessToken } = useAuth()
  const toast = useToast()
  const [data, setData] = useState<AdminBundle | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getAdminDashboard(accessToken),
      api.listBatches(accessToken),
      api.listRentals(accessToken),
      api.listUsers(accessToken, { role: Role.PENYEWA }),
    ])
      .then(([summary, batches, rentals, penyewaUsers]) => {
        setData({
          summary,
          batches,
          rentals,
          penyewaNames: Object.fromEntries(penyewaUsers.map((item) => [item.id, item.nama])),
        })
      })
      .catch((caughtError) => toast.error(errorMessage(caughtError, 'Gagal memuat dashboard.')))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  return { data, isLoading }
}

// yyyy-MM-dd di zona waktu lokal (bukan toISOString yang bisa mundur satu hari di UTC).
const toDayKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const last7DayKeys = () => {
  const days: string[] = []
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date()
    date.setDate(date.getDate() - offset)
    days.push(toDayKey(date))
  }
  return days
}

const statBorderClasses = {
  brand: 'border-l-brand-500',
  emerald: 'border-l-emerald-500',
  rose: 'border-l-rose-500',
  slate: 'border-l-slate-300',
} as const

const statIconClasses = {
  brand: 'bg-brand-50 text-brand-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  rose: 'bg-rose-50 text-rose-600',
  slate: 'bg-slate-100 text-slate-500',
} as const

function OperationalStatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'slate',
}: {
  label: string
  value: string | number
  hint: string
  icon: ComponentType<{ className?: string }>
  tone?: keyof typeof statBorderClasses
}) {
  return (
    <article className={['rounded-xl border border-l-4 border-slate-200/70 bg-white p-5 shadow-sm shadow-slate-200/50', statBorderClasses[tone]].join(' ')}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <span className={['grid h-8 w-8 shrink-0 place-items-center rounded-lg', statIconClasses[tone]].join(' ')}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </article>
  )
}

function AdminDashboardView() {
  const { data, isLoading } = useAdminBundle()

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Ringkasan Operasional"
        subtitle="Kondisi mesin, request sewa, dan performa produksi hari ini."
      />

      {isLoading ? (
        <DashboardSkeleton />
      ) : data ? (
        <AdminDashboardBody data={data} />
      ) : null}
    </div>
  )
}

function AdminDashboardBody({ data }: { data: AdminBundle }) {
  const days = last7DayKeys()

  const production = days.map((dayKey) => {
    const dayBatches = data.batches.filter((batch) => toDayKey(new Date(batch.startAt)) === dayKey)
    const target = dayBatches.reduce((sum, batch) => sum + batch.targetOutput, 0)
    const actual = dayBatches.reduce((sum, batch) => sum + batch.actualOutput, 0)
    const avgEfficiency = dayBatches.length
      ? dayBatches.reduce((sum, batch) => sum + batch.efficiency, 0) / dayBatches.length
      : null
    return {
      dayKey,
      dateLabel: dayKey.slice(5),
      target,
      actual,
      efficiency: avgEfficiency === null ? null : Math.round(avgEfficiency * 10) / 10,
    }
  })

  const last7Batches = data.batches.filter((batch) => days.includes(toDayKey(new Date(batch.startAt))))
  const totalReject = last7Batches.reduce((sum, batch) => sum + batch.rejectCount, 0)
  const totalProduced = last7Batches.reduce((sum, batch) => sum + batch.actualOutput + batch.rejectCount, 0)
  const rejectRate = totalProduced > 0 ? (totalReject / totalProduced) * 100 : 0
  const avgEfficiency = last7Batches.length
    ? last7Batches.reduce((sum, batch) => sum + batch.efficiency, 0) / last7Batches.length
    : 0
  const machinesActive =
    data.summary.machineStatusCounts.find((item) => item.status === MachineStatus.AKTIF)?.count ?? 0

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OperationalStatCard
          label="Total Mesin"
          value={data.summary.totalMachines}
          hint="Seluruh mesin terdaftar"
          icon={Factory}
          tone="slate"
        />
        <OperationalStatCard
          label="Mesin Aktif Disewa"
          value={machinesActive}
          hint="Berjalan di lokasi penyewa"
          icon={PackageCheck}
          tone="brand"
        />
        <OperationalStatCard
          label="Rata-rata Efisiensi"
          value={`${avgEfficiency.toFixed(1)}%`}
          hint={`Reject rate ${rejectRate.toFixed(1)}%`}
          icon={Percent}
          tone={avgEfficiency >= DEFAULT_EFFICIENCY_THRESHOLD ? 'emerald' : 'rose'}
        />
        <OperationalStatCard
          label="Total Reject"
          value={totalReject.toLocaleString('id-ID')}
          hint="Akumulasi 7 hari"
          icon={AlertTriangle}
          tone={totalReject > 0 ? 'rose' : 'slate'}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card title="Produksi Aktual vs Target — 7 Hari Terakhir">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={production} margin={{ left: 8, right: 8 }}>
              <CartesianGrid stroke="#e1e0d9" vertical={false} />
              <XAxis dataKey="dateLabel" stroke="#898781" fontSize={12} />
              <YAxis stroke="#898781" fontSize={12} />
              <Tooltip cursor={{ fill: '#f9f9f7' }} />
              <Bar dataKey="target" name="Target" fill={MUTED_GRAY} radius={[4, 4, 0, 0]} barSize={18} />
              <Bar dataKey="actual" name="Aktual" fill={BLUE} radius={[4, 4, 0, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: MUTED_GRAY }} />
              Target
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: BLUE }} />
              Aktual
            </span>
          </div>
        </Card>

        <Card title="Tren Efisiensi Mesin (%)">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={production} margin={{ left: 8, right: 8 }}>
              <CartesianGrid stroke="#e1e0d9" vertical={false} />
              <XAxis dataKey="dateLabel" stroke="#898781" fontSize={12} />
              <YAxis stroke="#898781" fontSize={12} domain={[0, 100]} unit="%" />
              <Tooltip />
              <Line type="monotone" dataKey="efficiency" name="Efisiensi" stroke={BLUE} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </section>

      <Card
        title="Recent Rental Activities"
        actions={
          <Link to="/rental-cycle" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
            Panel Siklus →
          </Link>
        }
      >
        <DataTable
          columns={[
            { header: 'Mesin', cell: (item: Rental) => item.machineNumber ?? '-' },
            { header: 'Penyewa', cell: (item: Rental) => data.penyewaNames[item.penyewaId] ?? '-' },
            {
              header: 'Periode',
              cell: (item: Rental) =>
                item.startDate && item.endDate
                  ? `${new Date(item.startDate).toLocaleDateString('id-ID')} → ${new Date(item.endDate).toLocaleDateString('id-ID')}`
                  : '-',
            },
            { header: 'Status', cell: (item: Rental) => <RentalStatusBadge status={item.status} /> },
          ]}
          rows={data.rentals.slice(0, 6)}
          rowKey={(item) => item.id}
          emptyMessage="Belum ada aktivitas sewa."
        />
      </Card>
    </>
  )
}

function PenyediaDashboardView() {
  const { data, isLoading } = useDashboardData(api.getPenyediaDashboard)

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Dashboard Penyedia"
        subtitle="Pantau status mesin, utilisasi, indikasi masalah berulang, dan masa warranty."
      />

      {isLoading ? (
        <DashboardSkeleton />
      ) : data ? (
        <>
          <section className="grid gap-6 xl:grid-cols-2">
            <Card title="Status seluruh mesin">
              <StatusBreakdownChart counts={data.machineStatusCounts} />
            </Card>

            <Card title="Utilisasi mesin" subtitle="Hari disewa vs hari nganggur">
              <ResponsiveContainer width="100%" height={Math.max(240, data.machineUtilization.length * 40)}>
                <BarChart data={data.machineUtilization} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid horizontal={false} stroke="#e1e0d9" />
                  <XAxis type="number" stroke="#898781" fontSize={12} />
                  <YAxis type="category" dataKey="machineNumber" stroke="#898781" fontSize={12} width={90} />
                  <Tooltip cursor={{ fill: '#f9f9f7' }} />
                  <Bar dataKey="daysRented" name="Hari disewa" stackId="days" fill={BLUE} barSize={16} />
                  <Bar
                    dataKey="daysIdle"
                    name="Hari nganggur"
                    stackId="days"
                    fill={MUTED_GRAY}
                    radius={[0, 4, 4, 0]}
                    barSize={16}
                  />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 flex gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: BLUE }} />
                  Hari disewa
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: MUTED_GRAY }} />
                  Hari nganggur
                </span>
              </div>
            </Card>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <Card
              title="Mesin indikasi masalah berulang"
              subtitle="Kandidat perlu maintenance atau klaim warranty"
            >
              {data.recurringIssueMachines.length ? (
                <ul className="divide-y divide-slate-100">
                  {data.recurringIssueMachines.map((machine) => (
                    <li key={machine.id} className="flex items-center justify-between gap-3 py-3">
                      <div>
                        <p className="font-medium text-slate-950">{machine.machineNumber}</p>
                        <p className="text-sm text-slate-500">{machine.spesifikasi}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-6 text-sm text-slate-500">Tidak ada mesin dengan indikasi masalah berulang.</p>
              )}
            </Card>

            <Card title="Status warranty">
              <DataTable
                columns={[
                  {
                    header: 'Mesin',
                    cell: (item: PenyediaDashboard['warrantySummary'][number]) => item.machineNumber,
                  },
                  {
                    header: 'Status',
                    cell: (item: PenyediaDashboard['warrantySummary'][number]) => (
                      <WarrantyStatusBadge status={item.warrantyStatus} />
                    ),
                  },
                  {
                    header: 'Berakhir',
                    cell: (item: PenyediaDashboard['warrantySummary'][number]) =>
                      new Date(item.warrantyEnd).toLocaleDateString('id-ID'),
                  },
                ]}
                rows={data.warrantySummary}
                rowKey={(item) => item.machineId}
                emptyMessage="Belum ada data warranty."
              />
            </Card>
          </section>
        </>
      ) : null}
    </div>
  )
}

function PenyewaDashboardView() {
  const { data, isLoading } = useDashboardData(api.getPenyewaDashboard)

  const efficiencyData = data?.efficiencyByBatch
    .slice()
    .sort((first, second) => new Date(first.date).getTime() - new Date(second.date).getTime())
    .map((item) => ({
      ...item,
      dateLabel: new Date(item.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
    }))

  return (
    <div className="space-y-6">
      <DashboardHeader
        title="Dashboard Penyewa"
        subtitle="Pantau sewa berjalan, efisiensi produksi, dan indikasi masalah mesin."
      />

      {isLoading ? (
        <DashboardSkeleton />
      ) : data ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <StatCard label="Sewa aktif" value={data.activeRentals.length} tone="brand" />
            <StatCard
              label="Reject rate"
              value={`${data.rejectRate.toFixed(1)}%`}
              tone={data.rejectRate > 10 ? 'rose' : 'emerald'}
            />
            <StatCard
              label="Batch indikasi masalah mesin"
              value={data.machineIssueBatches.length}
              tone={data.machineIssueBatches.length > 0 ? 'amber' : 'slate'}
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <Card title="Sewa berjalan" subtitle="Sisa durasi sewa per mesin">
              {data.activeRentals.length ? (
                <ul className="divide-y divide-slate-100">
                  {data.activeRentals.map((rental) => (
                    <li key={rental.rentalId} className="flex items-center justify-between gap-3 py-3">
                      <p className="font-medium text-slate-950">{rental.machineNumber}</p>
                      <CountdownTimer target={rental.endDate} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-6 text-sm text-slate-500">Tidak ada sewa yang sedang berjalan.</p>
              )}
            </Card>

            <Card title="Efisiensi per batch" subtitle={`Ambang indikasi masalah: ${DEFAULT_EFFICIENCY_THRESHOLD}%`}>
              {efficiencyData && efficiencyData.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={efficiencyData} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid stroke="#e1e0d9" vertical={false} />
                    <XAxis dataKey="dateLabel" stroke="#898781" fontSize={12} />
                    <YAxis stroke="#898781" fontSize={12} domain={[0, 120]} unit="%" />
                    <Tooltip />
                    <ReferenceLine
                      y={DEFAULT_EFFICIENCY_THRESHOLD}
                      stroke={MUTED_GRAY}
                      strokeDasharray="4 4"
                      label={{ value: 'Ambang', position: 'insideTopRight', fontSize: 11, fill: MUTED_GRAY }}
                    />
                    <Line
                      type="monotone"
                      dataKey="efficiency"
                      name="Efisiensi"
                      stroke={BLUE}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="py-6 text-sm text-slate-500">Belum ada batch produksi.</p>
              )}
            </Card>
          </section>
        </>
      ) : null}
    </div>
  )
}

type OperatorBundle = {
  batches: ProductionBatch[]
  rentals: Rental[]
}

function useOperatorBundle() {
  const { accessToken } = useAuth()
  const toast = useToast()
  const [data, setData] = useState<OperatorBundle | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    Promise.all([api.listBatches(accessToken), api.listRentals(accessToken)])
      .then(([batches, rentals]) => setData({ batches, rentals }))
      .catch((caughtError) => toast.error(errorMessage(caughtError, 'Gagal memuat dashboard.')))
      .finally(() => setIsLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  return { data, isLoading }
}

function OperatorDashboardView({ name }: { name: string }) {
  const { data, isLoading } = useOperatorBundle()

  return (
    <div className="space-y-6">
      <DashboardHeader
        title={`Selamat datang Operator, ${name}`}
        subtitle="Monitoring data produksi untuk rental mesin yang sedang aktif di lokasi Anda."
      />

      {isLoading ? (
        <DashboardSkeleton />
      ) : data ? (
        <OperatorDashboardBody data={data} />
      ) : null}
    </div>
  )
}

function OperatorDashboardBody({ data }: { data: OperatorBundle }) {
  const rentalById = Object.fromEntries(data.rentals.map((rental) => [rental.id, rental]))
  const batches = data.batches
    .slice()
    .sort((first, second) => new Date(second.startAt).getTime() - new Date(first.startAt).getTime())

  const totalBatch = batches.length
  const totalReject = batches.reduce((sum, batch) => sum + batch.rejectCount, 0)
  const avgEfficiency = batches.length
    ? batches.reduce((sum, batch) => sum + batch.efficiency, 0) / batches.length
    : 0
  const pendingReview = batches.filter((batch) => batch.reviewStatus === ReviewStatus.PENDING).length
  const flaggedIssue = batches.filter((batch) => batch.flaggedMachineIssue).length

  const chartData = batches
    .slice()
    .sort((first, second) => new Date(first.startAt).getTime() - new Date(second.startAt).getTime())
    .slice(-10)
    .map((batch) => ({
      dateLabel: new Date(batch.startAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
      target: batch.targetOutput,
      actual: batch.actualOutput,
    }))

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OperationalStatCard
          label="Total Batch"
          value={totalBatch}
          hint="Seluruh riwayat input Anda"
          icon={ClipboardList}
          tone="slate"
        />
        <OperationalStatCard
          label="Rata-rata Efisiensi"
          value={`${avgEfficiency.toFixed(1)}%`}
          hint={`Ambang ${DEFAULT_EFFICIENCY_THRESHOLD}%`}
          icon={Percent}
          tone={avgEfficiency >= DEFAULT_EFFICIENCY_THRESHOLD ? 'emerald' : 'rose'}
        />
        <OperationalStatCard
          label="Total Reject"
          value={totalReject.toLocaleString('id-ID')}
          hint="Akumulasi seluruh batch"
          icon={AlertTriangle}
          tone={totalReject > 0 ? 'rose' : 'slate'}
        />
        <OperationalStatCard
          label="Menunggu Review"
          value={pendingReview}
          hint={flaggedIssue > 0 ? `${flaggedIssue} indikasi masalah mesin` : 'Tidak ada indikasi masalah'}
          icon={Clock}
          tone={pendingReview > 0 ? 'brand' : 'slate'}
        />
      </section>

      <Card title="Aktual vs Target —> 10 Batch Terakhir">
        {chartData.length ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ left: 8, right: 8 }}>
              <CartesianGrid stroke="#e1e0d9" vertical={false} />
              <XAxis dataKey="dateLabel" stroke="#898781" fontSize={12} />
              <YAxis stroke="#898781" fontSize={12} />
              <Tooltip cursor={{ fill: '#f9f9f7' }} />
              <Bar dataKey="target" name="Target" fill={MUTED_GRAY} radius={[4, 4, 0, 0]} barSize={18} />
              <Bar dataKey="actual" name="Aktual" fill={BLUE} radius={[4, 4, 0, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-6 text-sm text-slate-500">Belum ada batch produksi.</p>
        )}
      </Card>

      <Card
        title="Riwayat Batch Terbaru"
        actions={
          <Link to="/production" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
            Input Produksi →
          </Link>
        }
      >
        <DataTable
          columns={[
            {
              header: 'Tanggal',
              cell: (item: ProductionBatch) => new Date(item.startAt).toLocaleDateString('id-ID'),
            },
            {
              header: 'Mesin',
              cell: (item: ProductionBatch) => rentalById[item.rentalId]?.machineNumber ?? '-',
            },
            {
              header: 'Target',
              cell: (item: ProductionBatch) => item.targetOutput.toLocaleString('id-ID'),
            },
            {
              header: 'Aktual',
              cell: (item: ProductionBatch) => item.actualOutput.toLocaleString('id-ID'),
            },
            {
              header: 'Efisiensi',
              cell: (item: ProductionBatch) => `${item.efficiency.toFixed(1)}%`,
            },
            {
              header: 'Status',
              cell: (item: ProductionBatch) => <ReviewStatusBadge status={item.reviewStatus} />,
            },
          ]}
          rows={batches.slice(0, 8)}
          rowKey={(item) => item.id}
          emptyMessage="Belum ada batch produksi."
        />
      </Card>
    </>
  )
}
