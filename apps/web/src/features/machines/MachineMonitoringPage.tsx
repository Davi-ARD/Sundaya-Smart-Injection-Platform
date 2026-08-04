import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Activity, Gauge } from 'lucide-react'
import {
  DowntimeReason,
  MachineOperationalStatus,
  type CreateOperationalDataRequest,
  type Machine,
  type MachineMetrics,
} from '@mold-tracker/shared'
import { useAuth } from '../auth/authContextValue'
import { api } from '../../lib/api'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card, StatCard } from '../../components/ui/Card'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { MachineOperationalStatusBadge, machineOperationalStatusLabel } from '../../components/ui/Badge'
import { SidePanel } from '../../components/ui/SidePanel'
import { TableSkeleton } from '../../components/ui/Skeleton'
import { SelectField, TextAreaField, TextField, FieldGroup } from '../../components/ui/FormField'
import { useToast } from '../../components/ui/Toast'
import { errorMessage } from '../../lib/errorMessage'

const downtimeReasonLabel: Record<DowntimeReason, string> = {
  [DowntimeReason.BREAKDOWN]: 'Kerusakan (Breakdown)',
  [DowntimeReason.SETUP_ADJUSTMENT]: 'Setup & Penyesuaian',
  [DowntimeReason.MINOR_STOP]: 'Minor Stop',
  [DowntimeReason.REDUCED_SPEED]: 'Kecepatan Berkurang',
  [DowntimeReason.STARTUP_REJECT]: 'Reject Saat Startup',
  [DowntimeReason.PRODUCTION_REJECT]: 'Reject Produksi',
}

const operationalStatusOptions = Object.values(MachineOperationalStatus).map((status) => ({
  value: status,
  label: machineOperationalStatusLabel[status],
}))

const downtimeReasonOptions: { value: DowntimeReason | ''; label: string }[] = [
  { value: '', label: '— pilih alasan —' },
  ...Object.values(DowntimeReason).map((reason) => ({ value: reason, label: downtimeReasonLabel[reason] })),
]

type OperationalFormState = {
  status: MachineOperationalStatus
  downtimeReason: DowntimeReason | ''
  cycleTimeSec: string
  occurredAt: string
  catatan: string
}

const nowForInput = () => new Date().toISOString().slice(0, 16)

const emptyOperationalForm: OperationalFormState = {
  status: MachineOperationalStatus.RUNNING,
  downtimeReason: '',
  cycleTimeSec: '',
  occurredAt: nowForInput(),
  catatan: '',
}

type PanelState = { mode: 'operational'; machine: Machine } | { mode: 'metrics'; machine: Machine }

