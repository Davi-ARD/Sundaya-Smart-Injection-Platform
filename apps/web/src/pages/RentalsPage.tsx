import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { errorMessage } from '../lib/errorMessage'
import { ChevronDown } from 'lucide-react'
import { RentalStatus, type Rental } from '@mold-tracker/shared'
import { useAuth } from '../features/auth/authContextValue'
import { api } from '../lib/api'
import { useToast } from '../components/ui/Toast'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { CountdownTimer } from '../components/ui/CountdownTimer'
import { Modal } from '../components/ui/Modal'
import { RentalStepper } from '../components/ui/RentalStepper'
import { CardSkeleton } from '../components/ui/Skeleton'
import { TextField } from '../components/ui/FormField'

// Riwayat (terminal, sudah selesai) disembunyikan di balik toggle supaya halaman tidak
// penuh begitu sewa mulai dipakai jangka panjang — data tetap tersimpan, cuma dilipat.
const isHistoryStatus = (status: RentalStatus) => status === RentalStatus.SELESAI || status === RentalStatus.DITOLAK

export function RentalsPage() {
  const { accessToken } = useAuth()
  const toast = useToast()
  const [rentals, setRentals] = useState<Rental[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [receivingRental, setReceivingRental] = useState<Rental | null>(null)
  const [returningRental, setReturningRental] = useState<Rental | null>(null)
  const [extendingRental, setExtendingRental] = useState<Rental | null>(null)
  const [additionalDays, setAdditionalDays] = useState(7)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadRentals = useCallback(async () => {
    try {
      setRentals(await api.listRentals(accessToken))
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Gagal memuat data sewa.'))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, toast])

  useEffect(() => {
    void loadRentals()
  }, [loadRentals])

  const confirmReceive = async () => {
    if (!receivingRental) {
      return
    }
    try {
      await api.receiveRental(accessToken, receivingRental.id)
      await loadRentals()
      toast.success(`Mesin ${receivingRental.machineNumber} dikonfirmasi diterima. Sewa kini Aktif.`)
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Konfirmasi penerimaan gagal.'))
    } finally {
      setReceivingRental(null)
    }
  }

  const confirmReturn = async () => {
    if (!returningRental) {
      return
    }
    try {
      await api.returnRental(accessToken, returningRental.id)
      await loadRentals()
      toast.success('Pengembalian mesin diajukan. Menunggu pengecekan kondisi dari Penyedia.')
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Pengajuan pengembalian gagal.'))
    } finally {
      setReturningRental(null)
    }
  }

  const submitExtension = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!extendingRental) {
      return
    }

    setIsSubmitting(true)
    try {
      await api.createExtension(accessToken, extendingRental.id, { additionalDays })
      setExtendingRental(null)
      toast.success('Perpanjangan berhasil diajukan. Menunggu keputusan Penyedia.')
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Pengajuan perpanjangan gagal.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const activeRentals = rentals.filter((rental) => !isHistoryStatus(rental.status))
  const historyRentals = rentals.filter((rental) => isHistoryStatus(rental.status))

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-bold text-slate-950">Status Sewa</h1>
        <p className="mt-2 text-sm text-slate-600">
          Pantau posisi tiap pengajuan sewa dan kelola sewa yang sedang berjalan.
        </p>
      </section>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, index) => (
            <Card key={index}>
              <CardSkeleton lines={2} />
            </Card>
          ))}
        </div>
      ) : activeRentals.length ? (
        <div className="space-y-4">
          {activeRentals.map((rental) => (
            <Card key={rental.id}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-slate-950">{rental.machineNumber}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{rental.destinationLocation}</p>
                  <div className="mt-3">
                    <RentalStepper status={rental.status} />
                  </div>
                  {rental.status === RentalStatus.DITOLAK && rental.rejectionReason ? (
                    <p className="mt-2 text-sm text-rose-600">Alasan ditolak: {rental.rejectionReason}</p>
                  ) : null}
                </div>

                <div className="flex shrink-0 flex-col items-start gap-2 lg:items-end">
                  {rental.status === RentalStatus.AKTIF && rental.endDate ? (
                    <CountdownTimer target={rental.endDate} />
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {rental.status === RentalStatus.DIKIRIM ? (
                      <Button size="sm" type="button" onClick={() => setReceivingRental(rental)}>
                        Konfirmasi Diterima
                      </Button>
                    ) : null}
                    {rental.status === RentalStatus.AKTIF ? (
                      <>
                        <Button variant="secondary" size="sm" type="button" onClick={() => setExtendingRental(rental)}>
                          Ajukan Perpanjangan
                        </Button>
                        <Button variant="secondary" size="sm" type="button" onClick={() => setReturningRental(rental)}>
                          Ajukan Pengembalian
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <p className="py-6 text-center text-sm text-slate-500">
            Belum ada sewa berjalan. Jelajahi katalog mesin untuk mulai menyewa.
          </p>
        </Card>
      )}

      {!isLoading && historyRentals.length ? (
        <div>
          <button
            type="button"
            onClick={() => setIsHistoryOpen((current) => !current)}
            className="flex w-full items-center justify-between rounded-lg border border-slate-200/70 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm shadow-slate-200/50 transition-colors duration-150 hover:bg-slate-50"
          >
            <span>Riwayat Sewa ({historyRentals.length})</span>
            <ChevronDown className={['h-4 w-4 transition-transform duration-200', isHistoryOpen ? 'rotate-180' : ''].join(' ')} />
          </button>

          {isHistoryOpen ? (
            <div className="mt-3 space-y-3">
              {historyRentals.map((rental) => (
                <Card key={rental.id} className="bg-slate-50/60">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800">{rental.machineNumber}</p>
                      <p className="mt-0.5 text-sm text-slate-500">{rental.destinationLocation}</p>
                    </div>
                    <RentalStepper status={rental.status} />
                  </div>
                  {rental.status === RentalStatus.DITOLAK && rental.rejectionReason ? (
                    <p className="mt-2 text-sm text-rose-600">Alasan ditolak: {rental.rejectionReason}</p>
                  ) : null}
                </Card>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {receivingRental ? (
        <ConfirmDialog
          title="Konfirmasi penerimaan mesin"
          message={`Konfirmasi mesin ${receivingRental.machineNumber} sudah diterima di lokasi Anda? Setelah dikonfirmasi, masa sewa langsung berjalan dan waktu penggunaan mesin mulai dihitung.`}
          confirmLabel="Ya, Sudah Diterima"
          onConfirm={confirmReceive}
          onCancel={() => setReceivingRental(null)}
        />
      ) : null}

      {returningRental ? (
        <ConfirmDialog
          title="Ajukan pengembalian"
          message={`Ajukan pengembalian mesin ${returningRental.machineNumber}? Penyedia akan melakukan pengecekan kondisi setelah ini.`}
          confirmLabel="Ajukan Pengembalian"
          onConfirm={confirmReturn}
          onCancel={() => setReturningRental(null)}
        />
      ) : null}

      {extendingRental ? (
        <Modal title={`Perpanjang sewa ${extendingRental.machineNumber}`} onClose={() => setExtendingRental(null)}>
          <form onSubmit={submitExtension} className="space-y-4">
            <TextField
              label="Tambahan hari"
              type="number"
              min="1"
              value={additionalDays}
              onChange={(value) => setAdditionalDays(Number(value))}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setExtendingRental(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Mengirim...' : 'Ajukan'}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  )
}
