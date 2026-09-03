import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { CheckCircle2, ClipboardList, Info, Plus, Factory, Layers, Truck } from 'lucide-react'
import {
  JobLifecycle,
  LogProduksiEventType,
  type JobMachine,
  type JobMold,
  type CreateLogProduksiRequest,
  type Job,
  type LogProduksi,
  type LogPengiriman,
  ItemPengiriman,
} from '@mold-tracker/shared'
import { useAuth } from '../auth/authContextValue'
import { api } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/PageHeader'
import { Card } from '../../components/ui/Card'
import { JobLifecycleBadge, progressMoldingLabel } from '../../components/ui/Badge'
import { SidePanel } from '../../components/ui/SidePanel'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { FieldGroup, SelectField, TextAreaField, TextField } from '../../components/ui/FormField'
import { useToast } from '../../components/ui/Toast'
import { errorMessage } from '../../lib/errorMessage'
import { optionalNumber, optionalText } from '../../lib/form'
import { formatDate, formatDateTime, formatNumber, nowLocalInput } from '../../lib/format'

const eventLabel: Record<LogProduksiEventType, string> = {
  [LogProduksiEventType.PRODUKSI_HARIAN]: 'Produksi harian',
  [LogProduksiEventType.PROGRESS_MOLDING]: 'Progress molding',
}

const eventIcon = {
  [LogProduksiEventType.PRODUKSI_HARIAN]: Factory,
  [LogProduksiEventType.PROGRESS_MOLDING]: Layers,
}

// Nilai <input type="datetime-local"> ('YYYY-MM-DDTHH:mm') menjadi ISO string.
const toIso = (local: string) => new Date(local).toISOString()

