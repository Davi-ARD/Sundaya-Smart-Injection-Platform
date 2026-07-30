import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarPlus, Info, TimerReset } from 'lucide-react'
import {
  ExtensionStatus,
  JobLifecycle,
  type CreateJobRequest,
  type Job,
  type Mold,
} from '@mold-tracker/shared'
import { useAuth } from '../auth/authContextValue'
import { api } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { ExtensionStatusBadge, JobLifecycleBadge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { SidePanel } from '../../components/ui/SidePanel'
import { TableSkeleton } from '../../components/ui/Skeleton'
import { FieldGroup, TextAreaField, TextField } from '../../components/ui/FormField'
import { useToast } from '../../components/ui/Toast'
import { errorMessage } from '../../lib/errorMessage'
import { optionalText } from '../../lib/form'
import { formatDate, todayInput } from '../../lib/format'

// Input <input type="date"> memberi 'YYYY-MM-DD'; backend menerima ISO string.
const toIso = (date: string) => new Date(`${date}T00:00:00`).toISOString()

// Booking mesin (Manager Penyewa). Satu booking boleh memuat beberapa cetakan dan
// TIDAK memilih mesin: mesin di-assign Admin Sundaya untuk seluruh booking.
// Plan material dan target output tidak ditanyakan di sini karena sudah diisi saat
// merancang cetakan.
export function BookingPage() {
  const { accessToken } = useAuth()
  const toast = useToast()

  const [jobs, setJobs] = useState<Job[]>([])
  const [molds, setMolds] = useState<Mold[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [extendTarget, setExtendTarget] = useState<Job | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [jobList, moldList] = await Promise.all([
        api.listJobs(accessToken),
        api.listMolds(accessToken),
      ])
      setJobs(jobList)
      setMolds(moldList)
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal memuat booking'))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, toast])

  useEffect(() => {
    void load()
  }, [load])

  // Satu cetakan hanya boleh ikut satu booking; jobId terisi berarti sudah dibooking
  // (server tetap menolak dengan 409 bila dipaksa).
  const availableMolds = useMemo(() => molds.filter((mold) => mold.jobId == null), [molds])

  const columns: Column<Job>[] = [
    { header: 'No. Job', cell: (j) => <span className="font-semibold text-slate-900">{j.jobNumber}</span> },
    {
      header: 'Cetakan',
      cell: (j) =>
        j.molds.length ? (
          <span className="flex flex-col gap-0.5">
            {j.molds.map((m) => (
              <span key={m.moldId} className="text-sm">
                {m.kodeMold} - {m.namaProduk}
              </span>
            ))}
          </span>
        ) : (
          <span className="text-slate-400">-</span>
        ),
    },
    { header: 'Status', cell: (j) => <JobLifecycleBadge status={j.lifecycle} /> },
    {
      header: 'Mesin',
      cell: (j) =>
        j.machines.length ? (
          <span className="flex flex-col gap-0.5 text-sm">
            {j.machines.map((m) => (
              <span key={m.machineId}>{m.machineNumber}</span>
            ))}
            <span className="text-xs text-slate-500">
              {j.machines.length} dari {j.requestedMachineCount} diminta
            </span>
          </span>
        ) : (
          <span className="text-slate-400">Menunggu {j.requestedMachineCount} mesin</span>
        ),
    },
    { header: 'Durasi', cell: (j) => `${j.requestedDurationDays} hari` },
    { header: 'Selesai sewa', cell: (j) => formatDate(j.endDate) },
    {
      header: 'Perpanjangan',
      cell: (j) => {
        // Pengajuan terbaru ada di indeks 0 (server mengurutkan menurun).
        const latest = j.extensions[0]
        if (!latest) return <span className="text-slate-400">-</span>
        return (
          <span className="flex flex-col gap-1">
            <ExtensionStatusBadge status={latest.status} />
            <span className="text-xs text-slate-500">+{latest.additionalDays} hari</span>
          </span>
        )
      },
    },
    {
      header: '',
      className: 'text-right',
      cell: (j) =>
        // Perpanjangan hanya relevan saat mesin sedang dipakai.
        j.lifecycle === JobLifecycle.AKTIF ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={j.extensions.some((e) => e.status === ExtensionStatus.DIAJUKAN)}
            onClick={() => setExtendTarget(j)}
          >
            <TimerReset className="h-3.5 w-3.5" /> Ajukan perpanjangan
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Booking Mesin</h1>
          <p className="mt-1 text-sm text-slate-500">
            Ajukan booking untuk satu atau beberapa cetakan sekaligus, plus jumlah mesin yang
            ingin dipinjam.
          </p>
        </div>
        <Button onClick={() => setIsPanelOpen(true)} disabled={isLoading}>
          <CalendarPlus className="h-4 w-4" /> Ajukan booking
        </Button>
      </div>

      <Card>
        {isLoading ? (
          <TableSkeleton rows={5} columns={6} />
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={CalendarPlus}
            title="Belum ada booking"
            message={
              molds.length === 0
                ? 'Tambahkan cetakan terlebih dahulu di halaman Cetakan.'
                : 'Ajukan booking pertama untuk cetakan Anda.'
            }
          />
        ) : (
          <DataTable columns={columns} rows={jobs} rowKey={(j) => j.id} />
        )}
      </Card>

      {extendTarget ? (
        <ExtensionModal
          job={extendTarget}
          onClose={() => setExtendTarget(null)}
          onSaved={() => {
            setExtendTarget(null)
            void load()
          }}
        />
      ) : null}

      {isPanelOpen ? (
        <BookingFormPanel
          molds={availableMolds}
          onClose={() => setIsPanelOpen(false)}
          onSaved={() => {
            setIsPanelOpen(false)
            void load()
          }}
          save={async (form) => {
            const body: CreateJobRequest = {
              moldIds: form.moldIds,
              requestedMachineCount: Number(form.requestedMachineCount),
              requestedDurationDays: Number(form.requestedDurationDays),
              startDate: toIso(form.startDate),
              catatan: optionalText(form.catatan),
            }
            await api.createJob(accessToken, body)
          }}
        />
      ) : null}
    </div>
  )
}

type FormState = {
  moldIds: string[]
  requestedMachineCount: string
  requestedDurationDays: string
  startDate: string
  catatan: string
}

function BookingFormPanel({
  molds,
  onClose,
  onSaved,
  save,
}: {
  molds: Mold[]
  onClose: () => void
  onSaved: () => void
  save: (form: FormState) => Promise<void>
}) {
  const toast = useToast()
  const [form, setForm] = useState<FormState>({
    moldIds: [],
    requestedMachineCount: '1',
    requestedDurationDays: '30',
    startDate: todayInput(),
    catatan: '',
  })
  const [isSaving, setIsSaving] = useState(false)

  const toggleMold = (moldId: string) =>
    setForm((f) => ({
      ...f,
      moldIds: f.moldIds.includes(moldId)
        ? f.moldIds.filter((id) => id !== moldId)
        : [...f.moldIds, moldId],
    }))

  // Sundaya meminjamkan beberapa mesin tanpa memasangkannya ke cetakan tertentu, jadi
  // angka ini sifatnya info: mesin sebesar ini perlu ada supaya semua cetakan kebagian.
  const tonaseTerbesar = molds
    .filter((m) => form.moldIds.includes(m.id))
    .reduce((max, m) => Math.max(max, m.tonaseTon), 0)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (form.moldIds.length === 0) {
      toast.error('Pilih minimal satu cetakan')
      return
    }
    setIsSaving(true)
    try {
      await save(form)
      toast.success('Booking diajukan')
      onSaved()
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal mengajukan booking'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SidePanel
      title="Ajukan booking"
      subtitle="Pilih cetakan dan jumlah mesin. Mesin mana yang dipinjamkan ditentukan Sundaya."
      onClose={onClose}
    >
      {molds.length === 0 ? (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-600/15">
          Semua cetakan sudah dibooking. Tambahkan cetakan baru di halaman Cetakan terlebih dahulu.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-700">Cetakan</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Boleh lebih dari satu. Rencana material dan target output terbawa dari masing-masing
              cetakan.
            </p>
            <div className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/60 p-2">
              {molds.map((mold) => (
                <label
                  key={mold.id}
                  className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-white"
                >
                  <input
                    type="checkbox"
                    checked={form.moldIds.includes(mold.id)}
                    onChange={() => toggleMold(mold.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-slate-900">
                      {mold.kodeMold} - {mold.namaProduk}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {mold.tonaseTon} ton, {mold.cavity} cavity
                      {mold.targetOutput != null ? `, target ${mold.targetOutput}` : ''}
                      {mold.estimasiKg != null ? `, material ${mold.estimasiKg} kg` : ''}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {form.moldIds.length > 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                {form.moldIds.length} cetakan dipilih, cetakan terberat butuh mesin {tonaseTerbesar}{' '}
                ton.
              </p>
            ) : null}
          </div>

          <TextField
            label="Jumlah mesin yang dipinjam"
            type="number"
            min={1}
            max={20}
            value={form.requestedMachineCount}
            onChange={(value) => setForm((f) => ({ ...f, requestedMachineCount: value }))}
          />
          <p className="-mt-2 text-xs leading-5 text-slate-500">
            Mesin dipinjamkan, bukan dipasangkan ke cetakan. Petugas Anda bebas menjalankan cetakan
            mana pun di mesin mana pun selama tonasenya cukup.
          </p>

          <FieldGroup>
            <TextField
              label="Durasi sewa (hari)"
              type="number"
              min={1}
              value={form.requestedDurationDays}
              onChange={(value) => setForm((f) => ({ ...f, requestedDurationDays: value }))}
            />
            <TextField
              label="Rencana mulai"
              type="date"
              value={form.startDate}
              onChange={(value) => setForm((f) => ({ ...f, startDate: value }))}
            />
          </FieldGroup>

          <TextAreaField
            label="Catatan"
            value={form.catatan}
            onChange={(value) => setForm((f) => ({ ...f, catatan: value }))}
          />

          <div className="flex items-start gap-2 rounded-lg bg-brand-50/70 px-3 py-2.5 text-xs leading-5 text-brand-900 ring-1 ring-inset ring-brand-600/10">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Rencana kirim cetakan dan material dicatat terpisah di tab Log Pengiriman setelah
            booking dibuat.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={isSaving || form.moldIds.length === 0}>
              {isSaving ? 'Mengajukan...' : 'Ajukan booking'}
            </Button>
          </div>
        </form>
      )}
    </SidePanel>
  )
}

// Pengajuan perpanjangan sewa. Keputusan ada di Admin Sundaya (tab Booking
// mereka); di sini Manager hanya menyebut tambahan hari yang dibutuhkan.
function ExtensionModal({
  job,
  onClose,
  onSaved,
}: {
  job: Job
  onClose: () => void
  onSaved: () => void
}) {
  const { accessToken } = useAuth()
  const toast = useToast()
  const [additionalDays, setAdditionalDays] = useState('7')
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      await api.createExtension(accessToken, job.id, {
        additionalDays: Number(additionalDays),
      })
      toast.success('Pengajuan perpanjangan dikirim')
      onSaved()
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal mengajukan perpanjangan'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal title={`Perpanjangan ${job.jobNumber}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-600">
          Sewa berakhir {formatDate(job.endDate)}. Admin Sundaya yang memutuskan pengajuan ini.
        </p>
        <TextField
          label="Tambahan hari"
          type="number"
          min={1}
          max={365}
          value={additionalDays}
          onChange={setAdditionalDays}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Mengirim...' : 'Ajukan'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
