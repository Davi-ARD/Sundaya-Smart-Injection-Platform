import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Archive, ArchiveRestore, Factory, Gauge, Pencil, Plus } from 'lucide-react'
import {
  MachineOperationalStatus,
  Role,
  TEKNISI_INPUT_STATUS,
  hmsToSeconds,
  type CreateMachineRequest,
  type CreateOperationalDataRequest,
  type Machine,
  type UpdateMachineRequest,
} from '@mold-tracker/shared'
import { useAuth } from '../auth/authContextValue'
import { api } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/PageHeader'
import { Card } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import {
  MachineOperationalBadge,
  MachineStatusBadge,
  WarrantyStatusBadge,
  machineOperationalLabel,
} from '../../components/ui/Badge'
import { SidePanel } from '../../components/ui/SidePanel'
import { TableSkeleton } from '../../components/ui/Skeleton'
import { FieldGroup, SelectField, TextAreaField, TextField } from '../../components/ui/FormField'
import { useToast } from '../../components/ui/Toast'
import { errorMessage } from '../../lib/errorMessage'
import { formatDate, nowLocalInput } from '../../lib/format'


// Nomor mesin tidak ada di form: digenerate server berpola IM-001.
type MachineForm = {
  spesifikasi: string
  tonaseTon: string
  warrantyStart: string
  warrantyDurationMonths: string
}

const emptyMachineForm: MachineForm = {
  spesifikasi: '',
  tonaseTon: '',
  warrantyStart: '',
  warrantyDurationMonths: '',
}

const formFromMachine = (machine: Machine): MachineForm => ({
  spesifikasi: machine.spesifikasi,
  tonaseTon: String(machine.tonaseTon),
  warrantyStart: machine.warrantyStart.slice(0, 10),
  warrantyDurationMonths: String(machine.warrantyDurationMonths),
})