// Log Produksi (Layer 2, Admin Penyewa di lokasi Sundaya). Hanya satu jenis event
// yang diinput: produksi harian. Progress molding tidak dipilih manual melainkan
// dihitung server dari capaian terhadap target output cetakan. Kedatangan material
// tidak dicatat di sini karena sudah ada di Log Pengiriman dan Log Aktivitas.
// Append-only: event tidak bisa diubah atau dihapus, koreksi ditulis sebagai
// event baru. Booking meminjamkan mesin tanpa memasangkannya ke cetakan, jadi
// tiap event wajib menyebut cetakan mana berjalan di mesin mana.
export function LogProduksiPage() {
  const { accessToken } = useAuth()
  const toast = useToast()

  const [jobs, setJobs] = useState<Job[]>([])
  const [jobId, setJobId] = useState('')
  const [logs, setLogs] = useState<LogProduksi[]>([])
  const [pengiriman, setPengiriman] = useState<LogPengiriman[]>([])
  const [isLoadingJobs, setIsLoadingJobs] = useState(true)
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  // Cetakan yang sedang dicatat: ditentukan dari kotak cetakan yang diklik,
  // bukan dari dropdown di dalam form.
  const [catatTarget, setCatatTarget] = useState<{ jobId: string; moldId: string } | null>(null)

  useEffect(() => {
    const loadJobs = async () => {
      try {
        // Rencana pengiriman ikut dimuat supaya tiap kartu job bisa menampilkan
        // cetakan dan material apa yang dijadwalkan Manager untuk job itu.
        const [list, kirim] = await Promise.all([
          api.listJobs(accessToken),
          api.listPengiriman(accessToken),
        ])
        setJobs(list)
        setPengiriman(kirim)
        setJobId((current) => current || list[0]?.id || '')
      } catch (caught) {
        toast.error(errorMessage(caught, 'Gagal memuat job'))
      } finally {
        setIsLoadingJobs(false)
      }
    }
    void loadJobs()
  }, [accessToken, toast])

  const loadLogs = useCallback(async () => {
    if (!jobId) return
    setIsLoadingLogs(true)
    try {
      setLogs(await api.listLogs(accessToken, jobId))
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal memuat log produksi'))
    } finally {
      setIsLoadingLogs(false)
    }
  }, [accessToken, jobId, toast])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  // Timeline terbaru di atas; server mengurutkan menaik.
  const timeline = useMemo(() => [...logs].reverse(), [logs])

  if (isLoadingJobs) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card>
          <CardSkeleton lines={4} />
        </Card>
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card>
          <div className="grid place-items-center py-14 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <ClipboardList className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-800">Belum ada job</p>
            <p className="mt-1 max-w-sm text-sm text-slate-500">
              Log produksi dicatat per job. Manager perusahaan Anda perlu mengajukan booking
              terlebih dahulu.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        breadcrumb={[{ label: 'Beranda', to: '/job' }, { label: 'Log Produksi' }]}
        title="Log Produksi"
        description="Catat produksi harian tiap cetakan di lokasi Sundaya. Produksi harian pertama menandai booking sudah berjalan, dan status progress diperbarui sistem otomatis mengikuti capaian terhadap target output."
      />

      {/* Daftar job sebagai kartu, bukan dropdown: Admin Penyewa perlu melihat
          rencana pengiriman dan status tiap cetakan sebelum memutuskan mencatat,
          dan tombol Catat produksi menempel pada job-nya sendiri supaya tidak
          ambigu job mana yang sedang dicatat. */}
      <div className="space-y-3">
        {jobs.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            terpilih={job.id === jobId}
            pengiriman={pengiriman.filter((p) => p.jobId === job.id)}
            onPilih={() => setJobId(job.id)}
            onCatat={(moldId) => {
              setJobId(job.id)
              setCatatTarget({ jobId: job.id, moldId })
            }}
          />
        ))}
      </div>

      <Card className="mt-5" title="Timeline" subtitle="Event terbaru di atas.">
        {isLoadingLogs ? (
          <CardSkeleton lines={4} />
        ) : timeline.length === 0 ? (
          <div className="grid place-items-center py-12 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <ClipboardList className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-800">Belum ada event</p>
            <p className="mt-1 text-sm text-slate-500">Catat produksi harian pertama untuk job ini.</p>
          </div>
        ) : (
          <ol className="space-y-3">
            {timeline.map((log) => (
              <TimelineItem key={log.id} log={log} />
            ))}
          </ol>
        )}
      </Card>

      <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Event bersifat permanen dan tidak dapat diubah atau dihapus. Bila ada kekeliruan, catat
        event baru sebagai koreksi.
      </p>

      {catatTarget ? (
        <LogFormPanel
          // Remount saat cetakan berganti: tanpa ini isian cetakan sebelumnya
          // ikut terbawa ke cetakan yang baru dipilih.
          key={catatTarget.moldId}
          jobId={catatTarget.jobId}
          moldId={catatTarget.moldId}
          molds={jobs.find((j) => j.id === catatTarget.jobId)?.molds ?? []}
          machines={jobs.find((j) => j.id === catatTarget.jobId)?.machines ?? []}
          logs={logs}
          onClose={() => setCatatTarget(null)}
          onSaved={() => {
            setCatatTarget(null)
            void loadLogs()
          }}
        />
      ) : null}
    </div>
  )
}

function TimelineItem({ log }: { log: LogProduksi }) {
  const Icon = eventIcon[log.eventType]
  return (
    <li className="flex gap-3 rounded-xl border border-slate-200/70 bg-white p-4 shadow-soft">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">
            {eventLabel[log.eventType]}
            {log.kodeMold ? (
              <span className="ml-2 font-normal text-slate-500">
                {log.kodeMold}
                {log.machineNumber ? ` di mesin ${log.machineNumber}` : ''}
              </span>
            ) : null}
          </p>
          <p className="text-xs text-slate-400">{formatDateTime(log.occurredAt)}</p>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {log.eventType === LogProduksiEventType.PRODUKSI_HARIAN ? (
            <>
              {log.goodProduct?.toLocaleString('id-ID')} baik, {log.rejectCount?.toLocaleString('id-ID')} reject
              {log.materialUsedKg != null ? `, material terpakai ${log.materialUsedKg} kg` : ''}
            </>
          ) : (
            <>
              {log.progressMolding ? progressMoldingLabel[log.progressMolding] : '-'}
              {log.keteranganProgress ? ` - ${log.keteranganProgress}` : ''}
            </>
          )}
        </p>
        {log.catatan ? <p className="mt-1 text-xs text-slate-500">{log.catatan}</p> : null}
      </div>
    </li>
  )
}

