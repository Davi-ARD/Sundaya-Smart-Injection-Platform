import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Boxes, Info, PackageCheck, Plus } from 'lucide-react'
import {
  ItemPengiriman,
  Role,
  type CreateLogPenerimaanRequest,
  type Job,
  type LogPenerimaan,
  type LogPengiriman,
  KondisiBarang,
  KONDISI_WAJIB_CATATAN,
} from '@mold-tracker/shared'
import { useAuth } from '../auth/authContextValue'
import { api } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/PageHeader'
import { Card } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { KondisiBarangBadge, kondisiBarangLabel } from '../../components/ui/Badge'
import { MaterialCombobox } from '../../components/ui/MaterialCombobox'
import { SidePanel } from '../../components/ui/SidePanel'
import { TableSkeleton } from '../../components/ui/Skeleton'
import { FieldGroup, SelectField, TextAreaField, TextField } from '../../components/ui/FormField'
import { useToast } from '../../components/ui/Toast'
import { errorMessage } from '../../lib/errorMessage'
import { useMoldPicker } from '../../lib/useMoldPicker'
import { optionalText } from '../../lib/form'
import { formatDate, formatDateTime, nowLocalInput } from '../../lib/format'


// Log Aktivitas (Admin Penyewa, bertugas di lokasi Sundaya): catatan cetakan dan material tiba di lokasi
// Sundaya, dipisah jadi dua daftar dalam satu tab. Ini satu-satunya tempat
// kedatangan barang dicatat; Log Produksi tidak lagi punya event material datang.
//
// Mencatat penerimaan cetakan memindahkan tracking mold ke Received sekaligus
// menjalankan booking-nya (masa sewa mulai dihitung), dan Manager pemilik job
// langsung menerima notifikasinya.
export function PenerimaanPage() {
  const { accessToken, user } = useAuth()
  const toast = useToast()
  // Pencatatan milik Admin Penyewa; Manager dan staf Sundaya hanya membaca.
  const canWrite = user?.role === Role.ADMIN_PENYEWA

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
    cell: (l) => <KondisiBarangBadge status={l.kondisi} />,
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
        breadcrumb={[{ label: 'Beranda', to: '/job' }, { label: 'Log Aktivitas' }]}
        title="Log Aktivitas"
        description="Catat cetakan dan material perusahaan Anda yang sudah tiba di lokasi Sundaya. Manager Penyewa langsung diberi tahu setiap ada catatan baru."
      />

      <Card
        title="Rencana pengiriman dari Manager"
        subtitle="Salinan Log Pengiriman yang diisi Manager perusahaan Anda, isinya sama persis. Dipakai mencocokkan barang saat tiba, belum berarti barangnya sudah sampai."
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
          rencana={rencana}
          sudahDicatat={logs}
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
  rencana,
  sudahDicatat,
  onClose,
  onSaved,
}: {
  item: ItemPengiriman
  jobs: Job[]
  // Rencana pengiriman yang sudah diisi Manager, dipakai mengisi otomatis field
  // material saat job dipilih.
  rencana: LogPengiriman[]
  // Penerimaan yang sudah tercatat, dipakai melewati rencana yang sudah diterima.
  sudahDicatat: LogPenerimaan[]
  onClose: () => void
  onSaved: () => void
}) {
  const { accessToken } = useAuth()
  const toast = useToast()
  const isMold = item === ItemPengiriman.MOLD

  const { jobId, moldId, setMoldId, pilihJob, jobOptions, moldOptions } = useMoldPicker(jobs)
  const [diterimaAt, setDiterimaAt] = useState(nowLocalInput())
  const [materialName, setMaterialName] = useState('')
  const [jumlahKg, setJumlahKg] = useState('')
  const [noSuratJalan, setNoSuratJalan] = useState('')
  const [kondisi, setKondisi] = useState<KondisiBarang | ''>('')
  const [catatan, setCatatan] = useState('')
  // Cermin aturan server: kondisi selain Baik wajib disertai penjelasan.
  const catatanWajib = kondisi !== '' && KONDISI_WAJIB_CATATAN.includes(kondisi)
  const [isSaving, setIsSaving] = useState(false)

  // Rencana material milik job terpilih yang belum pernah dicatat penerimaannya.
  // Nomor surat jalan dipakai sebagai penanda: rencana yang nomornya sudah muncul
  // di log penerimaan dianggap sudah diterima, jadi tidak disodorkan lagi.
  const rencanaTerpilih = useMemo(() => {
    if (isMold) return undefined
    const nomorTercatat = new Set(
      sudahDicatat.map((l) => l.noSuratJalan).filter((n): n is string => !!n),
    )
    return rencana
      .filter((r) => r.jobId === jobId && r.item === ItemPengiriman.MATERIAL)
      .filter((r) => !r.noSuratJalan || !nomorTercatat.has(r.noSuratJalan))
      .sort((a, b) => a.rencanaKirim.localeCompare(b.rencanaKirim))[0]
  }, [isMold, jobId, rencana, sudahDicatat])

  // Nomor surat jalan yang sah untuk job ini menurut rencana Manager. Kalau
  // Manager belum mencantumkan nomor sama sekali, tidak ada acuan untuk dicocokkan.
  const nomorSah = useMemo(
    () =>
      rencana
        .filter((r) => r.jobId === jobId && r.item === ItemPengiriman.MATERIAL)
        .map((r) => r.noSuratJalan?.trim())
        .filter((n): n is string => !!n),
    [rencana, jobId],
  )
  // Cermin aturan server: nomor yang diisi harus ada di rencana Manager.
  const suratJalanTidakCocok =
    !isMold &&
    nomorSah.length > 0 &&
    noSuratJalan.trim() !== '' &&
    !nomorSah.some((n) => n.toLowerCase() === noSuratJalan.trim().toLowerCase())

  // Isi otomatis dari rencana Manager saat rencana yang relevan berganti (mis.
  // pengguna memilih job lain). Nilainya tetap bisa disunting: yang datang kadang
  // berbeda dari yang direncanakan, jadi ref menjaga agar pengisian ulang hanya
  // terjadi saat rencananya benar-benar berbeda, bukan tiap kali render.
  const rencanaDiisi = useRef<string | null>(null)
  useEffect(() => {
    if (isMold) return
    const id = rencanaTerpilih?.id ?? null
    if (rencanaDiisi.current === id) return
    rencanaDiisi.current = id
    setMaterialName(rencanaTerpilih?.materialName ?? '')
    setJumlahKg(rencanaTerpilih?.jumlahKg != null ? String(rencanaTerpilih.jumlahKg) : '')
    setNoSuratJalan(rencanaTerpilih?.noSuratJalan ?? '')
  }, [isMold, rencanaTerpilih])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      const base = {
        jobId,
        item,
        moldId: isMold ? moldId : undefined,
        diterimaAt: new Date(diterimaAt).toISOString(),
        kondisi: kondisi || undefined,
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
            {rencanaTerpilih ? (
              <p className="flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-2 text-xs leading-5 text-brand-800">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Terisi otomatis dari rencana kirim Manager
                {rencanaTerpilih.noSuratJalan ? ` (surat jalan ${rencanaTerpilih.noSuratJalan})` : ''}.
                Ubah bila yang benar-benar datang berbeda.
              </p>
            ) : null}
            <MaterialCombobox
              label="Nama material"
              value={materialName}
              onChange={setMaterialName}
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
            {suratJalanTidakCocok ? (
              <p className="text-xs font-medium leading-5 text-rose-600">
                Nomor surat jalan ini tidak ada di rencana kirim Manager. Nomor yang terdaftar
                untuk job ini: {nomorSah.join(', ')}.
              </p>
            ) : null}
          </>
        ) : null}

        <SelectField
          label="Kondisi barang"
          value={kondisi}
          onChange={setKondisi}
          options={[
            { value: '', label: '- pilih kondisi -' },
            ...Object.values(KondisiBarang).map((k) => ({ value: k, label: kondisiBarangLabel[k] })),
          ]}
        />
        <TextAreaField
          label={catatanWajib ? 'Catatan (wajib)' : 'Catatan'}
          value={catatan}
          onChange={setCatatan}
        />
        {catatanWajib && !catatan.trim() ? (
          <p className="text-xs font-medium text-rose-600">
            Kondisi {kondisi ? kondisiBarangLabel[kondisi] : ''} wajib disertai catatan. Jelaskan
            masalahnya, mis. "Plat cetakan berkarat" atau "Material tercampur air".
          </p>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="submit"
            disabled={
              isSaving ||
              !jobId ||
              (isMold && !moldId) ||
              (catatanWajib && !catatan.trim()) ||
              suratJalanTidakCocok
            }
          >
            {isSaving ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </div>
      </form>
    </SidePanel>
  )
}
