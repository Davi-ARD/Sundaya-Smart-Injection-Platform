import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Archive, ArchiveRestore, Factory, Pencil, Plus } from 'lucide-react'
import {
  type CreateMachineRequest,
  type Machine,
  type UpdateMachineRequest,
} from '@mold-tracker/shared'
import { useAuth } from '../auth/authContextValue'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { MachineStatusBadge, WarrantyStatusBadge } from '../../components/ui/Badge'
import { SidePanel } from '../../components/ui/SidePanel'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { TableSkeleton } from '../../components/ui/Skeleton'
import { TextField, FieldGroup } from '../../components/ui/FormField'
import { useToast } from '../../components/ui/Toast'
import { errorMessage } from '../../lib/errorMessage'

type MachineFormState = {
  machineNumber: string
  spesifikasi: string
  tonaseTon: string
  standardRatio: string
  warrantyStart: string
  warrantyDurationMonths: string
}

const emptyMachineForm: MachineFormState = {
  machineNumber: '',
  spesifikasi: '',
  tonaseTon: '',
  standardRatio: '',
  warrantyStart: '',
  warrantyDurationMonths: '',
}

const formFromMachine = (m: Machine): MachineFormState => ({
  machineNumber: m.machineNumber,
  spesifikasi: m.spesifikasi,
  tonaseTon: String(m.tonaseTon),
  standardRatio: String(m.standardRatio),
  warrantyStart: m.warrantyStart.slice(0, 10),
  warrantyDurationMonths: String(m.warrantyDurationMonths),
})

type PanelState = { mode: 'create' } | { mode: 'edit'; machine: Machine }

// Kelola Mesin (master data, ADMIN_SUNDAYA). CRUD + arsip mesin. Sumbu status
// (ketersediaan & operationalStatus) tidak diubah lewat form ini, hanya lewat
// lifecycle job dan input Layer 1 (lihat halaman Machine Monitoring).
export function MachinesPage() {
  const { accessToken } = useAuth()
  const toast = useToast()

  const [machines, setMachines] = useState<Machine[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)
  const [panel, setPanel] = useState<PanelState | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<Machine | null>(null)

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

  const columns: Column<Machine>[] = [
    { header: 'No. Mesin', cell: (m) => <span className="font-semibold text-slate-800">{m.machineNumber}</span> },
    { header: 'Spesifikasi', cell: (m) => m.spesifikasi },
    { header: 'Tonase', cell: (m) => `${m.tonaseTon} ton` },
    { header: 'Ketersediaan', cell: (m) => <MachineStatusBadge status={m.status} /> },
    { header: 'Garansi', cell: (m) => <WarrantyStatusBadge status={m.warrantyStatus} /> },
    {
      header: '',
      className: 'text-right',
      cell: (m) => {
        return (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" onClick={() => setPanel({ mode: 'edit', machine: m })}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setArchiveTarget(m)}>
              {m.isArchived ? (
                <>
                  <ArchiveRestore className="h-4 w-4" /> Aktifkan
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4" /> Arsip
                </>
              )}
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="mx-auto max-w-screen-2xl">
      <PageHeader
        breadcrumb={[{ label: 'Beranda', to: '/staff' }, { label: 'Kelola Mesin' }]}
        title="Kelola Mesin"
        description="Master mesin Sundaya dan status ketersediaan."
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Tampilkan arsip
            </label>
            <Button onClick={() => setPanel({ mode: 'create' })}>
              <Plus className="h-5 w-5" /> Tambah mesin
            </Button>
          </>
        }
      />

      <Card>
        {isLoading ? (
          <TableSkeleton rows={5} columns={6} />
        ) : machines.length === 0 ? (
          <div className="grid place-items-center py-14 text-center">
            <span className="grid h-12 w-12 place-items-center text-brand-700">
              <Factory className="h-7 w-7" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-800">Belum ada mesin</p>
            <p className="mt-1 text-sm text-slate-500">
              {showArchived ? 'Tidak ada mesin yang diarsipkan.' : 'Tambahkan mesin pertama untuk mulai.'}
            </p>
          </div>
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
                standardRatio: Number(form.standardRatio),
                warrantyStart: form.warrantyStart,
                warrantyDurationMonths: Number(form.warrantyDurationMonths),
              }
              await api.updateMachine(accessToken, panel.machine.id, body)
            } else {
              const body: CreateMachineRequest = {
                machineNumber: form.machineNumber.trim(),
                spesifikasi: form.spesifikasi,
                tonaseTon: Number(form.tonaseTon),
                standardRatio: Number(form.standardRatio),
                warrantyStart: form.warrantyStart,
                warrantyDurationMonths: Number(form.warrantyDurationMonths),
              }
              await api.createMachine(accessToken, body)
            }
          }}
        />
      ) : null}

      {archiveTarget ? (
        <ConfirmDialog
          title={archiveTarget.isArchived ? 'Aktifkan mesin' : 'Arsipkan mesin'}
          message={
            archiveTarget.isArchived
              ? `Mesin ${archiveTarget.machineNumber} akan muncul kembali di daftar aktif.`
              : `Mesin ${archiveTarget.machineNumber} akan disembunyikan dari daftar aktif. Data dan relasi tetap tersimpan.`
          }
          confirmLabel={archiveTarget.isArchived ? 'Aktifkan' : 'Arsipkan'}
          tone={archiveTarget.isArchived ? 'primary' : 'warning'}
          onCancel={() => setArchiveTarget(null)}
          onConfirm={async () => {
            try {
              if (archiveTarget.isArchived) {
                await api.unarchiveMachine(accessToken, archiveTarget.id)
                toast.success('Mesin diaktifkan kembali')
              } else {
                await api.archiveMachine(accessToken, archiveTarget.id)
                toast.success('Mesin diarsipkan')
              }
              setArchiveTarget(null)
              void load()
            } catch (caught) {
              toast.error(errorMessage(caught, 'Gagal memproses mesin'))
            }
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
  initial: MachineFormState
  isEdit: boolean
  onClose: () => void
  onSaved: () => void
  save: (form: MachineFormState) => Promise<void>
}) {
  const toast = useToast()
  const [form, setForm] = useState<MachineFormState>(initial)
  const [isSaving, setIsSaving] = useState(false)

  const set = (key: keyof MachineFormState) => (value: string) => setForm((f) => ({ ...f, [key]: value }))

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
      subtitle={isEdit ? 'Nomor mesin tidak dapat diubah.' : 'Mesin baru berstatus Tersedia.'}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isEdit ? (
          <TextField label="No. Mesin" value={form.machineNumber} onChange={set('machineNumber')} />
        ) : null}
        <TextField label="Spesifikasi" value={form.spesifikasi} onChange={set('spesifikasi')} />
        <FieldGroup>
          <TextField label="Tonase (ton)" type="number" min={1} value={form.tonaseTon} onChange={set('tonaseTon')} />
          <TextField
            label="Standard ratio"
            type="number"
            min={0}
            step="0.01"
            value={form.standardRatio}
            onChange={set('standardRatio')}
          />
        </FieldGroup>
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
