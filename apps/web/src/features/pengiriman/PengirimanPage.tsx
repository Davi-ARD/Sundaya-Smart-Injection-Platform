import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Boxes, Info, PackagePlus, Plus } from 'lucide-react'
import {
  ItemPengiriman,
  type CreateLogPengirimanRequest,
  type Job,
  type LogPengiriman,
} from '@mold-tracker/shared'
import { useAuth } from '../auth/authContextValue'
import { api } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/PageHeader'
import { Card } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { SidePanel } from '../../components/ui/SidePanel'
import { TableSkeleton } from '../../components/ui/Skeleton'
import { FieldGroup, SelectField, TextAreaField, TextField } from '../../components/ui/FormField'
import { useToast } from '../../components/ui/Toast'
import { errorMessage } from '../../lib/errorMessage'
import { useMoldPicker } from '../../lib/useMoldPicker'
import { optionalText } from '../../lib/form'
import { formatDate, formatDateTime, todayInput } from '../../lib/format'

// Log Pengiriman (Manager Penyewa): catatan kapan mold dan material akan dikirim
// ke Sundaya. Mold dan material dipisah jadi dua daftar dalam satu tab. Mencatat
// pengiriman mold otomatis memindahkan status tracking mold ke Delivery, dan
// Admin Sundaya langsung menerima notifikasinya.
export function PengirimanPage() {
  const { accessToken } = useAuth()
  const toast = useToast()

  const [logs, setLogs] = useState<LogPengiriman[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [panelItem, setPanelItem] = useState<ItemPengiriman | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [logList, jobList] = await Promise.all([
        api.listPengiriman(accessToken),
        api.listJobs(accessToken),
      ])
      setLogs(logList)
      setJobs(jobList)
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal memuat log pengiriman'))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, toast])

  useEffect(() => {
    void load()
  }, [load])

  const moldLogs = useMemo(() => logs.filter((l) => l.item === ItemPengiriman.MOLD), [logs])
  const materialLogs = useMemo(
    () => logs.filter((l) => l.item === ItemPengiriman.MATERIAL),
    [logs],
  )

  const jobColumn: Column<LogPengiriman> = {
    header: 'Job',
    cell: (l) => <span className="font-semibold text-slate-900">{l.jobNumber ?? '-'}</span>,
  }
  const rencanaColumn: Column<LogPengiriman> = {
    header: 'Rencana kirim',
    cell: (l) => formatDate(l.rencanaKirim),
  }
  const catatanColumn: Column<LogPengiriman> = {
    header: 'Catatan',
    cell: (l) => l.catatan ?? <span className="text-slate-400">-</span>,
  }
  const dicatatColumn: Column<LogPengiriman> = {
    header: 'Dicatat',
    cell: (l) => <span className="text-xs text-slate-400">{formatDateTime(l.createdAt)}</span>,
  }

  const moldColumns: Column<LogPengiriman>[] = [
    jobColumn,
    { header: 'Cetakan', cell: (l) => l.kodeMold ?? <span className="text-slate-400">-</span> },
    rencanaColumn,
    catatanColumn,
    dicatatColumn,
  ]

  const materialColumns: Column<LogPengiriman>[] = [
    jobColumn,
    { header: 'Material', cell: (l) => l.materialName ?? '-' },
    { header: 'Jumlah', cell: (l) => (l.jumlahKg != null ? `${l.jumlahKg} kg` : '-') },
    {
      header: 'No. surat jalan',
      cell: (l) => l.noSuratJalan ?? <span className="text-slate-400">-</span>,
    },
    rencanaColumn,
    dicatatColumn,
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumb={[{ label: 'Beranda', to: '/manager' }, { label: 'Log Pengiriman' }]}
        title="Log Pengiriman"
        description="Catat kapan cetakan dan material akan dikirim ke Sundaya. Admin Sundaya langsung diberi tahu setiap ada rencana pengiriman baru."
      />

      <Card
        title="Pengiriman cetakan"
        subtitle="Mencatat pengiriman cetakan memindahkan status tracking-nya ke Delivery."
        actions={
          <Button
            size="sm"
            onClick={() => setPanelItem(ItemPengiriman.MOLD)}
            disabled={jobs.length === 0}
          >
            <Plus className="h-3.5 w-3.5" /> Catat cetakan
          </Button>
        }
      >
        {isLoading ? (
          <TableSkeleton rows={3} columns={4} />
        ) : moldLogs.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="Belum ada rencana pengiriman cetakan"
            message={
              jobs.length === 0
                ? 'Ajukan booking terlebih dahulu sebelum mencatat pengiriman.'
                : 'Catat rencana pengiriman cetakan agar Sundaya bisa bersiap menerimanya.'
            }
          />
        ) : (
          <DataTable columns={moldColumns} rows={moldLogs} rowKey={(l) => l.id} />
        )}
      </Card>

      <Card
        className="mt-5"
        title="Pengiriman material"
        subtitle="Material dicatat terpisah beserta jumlah dan nomor surat jalan."
        actions={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setPanelItem(ItemPengiriman.MATERIAL)}
            disabled={jobs.length === 0}
          >
            <Plus className="h-3.5 w-3.5" /> Catat material
          </Button>
        }
      >
        {isLoading ? (
          <TableSkeleton rows={3} columns={5} />
        ) : materialLogs.length === 0 ? (
          <EmptyState
            icon={PackagePlus}
            title="Belum ada rencana pengiriman material"
            message="Catat material yang akan dikirim beserta perkiraan jumlahnya."
          />
        ) : (
          <DataTable columns={materialColumns} rows={materialLogs} rowKey={(l) => l.id} />
        )}
      </Card>

      <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Halaman ini murni catatan rencana pengiriman. Konfirmasi barang benar-benar tiba dicatat
        Admin Sundaya di Log Penerimaan, dan Anda akan menerima notifikasinya.
      </p>

      {panelItem ? (
        <PengirimanFormPanel
          item={panelItem}
          jobs={jobs}
          onClose={() => setPanelItem(null)}
          onSaved={() => {
            setPanelItem(null)
            void load()
          }}
        />
      ) : null}
    </div>
  )
}