// Machine Monitoring (staf Sundaya): status realtime mesin (Layer 1). CRUD
// master mesin ada di halaman terpisah "Kelola Mesin", maintenance di halaman
// "Maintenance" tersendiri.
export function MachineMonitoringPage() {
  const { accessToken } = useAuth()
  const toast = useToast()

  const [machines, setMachines] = useState<Machine[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [panel, setPanel] = useState<PanelState | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      setMachines(await api.listMachines(accessToken))
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal memuat mesin'))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, toast])

  useEffect(() => {
    void load()
  }, [load])

  const columns: Column<Machine>[] = [
    { header: 'No. Mesin', cell: (m) => <span className="font-semibold text-slate-800">{m.machineNumber}</span> },
    { header: 'Status Realtime', cell: (m) => <MachineOperationalStatusBadge status={m.operationalStatus} /> },
    {
      header: '',
      className: 'text-right',
      cell: (m) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => setPanel({ mode: 'metrics', machine: m })}>
            <Gauge className="h-4 w-4" /> Metrik
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setPanel({ mode: 'operational', machine: m })}>
            <Activity className="h-4 w-4" /> Input Status
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6">
      <PageHeader
        breadcrumb={[{ label: 'Beranda', to: '/staff' }, { label: 'Machine Monitoring' }]}
        title="Machine Monitoring"
        description="Status operasional realtime (Layer 1) mesin."
      />

      <Card title="Status realtime mesin">
        {isLoading ? (
          <TableSkeleton rows={4} columns={3} />
        ) : machines.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">Belum ada mesin terdaftar.</p>
        ) : (
          <DataTable columns={columns} rows={machines} rowKey={(m) => m.id} />
        )}
      </Card>

      {panel?.mode === 'operational' ? (
        <OperationalFormPanel
          machine={panel.machine}
          onClose={() => setPanel(null)}
          onSaved={() => {
            setPanel(null)
            void load()
          }}
        />
      ) : null}

      {panel?.mode === 'metrics' ? (
        <MetricsPanel machine={panel.machine} onClose={() => setPanel(null)} />
      ) : null}
    </div>
  )
}

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
  const [form, setForm] = useState<OperationalFormState>(emptyOperationalForm)
  const [isSaving, setIsSaving] = useState(false)

  const isRunning = form.status === MachineOperationalStatus.RUNNING

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!isRunning && !form.downtimeReason) {
      toast.error('Alasan downtime wajib diisi untuk status non-Running')
      return
    }
    setIsSaving(true)
    try {
      const body: CreateOperationalDataRequest = {
        status: form.status,
        downtimeReason: isRunning ? undefined : (form.downtimeReason as DowntimeReason),
        cycleTimeSec: form.cycleTimeSec.trim() === '' ? undefined : Number(form.cycleTimeSec),
        occurredAt: new Date(form.occurredAt).toISOString(),
        catatan: form.catatan.trim() === '' ? undefined : form.catatan.trim(),
      }
      await api.addOperationalData(accessToken, machine.id, body)
      toast.success('Status operasional dicatat')
      onSaved()
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal mencatat status operasional'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SidePanel
      title={`Input status - ${machine.machineNumber}`}
      subtitle="Layer 1: status realtime mesin, append-only (koreksi lewat event baru)."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <SelectField
          label="Status"
          value={form.status}
          onChange={(value) =>
            setForm((f) => ({
              ...f,
              status: value,
              downtimeReason: value === MachineOperationalStatus.RUNNING ? '' : f.downtimeReason,
            }))
          }
          options={operationalStatusOptions}
        />
        {!isRunning ? (
          <SelectField
            label="Alasan downtime"
            value={form.downtimeReason}
            onChange={(value) => setForm((f) => ({ ...f, downtimeReason: value }))}
            options={downtimeReasonOptions}
          />
        ) : null}
        <FieldGroup>
          <TextField
            label="Cycle time (detik)"
            type="number"
            min={0}
            step="0.1"
            required={false}
            value={form.cycleTimeSec}
            onChange={(value) => setForm((f) => ({ ...f, cycleTimeSec: value }))}
          />
          <TextField
            label="Waktu kejadian"
            type="datetime-local"
            value={form.occurredAt}
            onChange={(value) => setForm((f) => ({ ...f, occurredAt: value }))}
          />
        </FieldGroup>
        <TextAreaField
          label="Catatan"
          value={form.catatan}
          onChange={(value) => setForm((f) => ({ ...f, catatan: value }))}
        />

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

function MetricsPanel({ machine, onClose }: { machine: Machine; onClose: () => void }) {
  const { accessToken } = useAuth()
  const toast = useToast()
  const [metrics, setMetrics] = useState<MachineMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    api
      .getMachineMetrics(accessToken, machine.id)
      .then((data) => {
        if (!cancelled) setMetrics(data)
      })
      .catch((caught) => {
        if (!cancelled) toast.error(errorMessage(caught, 'Gagal memuat metrik mesin'))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, machine.id])

  return (
    <SidePanel
      title={`Metrik - ${machine.machineNumber}`}
      subtitle="Dihitung dari event status realtime (Layer 1), bukan input manual."
      onClose={onClose}
    >
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : metrics ? (
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="OEE" value={`${metrics.oee}%`} tone="brand" />
          <StatCard label="Utilization" value={`${metrics.utilization}%`} tone="brand" />
          <StatCard label="Availability" value={`${metrics.availability}%`} tone="emerald" />
          <StatCard label="Performance" value={`${metrics.performance}%`} tone="emerald" />
          <StatCard label="Quality" value={`${metrics.quality}%`} tone="emerald" />
          <StatCard label="Total Downtime" value={`${metrics.totalDowntimeHours} jam`} tone="rose" />
          <StatCard label="MTBF" value={`${metrics.mtbfHours} jam`} tone="slate" />
          <StatCard label="MTTR" value={`${metrics.mttrHours} jam`} tone="slate" />
        </div>
      ) : (
        <p className="text-sm text-slate-500">Metrik tidak tersedia.</p>
      )}
    </SidePanel>
  )
}
