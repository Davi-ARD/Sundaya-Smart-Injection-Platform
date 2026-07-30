import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { CalendarClock, CheckCircle2, Factory, TimerReset, Trash2, XCircle } from 'lucide-react'
import {
  ExtensionStatus,
  JobLifecycle,
  MachineStatus,
  Role,
  type AssignJobRequest,
  type ExtensionRequestRow,
  type Job,
  type Machine,
  type RejectJobRequest,
} from '@mold-tracker/shared'
import { useAuth } from '../auth/authContextValue'
import { api } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { ExtensionStatusBadge, JobLifecycleBadge } from '../../components/ui/Badge'
import { TableSkeleton } from '../../components/ui/Skeleton'
import { Modal } from '../../components/ui/Modal'
import { SelectField, TextAreaField } from '../../components/ui/FormField'
import { useToast } from '../../components/ui/Toast'
import { errorMessage } from '../../lib/errorMessage'
import { formatDate, formatSisaHari } from '../../lib/format'

const ONGOING_LIFECYCLES = [
  JobLifecycle.DIKONFIRMASI,
  JobLifecycle.DIKIRIM,
  JobLifecycle.AKTIF,
  JobLifecycle.SELESAI_SEWA,
  JobLifecycle.DIKEMBALIKAN,
]

