import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Boxes, Info, PackageCheck, Plus } from 'lucide-react'
import {
  MaterialType,
  ItemPengiriman,
  Role,
  type CreateLogPenerimaanRequest,
  type Job,
  type LogPenerimaan,
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
import { formatDate, formatDateTime, nowLocalInput } from '../../lib/format'


// Log Aktivitas (Admin Sundaya): catatan cetakan dan material tiba di lokasi
// Sundaya, dipisah jadi dua daftar dalam satu tab. Ini satu-satunya tempat
// kedatangan barang dicatat; Log Produksi tidak lagi punya event material datang.
//
// Mencatat penerimaan cetakan memindahkan tracking mold ke Received sekaligus
// menjalankan booking-nya (masa sewa mulai dihitung), dan Manager pemilik job
// langsung menerima notifikasinya.
export function PenerimaanPage() {
  const { accessToken, user } = useAuth()
  const toast = useToast()
  const canWrite = user?.role === Role.ADMIN_SUNDAYA

  const [logs, setLogs] = useState<LogPenerimaan[]>([])
  const [rencana, setRencana] = useState<LogPengiriman[]>([])
  const [jobs, setJobs] = useState<Job[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [panelItem, setPanelItem] = useState<ItemPengiriman | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [logList, rencanaList, jobList] = await Promise.all([
        api.listPenerimaan(accessToken),
        api.listPengiriman(accessToken),
        api.listJobs(accessToken),
      ])
      setLogs(logList)
      setRencana(rencanaList)
      setJobs(jobList)
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal memuat log penerimaan'))
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

  const jobColumn: Column<LogPenerimaan> = {
    header: 'Job',
    cell: (l) => <span className="font-semibold text-slate-900">{l.jobNumber ?? '-'}</span>,
  }
  const diterimaColumn: Column<LogPenerimaan> = {
    header: 'Diterima',
    cell: (l) => formatDateTime(l.diterimaAt),
  }
  const kondisiColumn: Column<LogPenerimaan> = {
    header: 'Kondisi',
    cell: (l) => l.kondisi ?? <span className="text-slate-400">-</span>,
  }

  const moldColumns: Column<LogPenerimaan>[] = [
    jobColumn,
    { header: 'Cetakan', cell: (l) => l.kodeMold ?? <span className="text-slate-400">-</span> },
    diterimaColumn,
    kondisiColumn,
    { header: 'Catatan', cell: (l) => l.catatan ?? <span className="text-slate-400">-</span> },
  ]

  const materialColumns: Column<LogPenerimaan>[] = [
    jobColumn,
    { header: 'Material', cell: (l) => l.materialName ?? '-' },
    { header: 'Jumlah', cell: (l) => (l.jumlahKg != null ? `${l.jumlahKg} kg` : '-') },
    {
      header: 'No. surat jalan',
      cell: (l) => l.noSuratJalan ?? <span className="text-slate-400">-</span>,
    },
    diterimaColumn,
    kondisiColumn,
  ]

  // Kolom rencana dibuat sepadan dengan tabel Log Pengiriman milik Manager: tiap
  // field yang Manager isi ikut terbaca di sini. Sebelumnya Catatan dan nomor surat
  // jalan hilang, padahal justru itu yang dipakai mencocokkan barang saat tiba.
  // Daftarnya sengaja tetap digabung (cetakan + material) karena fungsinya sekali
  // lihat: apa saja yang sedang menuju ke sini.
  const rencanaColumns: Column<LogPengiriman>[] = [
    { header: 'Job', cell: (l) => <span className="font-semibold text-slate-900">{l.jobNumber ?? '-'}</span> },
    {
      header: 'Cetakan / Material',
      cell: (l) =>
        l.item === ItemPengiriman.MOLD
          ? `Cetakan ${l.kodeMold ?? ''}`.trim()
          : `Material ${l.materialName ?? ''}`.trim(),
    },
    { header: 'Jumlah', cell: (l) => (l.jumlahKg != null ? `${l.jumlahKg} kg` : '-') },
    {
      header: 'No. surat jalan',
      cell: (l) => l.noSuratJalan ?? <span className="text-slate-400">-</span>,
    },
    { header: 'Rencana kirim', cell: (l) => formatDate(l.rencanaKirim) },
    {
      header: 'Catatan',
      cell: (l) => l.catatan ?? <span className="text-slate-400">-</span>,
    },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumb={[{ label: 'Beranda', to: '/staff' }, { label: 'Log Aktivitas' }]}
        title="Log Aktivitas"
        description="Catat cetakan dan material yang tiba di lokasi Sundaya. Manager Penyewa langsung diberi tahu setiap ada catatan baru."
      />

      <Card
        title="Rencana pengiriman dari Penyewa"
        subtitle="Salinan Log Pengiriman milik Manager Penyewa, isinya sama persis. Dipakai mencocokkan barang saat tiba, belum berarti barangnya sudah sampai."
      >
        {isLoading ? (
          <TableSkeleton rows={2} columns={6} />
        ) : rencana.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Belum ada rencana pengiriman dari Penyewa.
          </p>
        ) : (
          <DataTable columns={rencanaColumns} rows={rencana} rowKey={(l) => l.id} />
        )}
      </Card>

      <Card
        className="mt-5"
        title="Penerimaan cetakan"
        subtitle="Mencatat penerimaan cetakan memindahkan status tracking-nya ke Received."
        actions={
          canWrite ? (
            <Button
              size="sm"
              onClick={() => setPanelItem(ItemPengiriman.MOLD)}
              disabled={jobs.length === 0}
            >
              <Plus className="h-3.5 w-3.5" /> Catat cetakan
            </Button>
          ) : null
        }
      >
        {isLoading ? (
          <TableSkeleton rows={3} columns={4} />
        ) : moldLogs.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title="Belum ada cetakan diterima"
            message="Catat cetakan yang sudah tiba di lokasi Sundaya."
          />
        ) : (
          <DataTable columns={moldColumns} rows={moldLogs} rowKey={(l) => l.id} />
        )}
      </Card>

      <Card
        className="mt-5"
        title="Penerimaan material"
        subtitle="Material dicatat terpisah beserta jumlah dan nomor surat jalan."
        actions={
          canWrite ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setPanelItem(ItemPengiriman.MATERIAL)}
              disabled={jobs.length === 0}
            >
              <Plus className="h-3.5 w-3.5" /> Catat material
            </Button>
          ) : null
        }
      >
        {isLoading ? (
          <TableSkeleton rows={3} columns={5} />
        ) : materialLogs.length === 0 ? (
          <EmptyState
            icon={PackageCheck}
            title="Belum ada material diterima"
            message="Catat material yang sudah tiba beserta jumlah aktualnya."
          />
        ) : (
          <DataTable columns={materialColumns} rows={materialLogs} rowKey={(l) => l.id} />
        )}
      </Card>

      <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Penerimaan di sini adalah kedatangan barang di gerbang Sundaya. Material yang masuk stok
        lantai produksi dicatat terpisah oleh Admin Penyewa lewat Log Produksi.
      </p>

      {panelItem ? (
        <PenerimaanFormPanel
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

function PenerimaanFormPanel({
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
  const [diterimaAt, setDiterimaAt] = useState(nowLocalInput())
  const [materialName, setMaterialName] = useState<MaterialType | ''>('')
  const [jumlahKg, setJumlahKg] = useState('')
  const [noSuratJalan, setNoSuratJalan] = useState('')
  const [kondisi, setKondisi] = useState('')
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
        diterimaAt: new Date(diterimaAt).toISOString(),
        kondisi: optionalText(kondisi),
        catatan: optionalText(catatan),
      }
      const body: CreateLogPenerimaanRequest = isMold
        ? base
        : {
            ...base,
            materialName: materialName || undefined,
            jumlahKg: Number(jumlahKg),
            noSuratJalan: optionalText(noSuratJalan),
          }
      await api.createPenerimaan(accessToken, body)
      toast.success(isMold ? 'Penerimaan cetakan dicatat' : 'Penerimaan material dicatat')
      onSaved()
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal mencatat penerimaan'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SidePanel
      title={isMold ? 'Catat penerimaan cetakan' : 'Catat penerimaan material'}
      subtitle={
        isMold
          ? 'Status tracking cetakan otomatis menjadi Received.'
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
          label="Waktu diterima"
          type="datetime-local"
          value={diterimaAt}
          onChange={setDiterimaAt}
          max={nowLocalInput()}
        />

        {!isMold ? (
          <>
            <SelectField
              label="Nama material"
              value={materialName}
              onChange={setMaterialName}
              options={[
                { value: '', label: '- pilih material -' },
                ...Object.values(MaterialType).map((m) => ({ value: m, label: m })),
              ]}
            />
            <FieldGroup>
              <TextField
                label="Jumlah diterima (kg)"
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

        <TextField
          label="Kondisi barang"
          required={false}
          value={kondisi}
          onChange={setKondisi}
        />
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
