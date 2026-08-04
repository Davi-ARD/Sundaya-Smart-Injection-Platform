import { useCallback, useEffect, useMemo, useState } from 'react'
import { Info, Truck } from 'lucide-react'
import { DeliveryStatus, type DeliveryRow } from '@mold-tracker/shared'
import { useAuth } from '../auth/authContextValue'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/PageHeader'
import { Card, StatCard } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { DeliveryStatusBadge } from '../../components/ui/Badge'
import { TableSkeleton } from '../../components/ui/Skeleton'
import { useToast } from '../../components/ui/Toast'
import { errorMessage } from '../../lib/errorMessage'
import { formatDate } from '../../lib/format'

// Selisih hari: negatif berarti lebih awal dari rencana.
const formatSelisih = (days: number | null) => {
  if (days == null) return <span className="text-slate-400">-</span>
  if (days > 0) return <span className="font-semibold text-amber-700">+{days} hari</span>
  if (days < 0) return <span className="font-semibold text-emerald-700">{days} hari</span>
  return <span className="font-semibold text-emerald-700">Tepat waktu</span>
}

const ARRIVED = [DeliveryStatus.TIBA_ONTIME, DeliveryStatus.TIBA_TERLAMBAT]

// Log Pengiriman: tampilan turunan read-only. Rencana berasal dari Booking dan
// Cetakan, aktual dari Log Produksi dan Mold Tracking. Tidak ada input di sini.
export function PengirimanPage() {
  const { accessToken } = useAuth()
  const toast = useToast()

  const [rows, setRows] = useState<DeliveryRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      setRows(await api.listPengiriman(accessToken))
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal memuat log pengiriman'))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, toast])

  useEffect(() => {
    void load()
  }, [load])

  // Ringkasan dihitung dari baris yang sudah dimuat, bukan endpoint terpisah.
  const summary = useMemo(() => {
    const arrived = rows.filter((row) => ARRIVED.includes(row.status))
    const onTime = arrived.filter((row) => row.status === DeliveryStatus.TIBA_ONTIME)
    const overdue = rows.filter((row) => row.status === DeliveryStatus.BELUM_TIBA)
    const lateDays = arrived
      .filter((row) => (row.selisihHari ?? 0) > 0)
      .map((row) => row.selisihHari as number)
    return {
      onTimeRate: arrived.length ? Math.round((onTime.length / arrived.length) * 100) : 100,
      arrivedCount: arrived.length,
      overdueCount: overdue.length,
      avgLate: lateDays.length
        ? Math.round((lateDays.reduce((a, b) => a + b, 0) / lateDays.length) * 10) / 10
        : 0,
    }
  }, [rows])

  const columns: Column<DeliveryRow>[] = [
    { header: 'Item', cell: (r) => <span className="font-semibold text-slate-900">{r.item}</span> },
    { header: 'Sumber rencana', cell: (r) => r.sumberRencana },
    { header: 'Rencana tiba', cell: (r) => formatDate(r.rencanaTiba) },
    { header: 'Aktual tiba', cell: (r) => formatDate(r.aktualTiba) },
    { header: 'Selisih', cell: (r) => formatSelisih(r.selisihHari) },
    { header: 'Status', cell: (r) => <DeliveryStatusBadge status={r.status} /> },
  ]

  return (
    <div className="mx-auto max-w-screen-2xl">
      <PageHeader
        breadcrumb={[{ label: 'Beranda', to: '/manager' }, { label: 'Log Pengiriman' }]}
        title="Log Pengiriman"
        description="Perbandingan rencana kirim dan aktual kedatangan mold serta material di Sundaya."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Ketepatan kedatangan"
          value={`${summary.onTimeRate}%`}
          hint={`${summary.arrivedCount} item sudah tiba`}
          tone={summary.onTimeRate >= 80 ? 'emerald' : 'amber'}
        />
        <StatCard label="Item sudah tiba" value={summary.arrivedCount} tone="brand" />
        <StatCard
          label="Belum tiba (overdue)"
          value={summary.overdueCount}
          hint="Melewati tanggal rencana"
          tone={summary.overdueCount > 0 ? 'rose' : 'slate'}
        />
        <StatCard
          label="Rata-rata keterlambatan"
          value={summary.avgLate ? `${summary.avgLate} hari` : '-'}
          tone={summary.avgLate ? 'amber' : 'slate'}
        />
      </div>

      <Card className="mt-5">
        {isLoading ? (
          <TableSkeleton rows={5} columns={6} />
        ) : rows.length === 0 ? (
          <div className="grid place-items-center py-14 text-center">
            <span className="grid h-12 w-12 place-items-center text-brand-700">
              <Truck className="h-7 w-7" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-800">Belum ada rencana pengiriman</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Baris muncul otomatis setelah Anda mengisi rencana kirim mold dan plan material pada
              form Booking.
            </p>
          </div>
        ) : (
          <DataTable columns={columns} rows={rows} rowKey={(r) => `${r.jobId}-${r.item}`} />
        )}
      </Card>

      <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        Halaman ini hanya menampilkan hasil hitung sistem. Rencana diubah lewat Booking dan Cetakan;
        aktual kedatangan berasal dari Log Produksi dan status tracking mold.
      </p>
    </div>
  )
}