// Booking (staf Sundaya): approval booking baru, keputusan perpanjangan sewa,
// dan lifecycle job pasca-assign. Dipisah dari Dashboard supaya dashboard murni
// pemantauan. Teknisi melihat halaman yang sama persis, hanya tanpa tombol aksi
// karena semua keputusan booking adalah wewenang ADMIN_SUNDAYA.
export function SundayaBookingPage() {
  const { accessToken, user } = useAuth()
  const toast = useToast()
  const canManage = user?.role === Role.ADMIN_SUNDAYA

  const [jobs, setJobs] = useState<Job[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [extensions, setExtensions] = useState<ExtensionRequestRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [mesinTarget, setMesinTarget] = useState<Job | null>(null)
  const [rejectTarget, setRejectTarget] = useState<Job | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [jobList, machineList, extensionList] = await Promise.all([
        api.listJobs(accessToken),
        api.listMachines(accessToken, { status: MachineStatus.TERSEDIA }),
        api.listExtensions(accessToken),
      ])
      setJobs(jobList)
      setMachines(machineList)
      setExtensions(extensionList)
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal memuat booking'))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, toast])

  useEffect(() => {
    void load()
  }, [load])

  const pendingApproval = useMemo(() => jobs.filter((j) => j.lifecycle === JobLifecycle.DIAJUKAN), [jobs])
  const ongoingJobs = useMemo(() => jobs.filter((j) => ONGOING_LIFECYCLES.includes(j.lifecycle)), [jobs])
  const pendingExtensions = useMemo(
    () => extensions.filter((e) => e.status === ExtensionStatus.DIAJUKAN),
    [extensions],
  )
  const decidedExtensions = useMemo(
    () => extensions.filter((e) => e.status !== ExtensionStatus.DIAJUKAN),
    [extensions],
  )

  const runLifecycleAction = async (job: Job, action: (id: string) => Promise<Job>, successLabel: string) => {
    setPendingId(job.id)
    try {
      await action(job.id)
      toast.success(successLabel)
      void load()
    } catch (caught) {
      toast.error(errorMessage(caught, 'Aksi gagal'))
    } finally {
      setPendingId(null)
    }
  }

  const lifecycleAction = (job: Job): { label: string; run: () => void } | null => {
    switch (job.lifecycle) {
      case JobLifecycle.DIKONFIRMASI:
        return { label: 'Kirim mesin', run: () => void runLifecycleAction(job, (id) => api.shipJob(accessToken, id), 'Mesin dikirim') }
      case JobLifecycle.DIKIRIM:
        return { label: 'Aktifkan', run: () => void runLifecycleAction(job, (id) => api.activateJob(accessToken, id), 'Job aktif') }
      case JobLifecycle.AKTIF:
        return { label: 'Tandai selesai sewa', run: () => void runLifecycleAction(job, (id) => api.returnJob(accessToken, id), 'Selesai sewa') }
      case JobLifecycle.SELESAI_SEWA:
        return { label: 'Ambil mesin', run: () => void runLifecycleAction(job, (id) => api.collectJob(accessToken, id), 'Mesin dikembalikan') }
      case JobLifecycle.DIKEMBALIKAN:
        return { label: 'Selesaikan job', run: () => void runLifecycleAction(job, (id) => api.completeJob(accessToken, id), 'Job selesai') }
      default:
        return null
    }
  }

  const decideExtension = async (row: ExtensionRequestRow, decision: ExtensionStatus.DITERIMA | ExtensionStatus.DITOLAK) => {
    setPendingId(row.extensionId)
    try {
      await api.decideExtension(accessToken, row.extensionId, { decision })
      toast.success(
        decision === ExtensionStatus.DITERIMA
          ? `Perpanjangan ${row.jobNumber} disetujui, masa sewa bertambah ${row.additionalDays} hari`
          : `Perpanjangan ${row.jobNumber} ditolak`,
      )
      void load()
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal memproses perpanjangan'))
    } finally {
      setPendingId(null)
    }
  }

  const approvalColumns: Column<Job>[] = [
    { header: 'No. Job', cell: (j) => <span className="font-semibold text-slate-900">{j.jobNumber}</span> },
    {
      header: 'Cetakan',
      cell: (j) =>
        j.molds.length ? (
          <span className="flex flex-col gap-0.5 text-sm">
            {j.molds.map((m) => (
              <span key={m.moldId}>{m.kodeMold}</span>
            ))}
          </span>
        ) : (
          <span className="text-slate-400">-</span>
        ),
    },
    {
      header: 'Tonase cetakan',
      cell: (j) => (j.molds.length ? rentangTonase(j) : '-'),
    },
    { header: 'Mesin diminta', cell: (j) => `${j.requestedMachineCount} mesin` },
    { header: 'Mulai', cell: (j) => formatDate(j.startDate) },
    { header: 'Durasi', cell: (j) => `${j.requestedDurationDays} hari` },
    {
      header: '',
      className: 'text-right',
      cell: (j) =>
        canManage ? (
          <div className="flex justify-end gap-2">
            <Button size="sm" onClick={() => setMesinTarget(j)}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Setujui + pinjamkan mesin
            </Button>
            <Button size="sm" variant="danger" onClick={() => setRejectTarget(j)}>
              <XCircle className="h-3.5 w-3.5" /> Tolak
            </Button>
          </div>
        ) : (
          <JobLifecycleBadge status={j.lifecycle} />
        ),
    },
  ]

  const extensionColumns: Column<ExtensionRequestRow>[] = [
    { header: 'No. Job', cell: (e) => <span className="font-semibold text-slate-900">{e.jobNumber}</span> },
    { header: 'Penyewa', cell: (e) => e.companyName ?? <span className="text-slate-400">-</span> },
    { header: 'Cetakan', cell: (e) => e.moldKode },
    { header: 'Mesin', cell: (e) => e.machineNumber ?? <span className="text-slate-400">-</span> },
    {
      header: 'Sisa sewa',
      cell: (e) => (
        <span className={e.sisaHariSewa != null && e.sisaHariSewa <= 3 ? 'font-semibold text-amber-700' : undefined}>
          {formatSisaHari(e.sisaHariSewa)}
        </span>
      ),
    },
    { header: 'Tambahan', cell: (e) => `${e.additionalDays} hari` },
    { header: 'Diajukan', cell: (e) => formatDate(e.requestedAt) },
    {
      header: '',
      className: 'text-right',
      cell: (e) =>
        canManage ? (
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              disabled={pendingId === e.extensionId}
              onClick={() => void decideExtension(e, ExtensionStatus.DITERIMA)}
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Setujui
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={pendingId === e.extensionId}
              onClick={() => void decideExtension(e, ExtensionStatus.DITOLAK)}
            >
              <XCircle className="h-3.5 w-3.5" /> Tolak
            </Button>
          </div>
        ) : (
          <ExtensionStatusBadge status={e.status} />
        ),
    },
  ]

  const riwayatColumns: Column<ExtensionRequestRow>[] = [
    { header: 'No. Job', cell: (e) => <span className="font-semibold text-slate-900">{e.jobNumber}</span> },
    { header: 'Penyewa', cell: (e) => e.companyName ?? <span className="text-slate-400">-</span> },
    { header: 'Tambahan', cell: (e) => `${e.additionalDays} hari` },
    { header: 'Diajukan', cell: (e) => formatDate(e.requestedAt) },
    { header: 'Status', cell: (e) => <ExtensionStatusBadge status={e.status} /> },
  ]

  const ongoingColumns: Column<Job>[] = [
    { header: 'No. Job', cell: (j) => <span className="font-semibold text-slate-900">{j.jobNumber}</span> },
    {
      header: 'Cetakan',
      cell: (j) =>
        j.molds.length ? (
          <span className="flex flex-col gap-0.5 text-sm">
            {j.molds.map((m) => (
              <span key={m.moldId}>{m.kodeMold}</span>
            ))}
          </span>
        ) : (
          <span className="text-slate-400">-</span>
        ),
    },
    {
      header: 'Mesin',
      cell: (j) => (
        <span className="flex flex-col gap-0.5 text-sm">
          {j.machines.map((m) => (
            <span key={m.machineId}>{m.machineNumber}</span>
          ))}
          <span
            className={[
              'text-xs',
              j.machines.length < j.requestedMachineCount ? 'font-semibold text-amber-700' : 'text-slate-500',
            ].join(' ')}
          >
            {j.machines.length} dari {j.requestedMachineCount} diminta
          </span>
        </span>
      ),
    },
    { header: 'Status', cell: (j) => <JobLifecycleBadge status={j.lifecycle} /> },
    { header: 'Selesai sewa', cell: (j) => formatDate(j.endDate) },
    {
      header: '',
      className: 'text-right',
      cell: (j) => {
        if (!canManage) return null
        const action = lifecycleAction(j)
        return (
          <div className="flex justify-end gap-2">
            {/* Susunan mesin masih bisa diubah selama booking belum dikirim. */}
            {j.lifecycle === JobLifecycle.DIKONFIRMASI ? (
              <Button size="sm" variant="secondary" onClick={() => setMesinTarget(j)}>
                <Factory className="h-3.5 w-3.5" /> Atur mesin
              </Button>
            ) : null}
            {action ? (
              <Button size="sm" variant="secondary" disabled={pendingId === j.id} onClick={action.run}>
                {action.label}
              </Button>
            ) : null}
          </div>
        )
      },
    },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Booking</h1>
        <p className="mt-1 text-sm text-slate-500">
          Approval booking, peminjaman mesin, dan keputusan perpanjangan sewa. Penyewa meminta
          jumlah mesin; mesin mana yang dipinjamkan ditentukan di sini.
        </p>
      </div>

      <Card
        title="Menunggu approval"
        subtitle="Booking baru dari Manager Penyewa, belum dipinjami mesin."
      >
        {isLoading ? (
          <TableSkeleton rows={2} columns={6} />
        ) : pendingApproval.length === 0 ? (
          <div className="grid place-items-center py-10 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <CalendarClock className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-800">Tidak ada booking menunggu</p>
          </div>
        ) : (
          <DataTable columns={approvalColumns} rows={pendingApproval} rowKey={(j) => j.id} />
        )}
      </Card>

      <Card
        className="mt-5"
        title="Permintaan perpanjangan sewa"
        subtitle="Penyewa yang ingin menambah masa peminjaman mesin. Persetujuan langsung menggeser tanggal selesai sewa."
      >
        {isLoading ? (
          <TableSkeleton rows={2} columns={7} />
        ) : pendingExtensions.length === 0 ? (
          <div className="grid place-items-center py-10 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <TimerReset className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-800">Tidak ada permintaan perpanjangan</p>
            <p className="mt-1 text-sm text-slate-500">
              Permintaan muncul di sini begitu Manager Penyewa mengajukan tambahan hari sewa.
            </p>
          </div>
        ) : (
          <DataTable columns={extensionColumns} rows={pendingExtensions} rowKey={(e) => e.extensionId} />
        )}
      </Card>

      {decidedExtensions.length > 0 ? (
        <Card className="mt-5" title="Riwayat perpanjangan" subtitle="Keputusan yang sudah diambil.">
          <DataTable columns={riwayatColumns} rows={decidedExtensions} rowKey={(e) => e.extensionId} />
        </Card>
      ) : null}

      <Card className="mt-5" title="Job berjalan" subtitle="Rental management: lifecycle pasca-assign.">
        {isLoading ? (
          <TableSkeleton rows={3} columns={5} />
        ) : ongoingJobs.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">Belum ada job berjalan.</p>
        ) : (
          <DataTable columns={ongoingColumns} rows={ongoingJobs} rowKey={(j) => j.id} />
        )}
      </Card>

      {mesinTarget ? (
        <MesinModal
          job={mesinTarget}
          machines={machines}
          onClose={() => {
            setMesinTarget(null)
            void load()
          }}
        />
      ) : null}

      {rejectTarget ? (
        <RejectModal
          job={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onSaved={() => {
            setRejectTarget(null)
            void load()
          }}
        />
      ) : null}
    </div>
  )
}

// Rentang tonase cetakan di booking: mesin apa pun yang dipinjamkan harus setidaknya
// sanggup cetakan terkecil, dan butuh mesin sebesar yang terbesar supaya semua kebagian.
function rentangTonase(job: Job): string {
  const ton = job.molds.map((m) => m.tonaseTon)
  const min = Math.min(...ton)
  const max = Math.max(...ton)
  return min === max ? `${min} ton` : `${min} - ${max} ton`
}

// Peminjaman mesin: mesin masuk ke booking satu per satu sampai jumlah permintaan
// penyewa terpenuhi, dan bisa ditarik lagi selama booking belum dikirim. Mesin tidak
// dipasangkan ke cetakan; penyewa bebas menjalankan cetakan mana pun di mesin mana pun,
// dan pasangan sebenarnya tercatat di Log Produksi mereka.
function MesinModal({
  job,
  machines,
  onClose,
}: {
  job: Job
  machines: Machine[]
  onClose: () => void
}) {
  const { accessToken } = useAuth()
  const toast = useToast()
  const [current, setCurrent] = useState(job)
  const [isSaving, setIsSaving] = useState(false)

  const tonaseTerkecil = current.molds.length
    ? Math.min(...current.molds.map((m) => m.tonaseTon))
    : 0
  const dipinjam = new Set(current.machines.map((m) => m.machineId))
  // Mesin yang tidak sanggup cetakan terkecil pun tidak berguna untuk booking ini.
  const tersedia = machines.filter((m) => !dipinjam.has(m.id) && m.tonaseTon >= tonaseTerkecil)
  const [machineId, setMachineId] = useState('')
  // Daftar mesin tersedia berubah tiap kali satu dipinjamkan atau ditarik, jadi pilihan
  // dijatuhkan ke opsi pertama bila yang tersimpan sudah tidak ada di daftar. Tanpa ini
  // state bisa menunjuk mesin yang tidak lagi tampil di select.
  const mesinDipilih = tersedia.some((m) => m.id === machineId) ? machineId : (tersedia[0]?.id ?? '')
  const kurang = current.requestedMachineCount - current.machines.length

  const run = async (aksi: () => Promise<Job>, pesan: string) => {
    setIsSaving(true)
    try {
      const updated = await aksi()
      setCurrent(updated)
      toast.success(pesan)
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal memperbarui mesin booking'))
    } finally {
      setIsSaving(false)
    }
  }

  const tambah = (event: FormEvent) => {
    event.preventDefault()
    const body: AssignJobRequest = { machineId: mesinDipilih }
    void run(() => api.assignJob(accessToken, current.id, body), 'Mesin dipinjamkan')
  }

  return (
    <Modal title={`Mesin untuk ${current.jobNumber}`} onClose={onClose}>
      <div className="space-y-4">
        <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200/70">
          <DetailRow
            label="Cetakan"
            value={
              current.molds.length
                ? current.molds.map((m) => `${m.kodeMold} (${m.tonaseTon} ton)`).join(', ')
                : '-'
            }
          />
          <DetailRow
            label="Mesin diminta"
            value={`${current.requestedMachineCount} mesin, terpenuhi ${current.machines.length}`}
          />
          <DetailRow
            label="Periode"
            value={`${formatDate(current.startDate)} - ${current.requestedDurationDays} hari`}
          />
        </dl>

        {current.machines.length ? (
          <ul className="space-y-1.5">
            {current.machines.map((m) => (
              <li
                key={m.machineId}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-200/70 px-3 py-2"
              >
                <span className="text-sm">
                  <span className="font-semibold text-slate-900">{m.machineNumber}</span>
                  <span className="ml-2 text-slate-500">{m.tonaseTon} ton</span>
                </span>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={isSaving || current.machines.length === 1}
                  onClick={() =>
                    void run(
                      () => api.releaseJobMachine(accessToken, current.id, m.machineId),
                      `Mesin ${m.machineNumber} ditarik`,
                    )
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" /> Tarik
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Belum ada mesin dipinjamkan ke booking ini.</p>
        )}

        {kurang > 0 ? (
          <p className="text-xs text-amber-700">Masih kurang {kurang} mesin dari permintaan penyewa.</p>
        ) : null}

        {tersedia.length === 0 ? (
          <p className="text-sm text-rose-600">
            Tidak ada mesin tersedia lain dengan tonase minimal {tonaseTerkecil} ton.
          </p>
        ) : (
          <form onSubmit={tambah} className="space-y-3">
            <SelectField
              label="Pinjamkan mesin"
              value={mesinDipilih}
              onChange={setMachineId}
              options={tersedia.map((m) => ({
                value: m.id,
                label: `${m.machineNumber} (${m.tonaseTon} ton)`,
              }))}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={isSaving || !mesinDipilih}>
                {isSaving ? 'Memproses...' : 'Pinjamkan mesin'}
              </Button>
            </div>
          </form>
        )}

        <div className="flex justify-end border-t border-slate-100 pt-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Selesai
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-3 py-2">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-sm font-medium text-slate-900">{value}</dd>
    </div>
  )
}

function RejectModal({ job, onClose, onSaved }: { job: Job; onClose: () => void; onSaved: () => void }) {
  const { accessToken } = useAuth()
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      const body: RejectJobRequest = { reason: reason.trim() }
      await api.rejectJob(accessToken, job.id, body)
      toast.success('Booking ditolak')
      onSaved()
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal menolak booking'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal title={`Tolak ${job.jobNumber}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextAreaField label="Alasan penolakan" value={reason} onChange={setReason} required />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" variant="danger" disabled={isSaving || reason.trim() === ''}>
            {isSaving ? 'Memproses...' : 'Tolak booking'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