// Mesin (staf Sundaya). Dua sumbu status independen: status (ketersediaan,
// dikendalikan lifecycle job) dan operationalStatus (realtime Layer 1, Teknisi).
export function MachinesPage() {
  const { accessToken, user } = useAuth()
  const toast = useToast()
  const canManage = user?.role === Role.ADMIN_SUNDAYA
  const canInputOperational = user?.role === Role.TEKNISI_SUNDAYA

  const [machines, setMachines] = useState<Machine[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [panel, setPanel] = useState<{ mode: 'create' } | { mode: 'edit'; machine: Machine } | null>(null)
  const [operationalTarget, setOperationalTarget] = useState<Machine | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      setMachines(await api.listMachines(accessToken, { archived: showArchived }))
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal memuat mesin'))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, showArchived, toast])

  useEffect(() => {
    void load()
  }, [load])

  const toggleArchive = async (machine: Machine) => {
    try {
      if (machine.isArchived) {
        await api.unarchiveMachine(accessToken, machine.id)
        toast.success('Mesin dikembalikan dari arsip')
      } else {
        await api.archiveMachine(accessToken, machine.id)
        toast.success('Mesin diarsipkan')
      }
      void load()
    } catch (caught) {
      toast.error(errorMessage(caught, 'Aksi gagal'))
    }
  }

  const columns: Column<Machine>[] = [
    { header: 'No. Mesin', cell: (m) => <span className="font-semibold text-slate-900">{m.machineNumber}</span> },
    { header: 'Spesifikasi', cell: (m) => m.spesifikasi },
    { header: 'Tonase', cell: (m) => `${m.tonaseTon} ton` },
    { header: 'Ketersediaan', cell: (m) => <MachineStatusBadge status={m.status} /> },
    { header: 'Operasional', cell: (m) => <MachineOperationalBadge status={m.operationalStatus} /> },
    {
      header: 'Garansi',
      cell: (m) => (
        <div className="flex items-center gap-2">
          <WarrantyStatusBadge status={m.warrantyStatus} />
          <span className="text-xs text-slate-400">s.d. {formatDate(m.warrantyEnd)}</span>
        </div>
      ),
    },
    {
      header: '',
      className: 'text-right',
      cell: (m) => (
        <div className="flex justify-end gap-2">
          {canInputOperational ? (
            <Button size="sm" variant="secondary" onClick={() => setOperationalTarget(m)}>
              <Gauge className="h-3.5 w-3.5" /> Input status
            </Button>
          ) : null}
          {canManage ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => setPanel({ mode: 'edit', machine: m })}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void toggleArchive(m)}>
                {m.isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                {m.isArchived ? 'Aktifkan' : 'Arsipkan'}
              </Button>
            </>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumb={[{ label: 'Beranda', to: '/staff' }, { label: 'Kelola Mesin' }]}
        title="Kelola Mesin"
        description="Katalog mesin Sundaya beserta ketersediaan, status realtime, dan garansi."
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              Tampilkan arsip
            </label>
            {canManage ? (
              <Button onClick={() => setPanel({ mode: 'create' })}>
                <Plus className="h-5 w-5" /> Tambah mesin
              </Button>
            ) : null}
          </>
        }
      />

      <Card>
        {isLoading ? (
          <TableSkeleton rows={5} columns={6} />
        ) : machines.length === 0 ? (
          <EmptyState icon={Factory} title="Belum ada mesin" />
        ) : (
          <DataTable columns={columns} rows={machines} rowKey={(m) => m.id} />
        )}
      </Card>

      {panel ? (
        <MachineFormPanel
          key={panel.mode === 'edit' ? panel.machine.id : 'create'}
          initial={panel.mode === 'edit' ? formFromMachine(panel.machine) : emptyMachineForm}
          isEdit={panel.mode === 'edit'}
          onClose={() => setPanel(null)}
          onSaved={() => {
            setPanel(null)
            void load()
          }}
          save={async (form) => {
            if (panel.mode === 'edit') {
              const body: UpdateMachineRequest = {
                spesifikasi: form.spesifikasi,
                tonaseTon: Number(form.tonaseTon),
                warrantyStart: new Date(form.warrantyStart).toISOString(),
                warrantyDurationMonths: Number(form.warrantyDurationMonths),
              }
              await api.updateMachine(accessToken, panel.machine.id, body)
            } else {
              const body: CreateMachineRequest = {
                spesifikasi: form.spesifikasi,
                tonaseTon: Number(form.tonaseTon),
                warrantyStart: new Date(form.warrantyStart).toISOString(),
                warrantyDurationMonths: Number(form.warrantyDurationMonths),
              }
              await api.createMachine(accessToken, body)
            }
          }}
        />
      ) : null}

      {operationalTarget ? (
        <OperationalFormPanel
          machine={operationalTarget}
          onClose={() => setOperationalTarget(null)}
          onSaved={() => {
            setOperationalTarget(null)
            void load()
          }}
        />
      ) : null}
    </div>
  )
}

function MachineFormPanel({
  initial,
  isEdit,
  onClose,
  onSaved,
  save,
}: {
  initial: MachineForm
  isEdit: boolean
  onClose: () => void
  onSaved: () => void
  save: (form: MachineForm) => Promise<void>
}) {
  const toast = useToast()
  const [form, setForm] = useState<MachineForm>(initial)
  const [isSaving, setIsSaving] = useState(false)

  const set = (key: keyof MachineForm) => (value: string) => setForm((f) => ({ ...f, [key]: value }))

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      await save(form)
      toast.success(isEdit ? 'Mesin diperbarui' : 'Mesin ditambahkan')
      onSaved()
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal menyimpan mesin'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SidePanel
      title={isEdit ? 'Edit mesin' : 'Tambah mesin'}
      subtitle={
        isEdit
          ? 'Nomor mesin tidak dapat diubah.'
          : 'Nomor mesin dibuat otomatis. Mesin baru berstatus Tersedia dan Standby.'
      }
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField label="Spesifikasi" value={form.spesifikasi} onChange={set('spesifikasi')} />
        <TextField
          label="Tonase mesin (ton)"
          type="number"
          min={1}
          value={form.tonaseTon}
          onChange={set('tonaseTon')}
        />
        <p className="-mt-2 text-xs leading-5 text-slate-500">
          Clamping force mesin. Mesin ini hanya bisa menjalankan cetakan dengan tonase sama atau
          lebih kecil.
        </p>
        <FieldGroup>
          <TextField label="Mulai garansi" type="date" value={form.warrantyStart} onChange={set('warrantyStart')} />
          <TextField
            label="Durasi garansi (bulan)"
            type="number"
            min={1}
            value={form.warrantyDurationMonths}
            onChange={set('warrantyDurationMonths')}
          />
        </FieldGroup>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </div>
      </form>
    </SidePanel>
  )
}

// Input status realtime (Layer 1, Teknisi). Pilihan status hanya Setup dan
// Running: Standby cuma status awal mesin baru, Maintenance disetel otomatis
// oleh modul Maintenance. Cycle time diinput jam + menit + detik, dikirim ke
// server sebagai total detik.
function OperationalFormPanel({
  machine,
  onClose,
  onSaved,
}: {
  machine: Machine
  onClose: () => void
  onSaved: () => void
}) {
  const { accessToken } = useAuth()
  const toast = useToast()
  const [status, setStatus] = useState<MachineOperationalStatus>(MachineOperationalStatus.RUNNING)
  const [jam, setJam] = useState('')
  const [menit, setMenit] = useState('')
  const [detik, setDetik] = useState('')
  const [occurredAt, setOccurredAt] = useState(nowLocalInput())
  const [catatan, setCatatan] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const totalDetik = hmsToSeconds(Number(jam || 0), Number(menit || 0), Number(detik || 0))

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      const body: CreateOperationalDataRequest = {
        status,
        cycleTimeSec: totalDetik > 0 ? totalDetik : undefined,
        occurredAt: new Date(occurredAt).toISOString(),
        catatan: catatan.trim() === '' ? undefined : catatan.trim(),
      }
      await api.addOperationalData(accessToken, machine.id, body)
      toast.success('Status mesin dicatat')
      onSaved()
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal mencatat status'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SidePanel
      title={`Input status - ${machine.machineNumber}`}
      subtitle="Event realtime Layer 1, append-only. Koreksi lewat event baru."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <SelectField
          label="Status"
          value={status}
          onChange={setStatus}
          options={TEKNISI_INPUT_STATUS.map((value) => ({
            value,
            label: machineOperationalLabel[value],
          }))}
        />
        <TextField
          label="Waktu kejadian"
          type="datetime-local"
          value={occurredAt}
          onChange={setOccurredAt}
          max={nowLocalInput()}
        />

        <div>
          <p className="text-sm font-medium text-slate-700">Cycle time</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Durasi satu siklus molding penuh: tutup mold, injeksi, pendinginan, sampai eject.
            Dibandingkan dengan cycle time ideal untuk menghitung Performance pada OEE.
          </p>
          <div className="mt-2 grid grid-cols-3 gap-3">
            <TextField label="Jam" type="number" min={0} required={false} value={jam} onChange={setJam} />
            <TextField label="Menit" type="number" min={0} max={59} required={false} value={menit} onChange={setMenit} />
            <TextField label="Detik" type="number" min={0} step="0.1" required={false} value={detik} onChange={setDetik} />
          </div>
        </div>

        <TextAreaField label="Catatan" value={catatan} onChange={setCatatan} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Menyimpan...' : 'Catat status'}
          </Button>
        </div>
      </form>
    </SidePanel>
  )
}
