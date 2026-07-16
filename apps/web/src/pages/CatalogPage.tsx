import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { MachineStatus, Role, type CreateRentalRequest, type Machine } from '@mold-tracker/shared'
import { useAuth } from '../features/auth/authContextValue'
import { api } from '../lib/api'
import { useToast } from '../components/ui/Toast'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { TextField } from '../components/ui/FormField'
import { Modal } from '../components/ui/Modal'
import { Skeleton } from '../components/ui/Skeleton'
import { WarrantyStatusBadge } from '../components/ui/Badge'

const emptyForm = {
  requestedDurationDays: 7,
  destinationLocation: '',
  startDate: new Date().toISOString().slice(0, 10),
}

const errorMessage = (caughtError: unknown, fallback: string) =>
  caughtError instanceof Error ? caughtError.message : fallback

export function CatalogPage() {
  const { accessToken, user } = useAuth()
  const canRequestRental = user?.role === Role.PENYEWA
  const toast = useToast()
  const [machines, setMachines] = useState<Machine[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [requestingMachine, setRequestingMachine] = useState<Machine | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadMachines = useCallback(async () => {
    try {
      setMachines(await api.listMachines(accessToken, { status: MachineStatus.TERSEDIA }))
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Gagal memuat katalog mesin.'))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, toast])

  useEffect(() => {
    void loadMachines()
  }, [loadMachines])

  const openRequestForm = (machine: Machine) => {
    setForm(emptyForm)
    setRequestingMachine(machine)
  }

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!requestingMachine) {
      return
    }

    setIsSubmitting(true)
    try {
      const payload: CreateRentalRequest = {
        machineId: requestingMachine.id,
        ...form,
      }
      await api.createRental(accessToken, payload)
      setRequestingMachine(null)
      await loadMachines()
      toast.success('Pengajuan sewa berhasil dikirim. Menunggu konfirmasi Penyedia.')
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Pengajuan sewa gagal dikirim.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-bold text-slate-950">Katalog Mesin</h1>
        <p className="mt-2 text-sm text-slate-600">
          Mesin yang berstatus Tersedia dan bisa diajukan sewa saat ini.
        </p>
      </section>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="mt-3 h-3 w-full" />
              <Skeleton className="mt-2 h-3 w-2/3" />
            </Card>
          ))}
        </div>
      ) : machines.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {machines.map((machine) => (
            <Card key={machine.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-slate-950">{machine.machineNumber}</p>
                  <p className="mt-1 text-sm text-slate-500">{machine.spesifikasi}</p>
                </div>
                <WarrantyStatusBadge status={machine.warrantyStatus} />
              </div>
              <p className="mt-4 text-xs text-slate-500">
                Rasio standar: <span className="font-semibold text-slate-700">{machine.standardRatio}</span> output/kg
              </p>
              {canRequestRental ? (
                <Button className="mt-4 w-full" type="button" onClick={() => openRequestForm(machine)}>
                  Ajukan Sewa
                </Button>
              ) : null}
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <p className="py-6 text-center text-sm text-slate-500">
            Tidak ada mesin yang tersedia untuk disewa saat ini.
          </p>
        </Card>
      )}

      {requestingMachine ? (
        <Modal title={`Ajukan sewa ${requestingMachine.machineNumber}`} onClose={() => setRequestingMachine(null)}>
          <form onSubmit={submitRequest} className="space-y-4">
            <TextField
              label="Lokasi tujuan"
              value={form.destinationLocation}
              onChange={(value) => setForm((current) => ({ ...current, destinationLocation: value }))}
            />
            <TextField
              label="Tanggal mulai (3 hari dari sekarang)"
              type="date"
              value={form.startDate}
              onChange={(value) => setForm((current) => ({ ...current, startDate: value }))}
            />
            <TextField
              label="Durasi sewa (hari)"
              type="number"
              min="1"
              value={form.requestedDurationDays}
              onChange={(value) =>
                setForm((current) => ({ ...current, requestedDurationDays: Number(value) }))
              }
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setRequestingMachine(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Mengirim...' : 'Kirim pengajuan'}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  )
}
