import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ClipboardList, Info, PackagePlus, Plus, Factory, Layers } from 'lucide-react'
import {
  LogProduksiEventType,
  ProgressMolding,
  type CreateLogProduksiRequest,
  type Job,
  type LogProduksi,
} from '@mold-tracker/shared'
import { useAuth } from '../auth/authContextValue'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { JobLifecycleBadge, progressMoldingLabel } from '../../components/ui/Badge'
import { SidePanel } from '../../components/ui/SidePanel'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { FieldGroup, SelectField, TextAreaField, TextField } from '../../components/ui/FormField'
import { useToast } from '../../components/ui/Toast'
import { errorMessage } from '../../lib/errorMessage'
import { optionalNumber, optionalText } from '../../lib/form'
import { formatDateTime } from '../../lib/format'

const eventLabel: Record<LogProduksiEventType, string> = {
  [LogProduksiEventType.MATERIAL_DATANG]: 'Material datang',
  [LogProduksiEventType.PRODUKSI_HARIAN]: 'Produksi harian',
  [LogProduksiEventType.PROGRESS_MOLDING]: 'Progress molding',
}

const eventIcon = {
  [LogProduksiEventType.MATERIAL_DATANG]: PackagePlus,
  [LogProduksiEventType.PRODUKSI_HARIAN]: Factory,
  [LogProduksiEventType.PROGRESS_MOLDING]: Layers,
}

// Nilai <input type="datetime-local"> ('YYYY-MM-DDTHH:mm') menjadi ISO string.
const toIso = (local: string) => new Date(local).toISOString()

// Nilai awal input datetime-local: waktu sekarang menurut zona waktu pengguna.
const nowLocal = () => {
  const now = new Date()
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
  return now.toISOString().slice(0, 16)
}

