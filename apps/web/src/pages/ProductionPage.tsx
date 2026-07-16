import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import {
  CauseCategory,
  RentalStatus,
  ReviewStatus,
  Role,
  type CreateBatchRequest,
  type ProductionBatch,
  type Rental,
} from '@mold-tracker/shared'
import { useAuth } from '../features/auth/authContextValue'
import { api } from '../lib/api'
import { useToast } from '../components/ui/Toast'
import { Badge, ReviewStatusBadge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { DataTable, type Column } from '../components/ui/DataTable'
import { FieldGroup, SelectField, TextField } from '../components/ui/FormField'
import { Modal } from '../components/ui/Modal'
import { TableSkeleton } from '../components/ui/Skeleton'

const errorMessage = (caughtError: unknown, fallback: string) =>
  caughtError instanceof Error ? caughtError.message : fallback

const causeCategoryLabel: Record<CauseCategory, string> = {
  [CauseCategory.SETTING_OPERATOR]: 'Setting Operator',
  [CauseCategory.KUALITAS_MATERIAL]: 'Kualitas Material',
  [CauseCategory.KONDISI_MESIN]: 'Kondisi Mesin/Mold',
  [CauseCategory.LAIN]: 'Faktor Lain',
}

const causeCategoryOptions = [
  { value: '' as CauseCategory | '', label: 'Tidak ada penyebab khusus' },
  ...Object.values(CauseCategory).map((value) => ({ value, label: causeCategoryLabel[value] })),
]

const rejectRate = (batch: ProductionBatch) => {
  const produced = batch.actualOutput + batch.rejectCount
  return produced > 0 ? (batch.rejectCount / produced) * 100 : 0
}

const batchLabel = (id: string) => `B-${id.slice(-6).toUpperCase()}`

const PAGE_SIZE = 10

const emptyForm = {
  rentalId: '',
  startAt: '',
  endAt: '',
  materialInputKg: 0,
  targetOutput: '',
  actualOutput: 0,
  rejectCount: 0,
  causeCategory: '' as CauseCategory | '',
}

export function ProductionPage() {
  const { accessToken, user } = useAuth()
  const toast = useToast()
  const canCreate = user?.role === Role.OPERATOR
  const canReview = user?.role === Role.ADMIN
  const [searchParams] = useSearchParams()

  const [batches, setBatches] = useState<ProductionBatch[]>([])
  const [rentals, setRentals] = useState<Rental[]>([])
  const [operatorNames, setOperatorNames] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') ?? '')
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const [page, setPage] = useState(1)

  const loadData = useCallback(async () => {
    try {
      const [batchList, rentalList] = await Promise.all([api.listBatches(accessToken), api.listRentals(accessToken)])
      setBatches(batchList)
      setRentals(rentalList)

      if (user?.role === Role.ADMIN) {
        const users = await api.listUsers(accessToken, { role: Role.OPERATOR })
        setOperatorNames(Object.fromEntries(users.map((item) => [item.id, item.nama])))
      } else if (user?.role === Role.PENYEWA) {
        const operators = await api.listOperators(accessToken)
        setOperatorNames(Object.fromEntries(operators.map((item) => [item.id, item.nama])))
      } else if (user?.role === Role.OPERATOR) {
        setOperatorNames({ [user.id]: user.nama })
      }
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Gagal memuat data produksi.'))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, toast, user])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const rentalById = useMemo(() => Object.fromEntries(rentals.map((rental) => [rental.id, rental])), [rentals])
  const activeRentals = useMemo(() => rentals.filter((rental) => rental.status === RentalStatus.AKTIF), [rentals])

  const machineLabel = (batch: ProductionBatch) => rentalById[batch.rentalId]?.machineNumber ?? '-'
  const operatorLabel = (batch: ProductionBatch) =>
    operatorNames[batch.operatorId] ?? `Operator #${batch.operatorId.slice(-6)}`

  const filteredBatches = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return batches.filter((batch) => {
      if (flaggedOnly && !batch.flaggedMachineIssue) {
        return false
      }
      if (!term) {
        return true
      }
      const machine = rentalById[batch.rentalId]?.machineNumber ?? ''
      const operator = operatorNames[batch.operatorId] ?? ''
      const haystack = `${batchLabel(batch.id)} ${machine} ${operator}`.toLowerCase()
      return haystack.includes(term)
    })
  }, [batches, searchTerm, flaggedOnly, rentalById, operatorNames])

  useEffect(() => {
    setPage(1)
  }, [searchTerm, flaggedOnly])

  const pageCount = Math.max(1, Math.ceil(filteredBatches.length / PAGE_SIZE))
  const pagedBatches = filteredBatches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const payload: CreateBatchRequest = {
        rentalId: form.rentalId,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        materialInputKg: form.materialInputKg,
        targetOutput: form.targetOutput === '' ? undefined : Number(form.targetOutput),
        actualOutput: form.actualOutput,
        rejectCount: form.rejectCount,
        causeCategory: form.causeCategory === '' ? undefined : form.causeCategory,
      }
      const created = await api.createBatch(accessToken, payload)
      setForm(emptyForm)
      setIsCreateOpen(false)
      await loadData()
      toast.success(`Batch tersimpan. Efisiensi: ${created.efficiency.toFixed(1)}%.`)
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Batch tidak dapat disimpan.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const reviewBatch = async (batch: ProductionBatch, decision: ReviewStatus.APPROVED | ReviewStatus.REJECTED) => {
    setReviewingId(batch.id)
    try {
      await api.reviewBatch(accessToken, batch.id, { reviewStatus: decision })
      await loadData()
      toast.success(
        decision === ReviewStatus.APPROVED
          ? `Batch ${batchLabel(batch.id)} disetujui, masuk laporan resmi.`
          : `Batch ${batchLabel(batch.id)} ditolak.`,
      )
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Keputusan review gagal diproses.'))
    } finally {
      setReviewingId(null)
    }
  }

  const previewEfficiency =
    form.targetOutput !== '' && Number(form.targetOutput) > 0
      ? ((form.actualOutput / Number(form.targetOutput)) * 100).toFixed(1)
      : null
  const showCauseHint = form.targetOutput !== '' && Number(form.actualOutput) < Number(form.targetOutput)

  const columns: Column<ProductionBatch>[] = [
    { header: 'Batch', cell: (item) => <span className="font-medium text-slate-950">{batchLabel(item.id)}</span> },
    { header: 'Waktu', cell: (item) => new Date(item.startAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) },
    { header: 'Mesin', cell: (item) => machineLabel(item) },
    { header: 'Operator', cell: (item) => operatorLabel(item) },
    { header: 'Material (kg)', cell: (item) => item.materialInputKg.toLocaleString('id-ID') },
    { header: 'Target', cell: (item) => item.targetOutput.toLocaleString('id-ID') },
    { header: 'Aktual', cell: (item) => item.actualOutput.toLocaleString('id-ID') },
    {
      header: 'Reject %',
      cell: (item) => <span className="text-rose-600">{rejectRate(item).toFixed(1)}%</span>,
    },
    {
      header: 'Efisiensi',
      cell: (item) => (
        <span className={item.efficiency >= 85 ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}>
          {item.efficiency.toFixed(1)}%
        </span>
      ),
    },
    { header: 'Penyebab', cell: (item) => (item.causeCategory ? causeCategoryLabel[item.causeCategory] : '-') },
    {
      header: 'Flag',
      cell: (item) => (item.flaggedMachineIssue ? <Badge tone="rose">Mesin</Badge> : <span className="text-slate-400">-</span>),
    },
    { header: 'Status', cell: (item) => <ReviewStatusBadge status={item.reviewStatus} /> },
    ...(canReview
      ? [
          {
            header: 'Aksi',
            cell: (item: ProductionBatch) =>
              item.reviewStatus === ReviewStatus.PENDING ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    type="button"
                    disabled={reviewingId === item.id}
                    onClick={() => reviewBatch(item, ReviewStatus.APPROVED)}
                  >
                    Setujui
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    type="button"
                    disabled={reviewingId === item.id}
                    onClick={() => reviewBatch(item, ReviewStatus.REJECTED)}
                  >
                    Tolak
                  </Button>
                </div>
              ) : (
                <span className="text-slate-400">-</span>
              ),
          } satisfies Column<ProductionBatch>,
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Production · Batches</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">Batch Produksi</h1>
          <p className="mt-2 text-sm text-slate-600">
            Rekap input material and output aktual.
          </p>
        </div>
        {canCreate ? (
          <Button type="button" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Input Batch Baru
          </Button>
        ) : null}
      </section>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Cari batch, mesin, atau operator..."
            className="w-full flex-1 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm outline-none transition-all duration-150 placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100 sm:max-w-xs"
          />
          <label className="flex shrink-0 items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={flaggedOnly}
              onChange={(event) => setFlaggedOnly(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Hanya yang di-flag
          </label>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <TableSkeleton rows={5} columns={8} />
          ) : (
            <>
              <DataTable
                columns={columns}
                rows={pagedBatches}
                rowKey={(item) => item.id}
                emptyMessage="Tidak ada batch yang cocok dengan pencarian."
              />
              {filteredBatches.length > PAGE_SIZE ? (
                <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                  <span>
                    Halaman {page} dari {pageCount} &middot; {filteredBatches.length} batch
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                    >
                      Sebelumnya
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      disabled={page >= pageCount}
                      onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                    >
                      Berikutnya
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </Card>

      {isCreateOpen ? (
        <Modal title="Input batch produksi" onClose={() => setIsCreateOpen(false)}>
          <form onSubmit={submitCreate} className="space-y-4">
            <SelectField
              label="Rental aktif"
              value={form.rentalId}
              onChange={(value) => setForm((current) => ({ ...current, rentalId: value }))}
              options={[
                { value: '', label: 'Pilih rental...' },
                ...activeRentals.map((rental) => ({
                  value: rental.id,
                  label: `${rental.machineNumber ?? rental.machineId} — ${rental.destinationLocation}`,
                })),
              ]}
            />
            <FieldGroup>
              <TextField
                label="Waktu mulai"
                type="datetime-local"
                value={form.startAt}
                onChange={(value) => setForm((current) => ({ ...current, startAt: value }))}
              />
              <TextField
                label="Waktu selesai"
                type="datetime-local"
                value={form.endAt}
                onChange={(value) => setForm((current) => ({ ...current, endAt: value }))}
              />
              <TextField
                label="Material input (kg)"
                type="number"
                min="0"
                value={form.materialInputKg}
                onChange={(value) => setForm((current) => ({ ...current, materialInputKg: Number(value) }))}
              />
              <TextField
                label="Target output (opsional)"
                type="number"
                min="0"
                required={false}
                value={form.targetOutput}
                onChange={(value) => setForm((current) => ({ ...current, targetOutput: value }))}
              />
              <TextField
                label="Output aktual"
                type="number"
                min="0"
                value={form.actualOutput}
                onChange={(value) => setForm((current) => ({ ...current, actualOutput: Number(value) }))}
              />
              <TextField
                label="Jumlah reject"
                type="number"
                min="0"
                value={form.rejectCount}
                onChange={(value) => setForm((current) => ({ ...current, rejectCount: Number(value) }))}
              />
            </FieldGroup>

            {previewEfficiency ? (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Perkiraan efisiensi: <span className="font-semibold text-slate-800">{previewEfficiency}%</span> (nilai
                final dihitung server setelah disimpan)
              </p>
            ) : null}

            <SelectField
              label="Kategori penyebab selisih"
              value={form.causeCategory}
              onChange={(value) => setForm((current) => ({ ...current, causeCategory: value }))}
              required={false}
              options={causeCategoryOptions}
            />
            {showCauseHint ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Output di bawah target — isi kategori penyebab sejujurnya. Data ini jadi dasar evaluasi performa
                operator vs kondisi mesin, jadi akurasinya penting untuk semua pihak.
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setIsCreateOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Menyimpan...' : 'Simpan batch'}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  )
}
