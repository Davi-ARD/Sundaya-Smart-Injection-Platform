import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { errorMessage } from '../lib/errorMessage'
import { useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { MachineStatus } from '@mold-tracker/shared'
import type {
  ConditionCheck,
  CreateMachineRequest,
  Machine,
  MachineHistory,
  Rental,
  UpdateMachineRequest,
} from '@mold-tracker/shared'
import { useAuth } from '../features/auth/authContextValue'
import { api } from '../lib/api'
import { useToast } from '../components/ui/Toast'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { DataTable, type Column } from '../components/ui/DataTable'
import { FieldGroup, TextField } from '../components/ui/FormField'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Modal } from '../components/ui/Modal'
import { CardSkeleton, TableSkeleton } from '../components/ui/Skeleton'
import {
  Badge,
  ConditionResultBadge,
  MachineStatusBadge,
  RentalStatusBadge,
  WarrantyStatusBadge,
  machineStatusLabel,
} from '../components/ui/Badge'

const emptyCreateForm: CreateMachineRequest = {
  machineNumber: '',
  spesifikasi: '',
  standardRatio: 1,
  warrantyStart: new Date().toISOString().slice(0, 10),
  warrantyDurationMonths: 12,
}

// Input type="date" butuh yyyy-MM-dd; API mengembalikan ISO 8601 lengkap.
const toDateInputValue = (iso: string) => iso.slice(0, 10)

const statusFilterOptions: { value: MachineStatus | 'SEMUA' | 'ARSIP'; label: string }[] = [
  { value: 'SEMUA', label: 'Semua Status' },
  ...Object.values(MachineStatus).map((status) => ({ value: status, label: machineStatusLabel[status] })),
  { value: 'ARSIP', label: 'Diarsipkan' },
]