function LogFormPanel({
  jobId,
  moldId,
  molds,
  machines,
  logs,
  onClose,
  onSaved,
}: {
  jobId: string
  // Cetakan sudah ditentukan dari kotak yang diklik di halaman, jadi form ini
  // tidak lagi menawarkan pilihan cetakan.
  moldId: string
  molds: JobMold[]
  machines: JobMachine[]
  // Log job ini, dipakai menghitung capaian tiap cetakan terhadap targetnya.
  logs: LogProduksi[]
  onClose: () => void
  onSaved: () => void
}) {
  const { accessToken } = useAuth()
  const toast = useToast()

  const [machineId, setMachineId] = useState(machines[0]?.machineId ?? '')
  const [occurredAt, setOccurredAt] = useState(nowLocalInput())
  const [catatan, setCatatan] = useState('')
  // Produksi harian
  const [goodProduct, setGoodProduct] = useState('')
  const [rejectCount, setRejectCount] = useState('')
  const [materialUsedKg, setMaterialUsedKg] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const selectedMold = molds.find((m) => m.moldId === moldId)
  // Capaian cetakan terpilih sejauh ini, dihitung dari timeline job yang sudah dimuat.
  const goodSejauhIni = useMemo(
    () => logs.filter((l) => l.moldId === moldId).reduce((a, l) => a + (l.goodProduct ?? 0), 0),
    [logs, moldId],
  )
  const target = selectedMold?.targetOutput ?? null
  const sisaTarget = target != null ? Math.max(target - goodSejauhIni, 0) : null
  // Cermin aturan server: cetakan yang sudah menyentuh target dinyatakan selesai.
  const targetTercapai = target != null && goodSejauhIni >= target
  const melebihiSisa =
    sisaTarget != null && goodProduct.trim() !== '' && Number(goodProduct) > sisaTarget
  // Tonase mesin adalah batas atas: cetakan ini hanya boleh jalan di mesin yang sanggup.
  const mesinCocok = machines.filter((m) => m.tonaseTon >= (selectedMold?.tonaseTon ?? 0))
  // Ganti cetakan bisa membuat mesin terpilih tidak sanggup lagi; jatuh ke mesin cocok
  // pertama supaya yang dikirim selalu sama dengan yang tampil di form.
  const mesinDipakai = mesinCocok.some((m) => m.machineId === machineId)
    ? machineId
    : (mesinCocok[0]?.machineId ?? '')

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    const body: CreateLogProduksiRequest = {
      moldId,
      machineId: mesinDipakai,
      occurredAt: toIso(occurredAt),
      goodProduct: Number(goodProduct),
      rejectCount: Number(rejectCount),
      materialUsedKg: optionalNumber(materialUsedKg),
      catatan: optionalText(catatan),
    }

    try {
      await api.createLog(accessToken, jobId, body)
      toast.success('Event dicatat')
      onSaved()
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal mencatat event'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SidePanel
      title="Catat produksi harian"
      subtitle="Tersimpan permanen dan tidak dapat diubah. Status progress diperbarui sistem otomatis."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Cetakan tidak dipilih di sini: sudah ditentukan lewat kotak cetakan yang
            diklik di halaman Log Produksi, jadi form ini selalu untuk satu cetakan
            yang jelas. */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Cetakan</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900">
            {selectedMold?.kodeMold}{' '}
            <span className="font-normal text-slate-500">{selectedMold?.namaProduk}</span>
          </p>
        </div>
        {selectedMold ? (
          targetTercapai ? (
            <div className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2.5 text-xs leading-5 text-emerald-900 ring-1 ring-inset ring-emerald-600/15">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Cetakan {selectedMold.kodeMold} sudah mencapai target {target} pcs
                ({goodSejauhIni} produk baik). Produksinya dinyatakan selesai, jadi tidak ada
                lagi produksi harian yang bisa dicatat untuk cetakan ini.
              </span>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-lg bg-brand-50/70 px-3 py-2.5 text-xs leading-5 text-brand-900 ring-1 ring-inset ring-brand-600/10">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {target != null
                  ? `Capaian ${goodSejauhIni} dari target ${target} pcs, sisa ${sisaTarget} pcs.`
                  : 'Target output cetakan ini belum ditentukan, jadi produksinya tidak dibatasi.'}
                {selectedMold.estimasiKg != null
                  ? ` Kuota material ${selectedMold.estimasiKg} kg.`
                  : ''}
                {' '}Status progress diperbarui sistem otomatis; tidak perlu diubah manual.
              </span>
            </div>
          )
        ) : null}

        {mesinCocok.length ? (
          <SelectField
            label="Mesin yang dipakai"
            value={mesinDipakai}
            onChange={setMachineId}
            options={mesinCocok.map((m) => ({
              value: m.machineId,
              label: `${m.machineNumber} (${m.tonaseTon} ton)`,
            }))}
          />
        ) : (
          <p className="rounded-lg bg-rose-50 px-3 py-2.5 text-xs leading-5 text-rose-700 ring-1 ring-inset ring-rose-600/15">
            Tidak ada mesin pinjaman yang sanggup cetakan ini
            {selectedMold ? ` (butuh ${selectedMold.tonaseTon} ton)` : ''}. Hubungi Sundaya.
          </p>
        )}

        <TextField
          label="Waktu kejadian"
          type="datetime-local"
          value={occurredAt}
          onChange={setOccurredAt}
          max={nowLocalInput()}
        />

        <FieldGroup>
          <TextField label="Produk baik" type="number" min={0} value={goodProduct} onChange={setGoodProduct} />
          <TextField label="Reject" type="number" min={0} value={rejectCount} onChange={setRejectCount} />
        </FieldGroup>
        <TextField
          label="Material terpakai hari ini (kg)"
          type="number"
          min={0}
          step="0.1"
          required={false}
          value={materialUsedKg}
          onChange={setMaterialUsedKg}
        />

        {melebihiSisa ? (
          <p className="text-xs font-medium leading-5 text-rose-600">
            Produk baik melebihi sisa target: maksimal {sisaTarget} pcs lagi untuk cetakan ini.
          </p>
        ) : null}

        <TextAreaField label="Catatan" value={catatan} onChange={setCatatan} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button
            type="submit"
            disabled={isSaving || !mesinDipakai || targetTercapai || melebihiSisa}
          >
            {isSaving ? 'Menyimpan...' : 'Catat produksi'}
          </Button>
        </div>
      </form>
    </SidePanel>
  )
}

