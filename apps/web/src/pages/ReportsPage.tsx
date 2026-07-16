import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileDown } from 'lucide-react'
import { CauseCategory, Role, type ProductionBatch, type Rental } from '@mold-tracker/shared'
import { useAuth } from '../features/auth/authContextValue'
import { api } from '../lib/api'
import { useToast } from '../components/ui/Toast'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { DataTable, type Column } from '../components/ui/DataTable'
import { TableSkeleton } from '../components/ui/Skeleton'
import { ReviewStatusBadge } from '../components/ui/Badge'

const errorMessage = (caughtError: unknown, fallback: string) =>
  caughtError instanceof Error ? caughtError.message : fallback

const causeCategoryLabel: Record<CauseCategory, string> = {
  [CauseCategory.SETTING_OPERATOR]: 'Setting Operator',
  [CauseCategory.KUALITAS_MATERIAL]: 'Kualitas Material',
  [CauseCategory.KONDISI_MESIN]: 'Kondisi Mesin/Mold',
  [CauseCategory.LAIN]: 'Faktor Lain',
}

// Membuat file yang di-fetch sebagai Blob langsung terunduh di browser
// (dibutuhkan karena endpoint export butuh header Authorization, bukan <a href> polos).
const triggerBlobDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function ReportsPage() {
  const { accessToken, user } = useAuth()
  const toast = useToast()

  const [batches, setBatches] = useState<ProductionBatch[]>([])
  const [rentals, setRentals] = useState<Rental[]>([])
  const [operatorNames, setOperatorNames] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [isExporting, setIsExporting] = useState<'csv' | 'pdf' | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [batchList, rentalList] = await Promise.all([
        api.getMachineIssueReports(accessToken),
        api.listRentals(accessToken),
      ])
      setBatches(batchList)
      setRentals(rentalList)

      if (user?.role === Role.ADMIN) {
        const users = await api.listUsers(accessToken, { role: Role.OPERATOR })
        setOperatorNames(Object.fromEntries(users.map((item) => [item.id, item.nama])))
      } else if (user?.role === Role.PENYEWA) {
        const operators = await api.listOperators(accessToken)
        setOperatorNames(Object.fromEntries(operators.map((item) => [item.id, item.nama])))
      }
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Gagal memuat laporan.'))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, toast, user])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const rentalById = useMemo(() => Object.fromEntries(rentals.map((rental) => [rental.id, rental])), [rentals])
  const machineLabel = (batch: ProductionBatch) => rentalById[batch.rentalId]?.machineNumber ?? '-'
  const operatorLabel = (batch: ProductionBatch) => operatorNames[batch.operatorId] ?? `Operator #${batch.operatorId.slice(-6)}`

  const filteredBatches = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return batches
    return batches.filter((batch) => {
      const machine = rentalById[batch.rentalId]?.machineNumber ?? ''
      const operator = operatorNames[batch.operatorId] ?? ''
      return `${machine} ${operator}`.toLowerCase().includes(term)
    })
  }, [batches, searchTerm, rentalById, operatorNames])

  const runExport = async (format: 'csv' | 'pdf') => {
    setIsExporting(format)
    try {
      const blob = await api.downloadMachineIssueReport(accessToken, { format })
      triggerBlobDownload(blob, `laporan-masalah-mesin.${format}`)
      toast.success(`Laporan ${format.toUpperCase()} berhasil diunduh.`)
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Laporan tidak dapat diunduh.'))
    } finally {
      setIsExporting(null)
    }
  }

  const columns: Column<ProductionBatch>[] = [
    { header: 'Tanggal', cell: (item) => new Date(item.startAt).toLocaleDateString('id-ID') },
    { header: 'Mesin', cell: (item) => machineLabel(item) },
    { header: 'Operator', cell: (item) => operatorLabel(item) },
    { header: 'Efisiensi', cell: (item) => `${item.efficiency.toFixed(1)}%` },
    { header: 'Reject', cell: (item) => item.rejectCount.toLocaleString('id-ID') },
    {
      header: 'Penyebab',
      cell: (item) => (item.causeCategory ? causeCategoryLabel[item.causeCategory] : '-'),
    },
    { header: 'Status', cell: (item) => <ReviewStatusBadge status={item.reviewStatus} /> },
  ]

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Laporan</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">
            Laporan Masalah Mesin
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Data pendukung klaim garansi: rekap batch produksi yang sudah disetujui dan ditandai berindikasi
            masalah mesin. Proses klaim garansi ke penyedia/pabrikan dilakukan di luar sistem — unduh laporan
            ini sebagai bukti pendukung.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" type="button" onClick={() => runExport('csv')} disabled={isExporting !== null}>
            <FileDown className="h-4 w-4" />
            {isExporting === 'csv' ? 'Mengunduh...' : 'Export CSV'}
          </Button>
          <Button type="button" onClick={() => runExport('pdf')} disabled={isExporting !== null}>
            <FileDown className="h-4 w-4" />
            {isExporting === 'pdf' ? 'Mengunduh...' : 'Export PDF'}
          </Button>
        </div>
      </section>

      <Card>
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Cari mesin atau operator..."
          className="w-full max-w-sm rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm outline-none transition-all duration-150 placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
        />

        <div className="mt-4">
          {isLoading ? (
            <TableSkeleton rows={4} columns={7} />
          ) : (
            <DataTable
              columns={columns}
              rows={filteredBatches}
              rowKey={(item) => item.id}
              emptyMessage="Belum ada batch berindikasi masalah mesin."
            />
          )}
        </div>
      </Card>
    </div>
  )
}