export function MachinesPage() {
  const { accessToken } = useAuth()
  const toast = useToast()
  const [searchParams] = useSearchParams()
  const [machines, setMachines] = useState<Machine[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') ?? '')
  const [statusFilter, setStatusFilter] = useState<MachineStatus | 'SEMUA' | 'ARSIP'>('SEMUA')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [createForm, setCreateForm] = useState<CreateMachineRequest>(emptyCreateForm)
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editForm, setEditForm] = useState<UpdateMachineRequest>({})
  const [historyMachine, setHistoryMachine] = useState<Machine | null>(null)
  const [history, setHistory] = useState<MachineHistory | null>(null)
  const [archivingMachine, setArchivingMachine] = useState<Machine | null>(null)

  const isArchivedView = statusFilter === 'ARSIP'

  const loadMachines = useCallback(async () => {
    try {
      setMachines(await api.listMachines(accessToken, { archived: isArchivedView }))
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Gagal memuat mesin.'))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, toast, isArchivedView])

  useEffect(() => {
    void loadMachines()
  }, [loadMachines])

  const filteredMachines = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return machines.filter((machine) => {
      const matchesStatus =
        statusFilter === 'SEMUA' || statusFilter === 'ARSIP' || machine.status === statusFilter
      const matchesSearch =
        !term ||
        machine.machineNumber.toLowerCase().includes(term) ||
        machine.spesifikasi.toLowerCase().includes(term)
      return matchesStatus && matchesSearch
    })
  }, [machines, searchTerm, statusFilter])

  const submitCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsCreating(true)

    try {
      await api.createMachine(accessToken, createForm)
      setCreateForm(emptyCreateForm)
      setIsCreateOpen(false)
      await loadMachines()
      toast.success('Mesin baru berhasil ditambahkan.')
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Mesin tidak dapat ditambahkan.'))
    } finally {
      setIsCreating(false)
    }
  }

  const startEdit = (machine: Machine) => {
    setEditingMachine(machine)
    setEditForm({
      spesifikasi: machine.spesifikasi,
      standardRatio: machine.standardRatio,
      warrantyStart: toDateInputValue(machine.warrantyStart),
      warrantyDurationMonths: machine.warrantyDurationMonths,
    })
  }

  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!editingMachine) {
      return
    }

    setIsSavingEdit(true)

    try {
      await api.updateMachine(accessToken, editingMachine.id, editForm)
      setEditingMachine(null)
      setEditForm({})
      await loadMachines()
      toast.success('Informasi mesin berhasil diperbarui.')
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Mesin tidak dapat diperbarui.'))
    } finally {
      setIsSavingEdit(false)
    }
  }

  const confirmArchiveMachine = async () => {
    if (!archivingMachine) {
      return
    }

    try {
      await api.archiveMachine(accessToken, archivingMachine.id)
      await loadMachines()
      toast.success('Mesin berhasil diarsipkan.')
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Mesin tidak dapat diarsipkan.'))
    } finally {
      setArchivingMachine(null)
    }
  }

  const unarchiveMachine = async (machine: Machine) => {
    try {
      await api.unarchiveMachine(accessToken, machine.id)
      await loadMachines()
      toast.success('Mesin berhasil dipulihkan dari arsip.')
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Mesin tidak dapat dipulihkan.'))
    }
  }

  const completeMaintenance = async (machine: Machine) => {
    try {
      await api.completeMachineMaintenance(accessToken, machine.id)
      await loadMachines()
      toast.success(`Mesin ${machine.machineNumber} tersedia lagi untuk disewa.`)
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Mesin tidak dapat ditandai tersedia.'))
    }
  }

  const openHistory = async (machine: Machine) => {
    setHistoryMachine(machine)
    setHistory(null)

    try {
      setHistory(await api.getMachineHistory(accessToken, machine.id))
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Riwayat mesin tidak dapat dimuat.'))
      setHistoryMachine(null)
    }
  }

  const columns: Column<Machine>[] = [
    {
      header: 'Kode / Model',
      cell: (item) => (
        <>
          <p className="font-medium text-slate-950">{item.machineNumber}</p>
          <p className="text-slate-500">{item.spesifikasi}</p>
        </>
      ),
    },
    { header: 'Penyedia', cell: (item) => item.ownerNama ?? '-' },
    { header: 'Rasio Standar', cell: (item) => `${item.standardRatio} output/kg` },
    {
      header: 'Status',
      cell: (item) => (
        <div className="flex flex-wrap gap-1.5">
          <MachineStatusBadge status={item.status} />
          {item.isArchived ? <Badge tone="slate">Diarsipkan</Badge> : null}
        </div>
      ),
    },
    {
      header: 'Warranty',
      cell: (item) => (
        <div className="space-y-1">
          <WarrantyStatusBadge status={item.warrantyStatus} />
          <p className="text-xs text-slate-500">s.d. {new Date(item.warrantyEnd).toLocaleDateString('id-ID')}</p>
        </div>
      ),
    },
    {
      header: 'Aksi',
      cell: (item) => (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" type="button" onClick={() => startEdit(item)}>
            Edit
          </Button>
          <Button variant="secondary" size="sm" type="button" onClick={() => openHistory(item)}>
            Riwayat
          </Button>
          {item.status === MachineStatus.MAINTENANCE && !item.isArchived ? (
            <Button variant="secondary" size="sm" type="button" onClick={() => completeMaintenance(item)}>
              Selesai Maintenance
            </Button>
          ) : null}
          {item.isArchived ? (
            <Button variant="secondary" size="sm" type="button" onClick={() => unarchiveMachine(item)}>
              Pulihkan
            </Button>
          ) : (
            <Button variant="secondary" size="sm" type="button" onClick={() => setArchivingMachine(item)}>
              Arsipkan
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Aset · Machines</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">Daftar Mesin</h1>
          <p className="mt-2 text-sm text-slate-600">Semua unit mesin molding dan status siklus sewanya.</p>
        </div>
        <Button type="button" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Tambah Mesin
        </Button>
      </section>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Cari kode, model, atau lokasi..."
            className="w-full flex-1 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm outline-none transition-all duration-150 placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as MachineStatus | 'SEMUA')}
            className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-sm outline-none transition-colors duration-150 hover:border-slate-300 sm:w-56"
          >
            {statusFilterOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4">
          {isLoading ? (
            <TableSkeleton rows={4} columns={6} />
          ) : (
            <DataTable
              columns={columns}
              rows={filteredMachines}
              rowKey={(item) => item.id}
              emptyMessage="Tidak ada mesin yang cocok dengan pencarian."
            />
          )}
        </div>
      </Card>

      {isCreateOpen ? (
        <Modal title="Tambah mesin baru" onClose={() => setIsCreateOpen(false)}>
          <form onSubmit={submitCreate}>
            <FieldGroup>
              <TextField
                label="Nomor mesin"
                value={createForm.machineNumber}
                onChange={(value) => setCreateForm((current) => ({ ...current, machineNumber: value }))}
              />
              <TextField
                label="Spesifikasi"
                value={createForm.spesifikasi}
                onChange={(value) => setCreateForm((current) => ({ ...current, spesifikasi: value }))}
              />
              <TextField
                label="Rasio standar (output/kg)"
                type="number"
                step="0.01"
                min="0"
                value={createForm.standardRatio}
                onChange={(value) => setCreateForm((current) => ({ ...current, standardRatio: Number(value) }))}
              />
              <TextField
                label="Mulai warranty"
                type="date"
                value={createForm.warrantyStart.slice(0, 10)}
                onChange={(value) => setCreateForm((current) => ({ ...current, warrantyStart: value }))}
              />
              <TextField
                label="Durasi warranty (bulan)"
                type="number"
                min="0"
                value={createForm.warrantyDurationMonths}
                onChange={(value) =>
                  setCreateForm((current) => ({ ...current, warrantyDurationMonths: Number(value) }))
                }
              />
            </FieldGroup>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setIsCreateOpen(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Menyimpan...' : 'Simpan mesin'}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {editingMachine ? (
        <Modal title={`Edit mesin ${editingMachine.machineNumber}`} onClose={() => setEditingMachine(null)}>
          <form onSubmit={submitEdit}>
            <FieldGroup>
              <TextField
                label="Spesifikasi"
                value={editForm.spesifikasi ?? ''}
                onChange={(value) => setEditForm((current) => ({ ...current, spesifikasi: value }))}
              />
              <TextField
                label="Rasio standar"
                type="number"
                step="0.01"
                min="0"
                value={editForm.standardRatio ?? editingMachine.standardRatio}
                onChange={(value) => setEditForm((current) => ({ ...current, standardRatio: Number(value) }))}
              />
              <TextField
                label="Mulai warranty"
                type="date"
                value={(editForm.warrantyStart ?? toDateInputValue(editingMachine.warrantyStart)).slice(0, 10)}
                onChange={(value) => setEditForm((current) => ({ ...current, warrantyStart: value }))}
              />
              <TextField
                label="Durasi warranty (bulan)"
                type="number"
                min="0"
                value={editForm.warrantyDurationMonths ?? editingMachine.warrantyDurationMonths}
                onChange={(value) =>
                  setEditForm((current) => ({ ...current, warrantyDurationMonths: Number(value) }))
                }
              />
            </FieldGroup>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setEditingMachine(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={isSavingEdit}>
                {isSavingEdit ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {historyMachine ? (
        <Modal title={`Riwayat mesin ${historyMachine.machineNumber}`} onClose={() => setHistoryMachine(null)}>
          {history ? <MachineHistoryView history={history} /> : <CardSkeleton lines={4} />}
        </Modal>
      ) : null}

      {archivingMachine ? (
        <ConfirmDialog
          title="Arsipkan mesin"
          message={`Arsipkan mesin ${archivingMachine.machineNumber}? Mesin akan disembunyikan dari daftar aktif, tapi datanya tetap tersimpan dan bisa dipulihkan kapan saja lewat filter "Diarsipkan".`}
          confirmLabel="Arsipkan"
          tone="warning"
          onConfirm={confirmArchiveMachine}
          onCancel={() => setArchivingMachine(null)}
        />
      ) : null}
    </div>
  )
}

function MachineHistoryView({ history }: { history: MachineHistory }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-slate-950">Riwayat sewa</h3>
        {history.rentals.length ? (
          <ul className="mt-2 divide-y divide-slate-100">
            {history.rentals.map((rental: Rental) => (
              <li key={rental.id} className="py-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-700">{rental.destinationLocation}</span>
                  <RentalStatusBadge status={rental.status} />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {rental.startDate ? new Date(rental.startDate).toLocaleDateString('id-ID') : '-'} &middot;{' '}
                  {rental.requestedDurationDays} hari
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Belum ada riwayat sewa.</p>
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-950">Riwayat pengecekan kondisi</h3>
        {history.conditionChecks.length ? (
          <ul className="mt-2 divide-y divide-slate-100">
            {history.conditionChecks.map((check: ConditionCheck) => (
              <li key={check.id} className="py-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">{new Date(check.checkedAt).toLocaleDateString('id-ID')}</span>
                  <ConditionResultBadge result={check.result} />
                </div>
                {check.notes ? <p className="mt-1 text-xs text-slate-500">{check.notes}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Belum ada pengecekan kondisi.</p>
        )}
      </div>
    </div>
  )
}