// Log Produksi (Layer 2, Admin Penyewa di lokasi Sundaya). Append-only:
// event tidak bisa diubah atau dihapus, koreksi ditulis sebagai event baru.
export function LogProduksiPage() {
  const { accessToken } = useAuth()
  const toast = useToast()

  const [jobs, setJobs] = useState<Job[]>([])
  const [jobId, setJobId] = useState('')
  const [logs, setLogs] = useState<LogProduksi[]>([])
  const [isLoadingJobs, setIsLoadingJobs] = useState(true)
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  useEffect(() => {
    const loadJobs = async () => {
      try {
        const list = await api.listJobs(accessToken)
        setJobs(list)
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

  const activeJob = useMemo(() => jobs.find((job) => job.id === jobId), [jobs, jobId])
  // Timeline terbaru di atas; server mengurutkan menaik.
  const timeline = useMemo(() => [...logs].reverse(), [logs])

  if (isLoadingJobs) {
    return (
      <div className="mx-auto max-w-screen-2xl">
        <Card>
          <CardSkeleton lines={4} />
        </Card>
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div className="mx-auto max-w-screen-2xl">
        <Card>
          <div className="grid place-items-center py-14 text-center">
            <span className="grid h-12 w-12 place-items-center text-brand-700">
              <ClipboardList className="h-7 w-7" />
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
    <div className="mx-auto max-w-screen-2xl">
      <PageHeader
        breadcrumb={[{ label: 'Beranda', to: '/job' }, { label: 'Log Produksi' }]}
        title="Log Produksi"
        description="Catat material datang, produksi harian, dan progress molding di lokasi Sundaya."
        actions={
          <Button onClick={() => setIsPanelOpen(true)} disabled={!jobId}>
            <Plus className="h-5 w-5" /> Catat event
          </Button>
        }
      />

      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-64 flex-1">
            <SelectField
              label="Job"
              value={jobId}
              onChange={setJobId}
              options={jobs.map((job) => ({ value: job.id, label: job.jobNumber }))}
            />
          </div>
          {activeJob ? (
            <div className="flex items-center gap-3 pb-1">
              <JobLifecycleBadge status={activeJob.lifecycle} />
              <span className="text-sm text-slate-500">
                Mesin: {activeJob.machineNumber ?? 'belum di-assign'}
              </span>
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="mt-5" title="Timeline" subtitle="Event terbaru di atas.">
        {isLoadingLogs ? (
          <CardSkeleton lines={4} />
        ) : timeline.length === 0 ? (
          <div className="grid place-items-center py-12 text-center">
            <span className="grid h-12 w-12 place-items-center text-brand-700">
              <ClipboardList className="h-7 w-7" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-800">Belum ada event</p>
            <p className="mt-1 text-sm text-slate-500">Catat event pertama untuk job ini.</p>
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
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        Event bersifat permanen dan tidak dapat diubah atau dihapus. Bila ada kekeliruan, catat
        event baru sebagai koreksi.
      </p>

      {isPanelOpen && jobId ? (
        <LogFormPanel
          jobId={jobId}
          onClose={() => setIsPanelOpen(false)}
          onSaved={() => {
            setIsPanelOpen(false)
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
      <span className="grid h-9 w-9 shrink-0 place-items-center text-brand-700">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">{eventLabel[log.eventType]}</p>
          <p className="text-xs text-slate-400">{formatDateTime(log.occurredAt)}</p>
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {log.eventType === LogProduksiEventType.MATERIAL_DATANG ? (
            <>
              {log.materialName} - {log.jumlahKg} kg
              {log.noSuratJalan ? ` (surat jalan ${log.noSuratJalan})` : ''}
            </>
          ) : log.eventType === LogProduksiEventType.PRODUKSI_HARIAN ? (
            <>
              {log.goodProduct?.toLocaleString('id-ID')} baik, {log.rejectCount?.toLocaleString('id-ID')} reject
              {log.materialRemainingKg != null ? `, sisa material ${log.materialRemainingKg} kg` : ''}
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
  onClose,
  onSaved,
}: {
  jobId: string
  onClose: () => void
  onSaved: () => void
}) {
  const { accessToken } = useAuth()
  const toast = useToast()
  const [eventType, setEventType] = useState<LogProduksiEventType>(
    LogProduksiEventType.PRODUKSI_HARIAN,
  )
  const [occurredAt, setOccurredAt] = useState(nowLocal())
  const [catatan, setCatatan] = useState('')
  // Material datang
  const [materialName, setMaterialName] = useState('')
  const [jumlahKg, setJumlahKg] = useState('')
  const [noSuratJalan, setNoSuratJalan] = useState('')
  // Produksi harian
  const [goodProduct, setGoodProduct] = useState('')
  const [rejectCount, setRejectCount] = useState('')
  const [materialRemainingKg, setMaterialRemainingKg] = useState('')
  // Progress molding
  const [progressMolding, setProgressMolding] = useState<ProgressMolding>(ProgressMolding.ONGOING)
  const [keteranganProgress, setKeteranganProgress] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    // Hanya field milik jenis event yang dikirim; server menolak bila wajib kosong.
    const base = { eventType, occurredAt: toIso(occurredAt), catatan: optionalText(catatan) }
    const body: CreateLogProduksiRequest =
      eventType === LogProduksiEventType.MATERIAL_DATANG
        ? {
            ...base,
            materialName: materialName.trim(),
            jumlahKg: Number(jumlahKg),
            noSuratJalan: optionalText(noSuratJalan),
          }
        : eventType === LogProduksiEventType.PRODUKSI_HARIAN
          ? {
              ...base,
              goodProduct: Number(goodProduct),
              rejectCount: Number(rejectCount),
              materialRemainingKg: optionalNumber(materialRemainingKg),
            }
          : { ...base, progressMolding, keteranganProgress: optionalText(keteranganProgress) }

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
      title="Catat event produksi"
      subtitle="Event tersimpan permanen dan tidak dapat diubah."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <SelectField
          label="Jenis event"
          value={eventType}
          onChange={setEventType}
          options={Object.values(LogProduksiEventType).map((type) => ({
            value: type,
            label: eventLabel[type],
          }))}
        />
        <TextField label="Waktu kejadian" type="datetime-local" value={occurredAt} onChange={setOccurredAt} />

        {eventType === LogProduksiEventType.MATERIAL_DATANG ? (
          <>
            <TextField label="Nama material" value={materialName} onChange={setMaterialName} />
            <FieldGroup>
              <TextField label="Jumlah (kg)" type="number" min={0} step="0.1" value={jumlahKg} onChange={setJumlahKg} />
              <TextField label="No. surat jalan" required={false} value={noSuratJalan} onChange={setNoSuratJalan} />
            </FieldGroup>
          </>
        ) : eventType === LogProduksiEventType.PRODUKSI_HARIAN ? (
          <>
            <FieldGroup>
              <TextField label="Produk baik" type="number" min={0} value={goodProduct} onChange={setGoodProduct} />
              <TextField label="Reject" type="number" min={0} value={rejectCount} onChange={setRejectCount} />
            </FieldGroup>
            <TextField
              label="Sisa material (kg)"
              type="number"
              min={0}
              step="0.1"
              required={false}
              value={materialRemainingKg}
              onChange={setMaterialRemainingKg}
            />
          </>
        ) : (
          <>
            <SelectField
              label="Progress"
              value={progressMolding}
              onChange={setProgressMolding}
              options={Object.values(ProgressMolding).map((value) => ({
                value,
                label: progressMoldingLabel[value],
              }))}
            />
            <TextField
              label="Keterangan"
              required={false}
              value={keteranganProgress}
              onChange={setKeteranganProgress}
            />
          </>
        )}

        <TextAreaField label="Catatan" value={catatan} onChange={setCatatan} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Menyimpan...' : 'Catat event'}
          </Button>
        </div>
      </form>
    </SidePanel>
  )
}