// Satu kartu per job: ringkasan booking, rencana pengiriman dari Manager, dan
// status tiap cetakan. Tombol Catat produksi menempel di sini supaya jelas job
// mana yang dicatat, dan mati sendiri kalau memang tidak ada yang bisa dicatat.
function JobCard({
  job,
  terpilih,
  pengiriman,
  onPilih,
  onCatat,
}: {
  job: Job
  terpilih: boolean
  pengiriman: LogPengiriman[]
  onPilih: () => void
  onCatat: (moldId: string) => void
}) {
  const belumSelesai = job.molds.filter((m) => !m.selesai)
  // Cermin aturan server: produksi hanya boleh dicatat selama masa sewa berjalan,
  // masih ada mesin, dan masih ada cetakan yang belum tuntas.
  const sewaBerjalan =
    job.lifecycle === JobLifecycle.AKTIF || job.lifecycle === JobLifecycle.DIKONFIRMASI
  const bisaCatat = sewaBerjalan && belumSelesai.length > 0 && job.machines.length > 0
  const kirimMold = pengiriman.filter((p) => p.item === ItemPengiriman.MOLD)
  const kirimMaterial = pengiriman.filter((p) => p.item === ItemPengiriman.MATERIAL)

  return (
    <section
      onClick={onPilih}
      className={`cursor-pointer rounded-xl border bg-white p-4 transition-colors ${
        terpilih ? 'border-brand-400 ring-1 ring-brand-200' : 'border-slate-200/70 hover:bg-slate-50/60'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-sm font-semibold text-slate-950">{job.jobNumber}</span>
          <JobLifecycleBadge status={job.lifecycle} />
          <span className="text-xs text-slate-500">
            Mesin:{' '}
            {job.machines.length
              ? job.machines.map((m) => m.machineNumber).join(', ')
              : 'belum dipinjamkan'}
          </span>
        </div>

        {bisaCatat ? (
          <span className="text-xs text-slate-500">Klik cetakan untuk mencatat produksinya</span>
        ) : null}
      </div>

      {/* Detail cetakan: status tiap cetakan langsung terbaca, termasuk mana yang
          sudah tuntas sehingga tidak perlu dicatat lagi. */}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {job.molds.map((m) => {
          const bisaDicatat = bisaCatat && !m.selesai
          return (
          <button
            key={m.moldId}
            type="button"
            disabled={!bisaDicatat}
            onClick={(event) => {
              event.stopPropagation()
              onCatat(m.moldId)
            }}
            className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
              m.selesai
                ? 'cursor-default border-emerald-200 bg-emerald-50/60'
                : bisaDicatat
                  ? 'cursor-pointer border-slate-200 bg-slate-50/60 hover:border-brand-300 hover:bg-brand-50/60'
                  : 'cursor-default border-slate-200 bg-slate-50/60'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-900">{m.kodeMold}</span>
              {m.selesai ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" /> Selesai
                </span>
              ) : m.targetOutput == null ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  Tanpa target
                </span>
              ) : (
                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                  Berjalan
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              {m.namaProduk} - {m.tonaseTon} ton
            </p>
            {m.targetOutput != null ? (
              <p className="mt-1 text-xs tabular-nums text-slate-600">
                {formatNumber(m.goodProduct)} / {formatNumber(m.targetOutput)} pcs
              </p>
            ) : null}
            {bisaDicatat ? (
              <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-brand-700">
                <Plus className="h-3 w-3" /> Catat produksi
              </span>
            ) : null}
          </button>
          )
        })}
      </div>

      {/* Pengiriman job: rencana kirim dari Manager, supaya Admin Penyewa tahu
          barang mana yang sedang dalam perjalanan tanpa pindah halaman. */}
      {pengiriman.length ? (
        <div className="mt-3 rounded-lg bg-slate-50/80 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Pengiriman job
          </p>
          <ul className="mt-1.5 space-y-1 text-xs text-slate-600">
            {kirimMold.map((p) => (
              <li key={p.id} className="flex items-start gap-1.5">
                <Truck className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                Cetakan {p.kodeMold ?? '-'} dijadwalkan {formatDate(p.rencanaKirim)}
              </li>
            ))}
            {kirimMaterial.map((p) => (
              <li key={p.id} className="flex items-start gap-1.5">
                <Truck className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                Material {p.materialName ?? '-'}
                {p.jumlahKg != null ? ` ${formatNumber(p.jumlahKg)} kg` : ''} dijadwalkan{' '}
                {formatDate(p.rencanaKirim)}
                {p.noSuratJalan ? ` (SJ ${p.noSuratJalan})` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-400">Belum ada rencana pengiriman untuk job ini.</p>
      )}

      {!bisaCatat ? (
        <p className="mt-3 text-xs text-slate-500">
          {!sewaBerjalan
            ? 'Masa sewa booking ini sudah berakhir, produksi tidak bisa dicatat lagi.'
            : job.machines.length === 0
              ? 'Mesin belum dipinjamkan, produksi belum bisa dicatat.'
              : 'Semua cetakan di job ini sudah mencapai target. Minta Manager mengubah target output bila ingin mencetak lagi.'}
        </p>
      ) : null}
    </section>
  )
}