function PengirimanFormPanel({
  item,
  jobs,
  onClose,
  onSaved,
}: {
  item: ItemPengiriman
  jobs: Job[]
  onClose: () => void
  onSaved: () => void
}) {
  const { accessToken } = useAuth()
  const toast = useToast()
  const isMold = item === ItemPengiriman.MOLD

  const { jobId, moldId, setMoldId, pilihJob, jobOptions, moldOptions } = useMoldPicker(jobs)
  const [rencanaKirim, setRencanaKirim] = useState(todayInput())
  const [materialName, setMaterialName] = useState('')
  const [jumlahKg, setJumlahKg] = useState('')
  const [noSuratJalan, setNoSuratJalan] = useState('')
  const [catatan, setCatatan] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      const base = {
        jobId,
        item,
        moldId: isMold ? moldId : undefined,
        rencanaKirim: new Date(rencanaKirim).toISOString(),
        catatan: optionalText(catatan),
      }
      const body: CreateLogPengirimanRequest = isMold
        ? base
        : {
            ...base,
            materialName: materialName.trim(),
            jumlahKg: Number(jumlahKg),
            noSuratJalan: optionalText(noSuratJalan),
          }
      await api.createPengiriman(accessToken, body)
      toast.success(isMold ? 'Rencana pengiriman cetakan dicatat' : 'Rencana pengiriman material dicatat')
      onSaved()
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal mencatat pengiriman'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SidePanel
      title={isMold ? 'Catat pengiriman cetakan' : 'Catat pengiriman material'}
      subtitle={
        isMold
          ? 'Status tracking cetakan otomatis menjadi Delivery.'
          : 'Material dicatat terpisah dari cetakan.'
      }
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <SelectField label="Job" value={jobId} onChange={pilihJob} options={jobOptions} />
        {isMold ? (
          <SelectField
            label="Cetakan"
            value={moldId}
            onChange={setMoldId}
            options={moldOptions}
          />
        ) : null}
        <TextField
          label="Rencana kirim"
          type="date"
          value={rencanaKirim}
          onChange={setRencanaKirim}
        />

        {!isMold ? (
          <>
            <TextField label="Nama material" value={materialName} onChange={setMaterialName} />
            <FieldGroup>
              <TextField
                label="Jumlah (kg)"
                type="number"
                min={0}
                step="0.1"
                value={jumlahKg}
                onChange={setJumlahKg}
              />
              <TextField
                label="No. surat jalan"
                required={false}
                value={noSuratJalan}
                onChange={setNoSuratJalan}
              />
            </FieldGroup>
          </>
        ) : null}

        <TextAreaField label="Catatan" value={catatan} onChange={setCatatan} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={isSaving || !jobId || (isMold && !moldId)}>
            {isSaving ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </div>
      </form>
    </SidePanel>
  )
}
