import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Plus, Wrench } from 'lucide-react'
import {
  MaintenanceStatus,
  MaintenanceType,
  Role,
  type CreateMaintenanceRequest,
  type Machine,
  type Maintenance,
} from '@mold-tracker/shared'
import { useAuth } from '../auth/authContextValue'
import { api } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/PageHeader'
import { Card } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { EmptyState } from '../../components/ui/EmptyState'
import { MaintenanceStatusBadge } from '../../components/ui/Badge'
import { SidePanel } from '../../components/ui/SidePanel'
import { TableSkeleton } from '../../components/ui/Skeleton'
import { SelectField, TextAreaField, TextField } from '../../components/ui/FormField'
import { useToast } from '../../components/ui/Toast'
import { errorMessage } from '../../lib/errorMessage'
import { formatDateTime, nowLocalInput } from '../../lib/format'

const maintenanceTypeLabel: Record<MaintenanceType, string> = {
  [MaintenanceType.PREVENTIVE]: 'Preventive',
  [MaintenanceType.CORRECTIVE]: 'Corrective',
}

// Transisi linear TERJADWAL -> BERLANGSUNG -> SELESAI (cermin service, hanya
// untuk menentukan tombol lanjutan yang tampil).
const NEXT_STATUS: Record<MaintenanceStatus, MaintenanceStatus | null> = {
  [MaintenanceStatus.TERJADWAL]: MaintenanceStatus.BERLANGSUNG,
  [MaintenanceStatus.BERLANGSUNG]: MaintenanceStatus.SELESAI,
  [MaintenanceStatus.SELESAI]: null,
}


// Maintenance mesin (staf Sundaya). Teknisi menjadwalkan + eksekusi transisi;
// Admin Sundaya hanya membaca.
export function MaintenancePage() {
  const { accessToken, user } = useAuth()
  const toast = useToast()
  const canWrite = user?.role === Role.TEKNISI_SUNDAYA

  const [records, setRecords] = useState<Maintenance[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [list, machineList] = await Promise.all([
        api.listMaintenance(accessToken),
        api.listMachines(accessToken),
      ])
      setRecords(list)
      setMachines(machineList)
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal memuat maintenance'))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, toast])

  useEffect(() => {
    void load()
  }, [load])

  const machineById = useMemo(() => new Map(machines.map((m) => [m.id, m])), [machines])

  const advance = async (record: Maintenance) => {
    const next = NEXT_STATUS[record.status]
    if (!next) return
    setPendingId(record.id)
    try {
      await api.updateMaintenanceStatus(accessToken, record.id, { status: next })
      toast.success(`Status diperbarui ke ${next}`)
      void load()
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal memperbarui status'))
    } finally {
      setPendingId(null)
    }
  }

  const columns: Column<Maintenance>[] = [
    {
      header: 'Mesin',
      cell: (r) => machineById.get(r.machineId)?.machineNumber ?? <span className="text-slate-400">-</span>,
    },
    { header: 'Jenis', cell: (r) => maintenanceTypeLabel[r.type] },
    { header: 'Jadwal', cell: (r) => formatDateTime(r.scheduledAt) },
    { header: 'Status', cell: (r) => <MaintenanceStatusBadge status={r.status} /> },
    { header: 'Catatan', cell: (r) => r.notes ?? <span className="text-slate-400">-</span> },
    {
      header: '',
      className: 'text-right',
      cell: (r) =>
        canWrite && NEXT_STATUS[r.status] ? (
          <Button size="sm" variant="secondary" disabled={pendingId === r.id} onClick={() => void advance(r)}>
            Lanjut ke {NEXT_STATUS[r.status]}
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        breadcrumb={[{ label: 'Beranda', to: '/staff' }, { label: 'Maintenance' }]}
        title="Maintenance"
        description="Jadwalkan dan eksekusi maintenance mesin."
        actions={
          canWrite ? (
            <Button onClick={() => setIsPanelOpen(true)}>
              <Plus className="h-5 w-5" /> Jadwalkan maintenance
            </Button>
          ) : null
        }
      />

      <Card>
        {isLoading ? (
          <TableSkeleton rows={4} columns={5} />
        ) : records.length === 0 ? (
          <EmptyState icon={Wrench} title="Belum ada maintenance" />
        ) : (
          <DataTable columns={columns} rows={records} rowKey={(r) => r.id} />
        )}
      </Card>

      {isPanelOpen ? (
        <MaintenanceFormPanel
          machines={machines}
          onClose={() => setIsPanelOpen(false)}
          onSaved={() => {
            setIsPanelOpen(false)
            void load()
          }}
        />
      ) : null}
    </div>
  )
}

function MaintenanceFormPanel({
  machines,
  onClose,
  onSaved,
}: {
  machines: Machine[]
  onClose: () => void
  onSaved: () => void
}) {
  const { accessToken } = useAuth()
  const toast = useToast()
  const [machineId, setMachineId] = useState(machines[0]?.id ?? '')
  const [type, setType] = useState<MaintenanceType>(MaintenanceType.PREVENTIVE)
  const [scheduledAt, setScheduledAt] = useState(nowLocalInput())
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      const body: CreateMaintenanceRequest = {
        machineId,
        type,
        scheduledAt: new Date(scheduledAt).toISOString(),
        notes: notes.trim() === '' ? undefined : notes.trim(),
      }
      await api.createMaintenance(accessToken, body)
      toast.success('Maintenance dijadwalkan')
      onSaved()
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal menjadwalkan maintenance'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SidePanel title="Jadwalkan maintenance" subtitle="Status awal Terjadwal." onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <SelectField
          label="Mesin"
          value={machineId}
          onChange={setMachineId}
          options={machines.map((m) => ({ value: m.id, label: m.machineNumber }))}
        />
        <SelectField
          label="Jenis"
          value={type}
          onChange={setType}
          options={Object.values(MaintenanceType).map((value) => ({
            value,
            label: maintenanceTypeLabel[value],
          }))}
        />
        <TextField label="Jadwal" type="datetime-local" value={scheduledAt} onChange={setScheduledAt} />
        <TextAreaField label="Catatan" value={notes} onChange={setNotes} />

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={isSaving || !machineId}>
            {isSaving ? 'Menyimpan...' : 'Jadwalkan'}
          </Button>
        </div>
      </form>
    </SidePanel>
  )
}
