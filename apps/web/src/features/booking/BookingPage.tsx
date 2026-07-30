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
import { ExtensionStatusBadge, JobLifecycleBadge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { SidePanel } from '../../components/ui/SidePanel'
import { TableSkeleton } from '../../components/ui/Skeleton'
import { FieldGroup, SelectField, TextField } from '../../components/ui/FormField'
import { useToast } from '../../components/ui/Toast'
import { errorMessage } from '../../lib/errorMessage'
import { optionalNumber, optionalText } from '../../lib/form'
import { formatDate } from '../../lib/format'

// Input <input type="date"> memberi 'YYYY-MM-DD'; backend menerima ISO string.
const toIso = (date: string) => new Date(`${date}T00:00:00`).toISOString()

type FormState = {
  moldId: string
  requestedDurationDays: string
  destinationLocation: string
  startDate: string
  planMaterialUtama: string
  estimasiMaterialKg: string
  materialTambahan: string
  targetOutput: string
}

const emptyForm: FormState = {
  moldId: '',
  requestedDurationDays: '30',
  destinationLocation: '',
  startDate: '',
  planMaterialUtama: '',
  estimasiMaterialKg: '',
  materialTambahan: '',
  targetOutput: '',
}

// Booking mesin (Manager Penyewa). Booking memilih cetakan dan rencana, TANPA
// memilih mesin: mesin di-assign Admin Sundaya setelah booking disetujui.
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

  const moldById = useMemo(() => new Map(molds.map((m) => [m.id, m])), [molds])
  // Satu cetakan hanya boleh satu job, jadi cetakan yang sudah dibooking tidak
  // ditawarkan lagi (server tetap menolak dengan 409 bila dipaksa).
  const availableMolds = useMemo(() => {
    const booked = new Set(jobs.map((job) => job.moldId))
    return molds.filter((mold) => !booked.has(mold.id))
  }, [jobs, molds])

  const columns: Column<Job>[] = [
    { header: 'No. Job', cell: (j) => <span className="font-semibold text-slate-900">{j.jobNumber}</span> },
    {
      header: 'Cetakan',
      cell: (j) => {
        const mold = moldById.get(j.moldId)
        return mold ? `${mold.kodeMold} - ${mold.namaProduk}` : <span className="text-slate-400">-</span>
      },
    },
    { header: 'Status', cell: (j) => <JobLifecycleBadge status={j.lifecycle} /> },
    {
      header: 'Mesin',
      cell: (j) =>
        j.machineNumber ?? <span className="text-slate-400">Menunggu assign</span>,
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
            Ajukan booking cetakan beserta rencana material dan waktu sewa.
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
          <div className="grid place-items-center py-14 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <CalendarPlus className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-800">Belum ada booking</p>
            <p className="mt-1 text-sm text-slate-500">
              {molds.length === 0
                ? 'Tambahkan cetakan terlebih dahulu di halaman Cetakan.'
                : 'Ajukan booking pertama untuk cetakan Anda.'}
            </p>
          </div>
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
              moldId: form.moldId,
              requestedDurationDays: Number(form.requestedDurationDays),
              destinationLocation: form.destinationLocation.trim(),
              startDate: toIso(form.startDate),
              planMaterialUtama: optionalText(form.planMaterialUtama),
              estimasiMaterialKg: optionalNumber(form.estimasiMaterialKg),
              materialTambahan: optionalText(form.materialTambahan),
              targetOutput: optionalNumber(form.targetOutput),
            }
            await api.createJob(accessToken, body)
          }}
        />
      ) : null}
    </div>
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
      await api.requestExtension(accessToken, job.id, { additionalDays: Number(additionalDays) })
      toast.success('Pengajuan perpanjangan dikirim ke Sundaya')
      onSaved()
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal mengajukan perpanjangan'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal title={`Perpanjangan sewa ${job.jobNumber}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-500">
          Sewa berakhir {formatDate(job.endDate)}. Tambahan hari dihitung dari tanggal tersebut
          setelah Admin Sundaya menyetujui.
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
          <Button type="submit" disabled={isSaving || Number(additionalDays) < 1}>
            {isSaving ? 'Mengirim...' : 'Ajukan perpanjangan'}
          </Button>
        </div>
      </form>
    </Modal>
  )
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
  // Prefill rencana material dari cetakan terpilih: rencana hanya diisi sekali.
  const [form, setForm] = useState<FormState>({ ...emptyForm, moldId: molds[0]?.id ?? '' })
  const [isSaving, setIsSaving] = useState(false)

  const set = (key: keyof FormState) => (value: string) => setForm((f) => ({ ...f, [key]: value }))

  const selectMold = (moldId: string) => {
    const mold = molds.find((m) => m.id === moldId)
    setForm((f) => ({
      ...f,
      moldId,
      planMaterialUtama: mold?.planMaterialUtama ?? f.planMaterialUtama,
      estimasiMaterialKg: mold?.estimasiKg != null ? String(mold.estimasiKg) : f.estimasiMaterialKg,
      targetOutput: mold?.targetOutput != null ? String(mold.targetOutput) : f.targetOutput,
    }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
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
      subtitle="Mesin ditentukan Sundaya setelah booking disetujui."
      onClose={onClose}
    >
      {molds.length === 0 ? (
        <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-600/15">
          Semua cetakan sudah dibooking. Tambahkan cetakan baru di halaman Cetakan terlebih dahulu.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <SelectField
            label="Cetakan"
            value={form.moldId}
            onChange={selectMold}
            options={molds.map((mold) => ({
              value: mold.id,
              label: `${mold.kodeMold} - ${mold.namaProduk} (${mold.tonaseTon} ton)`,
            }))}
          />

          <FieldGroup>
            <TextField
              label="Durasi sewa (hari)"
              type="number"
              min={1}
              value={form.requestedDurationDays}
              onChange={set('requestedDurationDays')}
            />
            <TextField label="Rencana mulai" type="date" value={form.startDate} onChange={set('startDate')} />
          </FieldGroup>

          <TextField
            label="Lokasi tujuan"
            value={form.destinationLocation}
            onChange={set('destinationLocation')}
          />

          <div className="flex items-start gap-2 rounded-lg bg-brand-50/70 px-3 py-2.5 text-xs leading-5 text-brand-900 ring-1 ring-inset ring-brand-600/10">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Rencana kirim cetakan dan material dicatat terpisah di tab Log Pengiriman setelah
            booking dibuat.
          </div>

          <TextField
            label="Material utama (rencana)"
            required={false}
            value={form.planMaterialUtama}
            onChange={set('planMaterialUtama')}
          />
          <FieldGroup>
            <TextField
              label="Estimasi material (kg)"
              type="number"
              min={0}
              step="0.1"
              required={false}
              value={form.estimasiMaterialKg}
              onChange={set('estimasiMaterialKg')}
            />
            <TextField
              label="Target output"
              type="number"
              min={0}
              required={false}
              value={form.targetOutput}
              onChange={set('targetOutput')}
            />
          </FieldGroup>
          <TextField
            label="Material tambahan"
            required={false}
            value={form.materialTambahan}
            onChange={set('materialTambahan')}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Mengirim...' : 'Ajukan booking'}
            </Button>
          </div>
        </form>
      )}
    </SidePanel>
  )
}
