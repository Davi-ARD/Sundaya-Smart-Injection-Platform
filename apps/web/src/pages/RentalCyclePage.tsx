import { useCallback, useEffect, useState, type ComponentType, type FormEvent, type ReactNode } from 'react'
import { Check, CheckCircle2, ChevronDown, Inbox, Truck, X } from 'lucide-react'
import {
  ConditionResult,
  ExtensionStatus,
  RentalStatus,
  Role,
  type Rental,
  type RentalExtension,
} from '@mold-tracker/shared'
import { useAuth } from '../features/auth/authContextValue'
import { api } from '../lib/api'
import { useToast } from '../components/ui/Toast'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Modal } from '../components/ui/Modal'
import { RentalStatusBadge } from '../components/ui/Badge'
import { CardSkeleton } from '../components/ui/Skeleton'
import { SelectField, TextAreaField } from '../components/ui/FormField'

const errorMessage = (caughtError: unknown, fallback: string) =>
  caughtError instanceof Error ? caughtError.message : fallback

const conditionResultOptions = [
  { value: ConditionResult.BAIK, label: 'Baik' },
  { value: ConditionResult.BUTUH_MAINTENANCE, label: 'Butuh Maintenance' },
  { value: ConditionResult.RUSAK, label: 'Rusak' },
]

const rentalDays = (rental: Rental) => {
  if (!rental.startDate || !rental.endDate) {
    return rental.requestedDurationDays
  }
  const ms = new Date(rental.endDate).getTime() - new Date(rental.startDate).getTime()
  return Math.max(0, Math.round(ms / (24 * 60 * 60 * 1000)))
}

const formatDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('id-ID') : '-')

export function RentalCyclePage() {
  const { accessToken, user } = useAuth()
  const toast = useToast()
  const [rentals, setRentals] = useState<Rental[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [shippingRental, setShippingRental] = useState<Rental | null>(null)
  const [receivingRental, setReceivingRental] = useState<Rental | null>(null)
  const [rejectingRental, setRejectingRental] = useState<Rental | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [checkingRental, setCheckingRental] = useState<Rental | null>(null)
  const [checkResult, setCheckResult] = useState<ConditionResult>(ConditionResult.BAIK)
  const [checkNotes, setCheckNotes] = useState('')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [decidingExtensionId, setDecidingExtensionId] = useState<string | null>(null)
  const [isDoneHistoryOpen, setIsDoneHistoryOpen] = useState(false)

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

  const confirmRental = async (rental: Rental) => {
    setConfirmingId(rental.id)
    try {
      await api.confirmRental(accessToken, rental.id)
      await loadRentals()
      toast.success(`Sewa mesin ${rental.machineNumber} dikonfirmasi.`)
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Konfirmasi sewa gagal.'))
    } finally {
      setConfirmingId(null)
    }
  }

  const submitReject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!rejectingRental) {
      return
    }

    setIsSubmitting(true)
    try {
      await api.rejectRental(accessToken, rejectingRental.id, { reason: rejectReason })
      setRejectingRental(null)
      setRejectReason('')
      await loadRentals()
      toast.success(`Pengajuan sewa mesin ${rejectingRental.machineNumber} ditolak.`)
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Penolakan sewa gagal.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const confirmShip = async () => {
    if (!shippingRental) {
      return
    }
    try {
      await api.shipRental(accessToken, shippingRental.id)
      await loadRentals()
      toast.success(`Mesin ${shippingRental.machineNumber} ditandai dikirim.`)
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Menandai pengiriman gagal.'))
    } finally {
      setShippingRental(null)
    }
  }

  // Admin override: memicu langsung DIKIRIM -> AKTIF tanpa menunggu Penyewa login,
  // mis. setelah Penyewa mengonfirmasi lewat telepon bahwa mesin sudah dipakai.
  const confirmAdminReceive = async () => {
    if (!receivingRental) {
      return
    }
    try {
      await api.receiveRental(accessToken, receivingRental.id)
      await loadRentals()
      toast.success(`Sewa mesin ${receivingRental.machineNumber} diaktifkan (override Admin).`)
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Mengaktifkan sewa gagal.'))
    } finally {
      setReceivingRental(null)
    }
  }

  const openConditionCheck = (rental: Rental) => {
    setCheckResult(ConditionResult.BAIK)
    setCheckNotes('')
    setCheckingRental(rental)
  }

  const submitConditionCheck = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!checkingRental) {
      return
    }

    setIsSubmitting(true)
    try {
      await api.createConditionCheck(accessToken, checkingRental.id, {
        result: checkResult,
        notes: checkNotes || undefined,
      })
      setCheckingRental(null)
      await loadRentals()
      toast.success(
        `Pengecekan kondisi dicatat. Mesin ${checkingRental.machineNumber} kini ${
          checkResult === ConditionResult.BAIK ? 'Tersedia lagi' : 'masuk Maintenance'
        }.`,
      )
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Pencatatan pengecekan gagal.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const decideExtension = async (extension: RentalExtension, decision: ExtensionStatus.DITERIMA | ExtensionStatus.DITOLAK) => {
    setDecidingExtensionId(extension.id)
    try {
      await api.decideExtension(accessToken, extension.id, { decision })
      await loadRentals()
      toast.success(decision === ExtensionStatus.DITERIMA ? 'Perpanjangan diterima.' : 'Perpanjangan ditolak.')
    } catch (caughtError) {
      toast.error(errorMessage(caughtError, 'Keputusan perpanjangan gagal diproses.'))
    } finally {
      setDecidingExtensionId(null)
    }
  }

  const pending = rentals.filter((rental) => rental.status === RentalStatus.DIAJUKAN)
  const inProgress = rentals.filter((rental) =>
    [RentalStatus.DIKONFIRMASI, RentalStatus.DIKIRIM, RentalStatus.AKTIF].includes(rental.status),
  )
  // SELESAI_SEWA masih butuh aksi (pengecekan kondisi); SELESAI sudah tuntas — dilipat
  // ke Riwayat supaya kolom tidak penuh begitu siklus sewa mulai dipakai jangka panjang.
  const needsCheck = rentals.filter((rental) => rental.status === RentalStatus.SELESAI_SEWA)
  const doneHistory = rentals.filter((rental) => rental.status === RentalStatus.SELESAI)

  return (
    <div className="space-y-6">
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Rental Lifecycle</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">Panel Siklus Sewa</h1>
        <p className="mt-2 text-sm text-slate-600">
          Kelola siklus sewa dari request, pengiriman, hingga pengembalian mesin.
        </p>
      </section>

      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <CardSkeleton lines={3} />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <KanbanColumn title="Menunggu Konfirmasi" subtitle="Request baru dari penyewa" icon={Inbox} count={pending.length}>
            {pending.length ? (
              pending.map((rental) => (
                <RentalCard key={rental.id} rental={rental}>
                  <Button
                    size="sm"
                    type="button"
                    disabled={confirmingId === rental.id}
                    onClick={() => confirmRental(rental)}
                  >
                    {confirmingId === rental.id ? 'Memproses...' : 'Terima'}
                  </Button>
                  <Button variant="danger" size="sm" type="button" onClick={() => setRejectingRental(rental)}>
                    Tolak
                  </Button>
                </RentalCard>
              ))
            ) : (
              <EmptyColumn message="Tidak ada request baru." />
            )}
          </KanbanColumn>

          <KanbanColumn title="Dikirim & Aktif" subtitle="Mesin sedang beroperasi" icon={Truck} count={inProgress.length}>
            {inProgress.length ? (
              inProgress.map((rental) => {
                const pendingExtensions = rental.extensions.filter((ext) => ext.status === ExtensionStatus.DIAJUKAN)
                return (
                  <RentalCard key={rental.id} rental={rental}>
                    {rental.status === RentalStatus.DIKONFIRMASI ? (
                      <Button size="sm" type="button" onClick={() => setShippingRental(rental)}>
                        Tandai Dikirim
                      </Button>
                    ) : null}
                    {rental.status === RentalStatus.DIKIRIM && user?.role === Role.ADMIN ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        onClick={() => setReceivingRental(rental)}
                      >
                        Set Jadi Aktif
                      </Button>
                    ) : null}
                    {pendingExtensions.map((extension) => (
                      <div
                        key={extension.id}
                        className="flex w-full items-center justify-between gap-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800"
                      >
                        <span>Perpanjangan +{extension.additionalDays} hari</span>
                        <span className="flex gap-1">
                          <button
                            type="button"
                            aria-label="Terima perpanjangan"
                            disabled={decidingExtensionId === extension.id}
                            onClick={() => decideExtension(extension, ExtensionStatus.DITERIMA)}
                            className="grid h-6 w-6 place-items-center rounded-md bg-emerald-500 text-white transition-colors duration-150 hover:bg-emerald-600 disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Tolak perpanjangan"
                            disabled={decidingExtensionId === extension.id}
                            onClick={() => decideExtension(extension, ExtensionStatus.DITOLAK)}
                            className="grid h-6 w-6 place-items-center rounded-md bg-rose-500 text-white transition-colors duration-150 hover:bg-rose-600 disabled:opacity-50"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      </div>
                    ))}
                  </RentalCard>
                )
              })
            ) : (
              <EmptyColumn message="Tidak ada mesin yang sedang dikirim atau aktif." />
            )}
          </KanbanColumn>

          <KanbanColumn
            title="Selesai / Pengembalian"
            subtitle="Perlu pengecekan fisik"
            icon={CheckCircle2}
            count={needsCheck.length}
          >
            {needsCheck.length ? (
              needsCheck.map((rental) => (
                <RentalCard key={rental.id} rental={rental}>
                  <Button size="sm" type="button" onClick={() => openConditionCheck(rental)}>
                    Catat Pengecekan Kondisi
                  </Button>
                </RentalCard>
              ))
            ) : (
              <EmptyColumn message="Belum ada mesin yang perlu dicek." />
            )}

            {doneHistory.length ? (
              <div>
                <button
                  type="button"
                  onClick={() => setIsDoneHistoryOpen((current) => !current)}
                  className="flex w-full items-center justify-between rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 transition-colors duration-150 hover:bg-slate-100"
                >
                  <span>Riwayat selesai ({doneHistory.length})</span>
                  <ChevronDown
                    className={['h-3.5 w-3.5 transition-transform duration-200', isDoneHistoryOpen ? 'rotate-180' : ''].join(' ')}
                  />
                </button>
                {isDoneHistoryOpen ? (
                  <div className="mt-3 space-y-3">
                    {doneHistory.map((rental) => (
                      <RentalCard key={rental.id} rental={rental} />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </KanbanColumn>
        </div>
      )}

      {rejectingRental ? (
        <Modal title={`Tolak sewa ${rejectingRental.machineNumber}`} onClose={() => setRejectingRental(null)}>
          <form onSubmit={submitReject} className="space-y-4">
            <TextAreaField label="Alasan penolakan" value={rejectReason} onChange={setRejectReason} required />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setRejectingRental(null)}>
                Batal
              </Button>
              <Button variant="danger" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Memproses...' : 'Tolak pengajuan'}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

      {shippingRental ? (
        <ConfirmDialog
          title="Tandai dikirim"
          message={`Tandai mesin ${shippingRental.machineNumber} sudah dikirim ke lokasi Penyewa?`}
          confirmLabel="Tandai Dikirim"
          onConfirm={confirmShip}
          onCancel={() => setShippingRental(null)}
        />
      ) : null}

      {receivingRental ? (
        <ConfirmDialog
          title="Set sewa jadi Aktif (override Admin)"
          message={`Aktifkan sewa mesin ${receivingRental.machineNumber} sekarang tanpa menunggu konfirmasi Penyewa? Gunakan ini hanya bila Penyewa sudah mengonfirmasi lewat jalur lain (mis. telepon) bahwa mesin sudah diterima. Masa sewa penuh akan mulai berjalan dari saat ini.`}
          confirmLabel="Ya, Aktifkan"
          tone="warning"
          onConfirm={confirmAdminReceive}
          onCancel={() => setReceivingRental(null)}
        />
      ) : null}

      {checkingRental ? (
        <Modal title={`Pengecekan kondisi ${checkingRental.machineNumber}`} onClose={() => setCheckingRental(null)}>
          <form onSubmit={submitConditionCheck} className="space-y-4">
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Hasil pengecekan ini menentukan status mesin berikutnya: Baik membuat mesin Tersedia lagi, sedangkan
              Butuh Maintenance atau Rusak membuat mesin masuk status Maintenance.
            </p>
            <SelectField label="Hasil pengecekan" value={checkResult} onChange={setCheckResult} options={conditionResultOptions} />
            <TextAreaField label="Catatan (opsional)" value={checkNotes} onChange={setCheckNotes} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" onClick={() => setCheckingRental(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Menyimpan...' : 'Simpan hasil'}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null}

    </div>
  )
}

function KanbanColumn({
  title,
  subtitle,
  icon: Icon,
  count,
  children,
}: {
  title: string
  subtitle: string
  icon: ComponentType<{ className?: string }>
  count: number
  children: ReactNode
}) {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200/70 bg-slate-50/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-slate-700">
          <Icon className="h-4 w-4" />
          <p className="text-sm font-semibold">{title}</p>
        </div>
        <span className="grid h-6 min-w-6 place-items-center rounded-full bg-white px-1.5 text-xs font-bold text-slate-600 shadow-sm">
          {count}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  )
}

function RentalCard({ rental, children }: { rental: Rental; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm shadow-slate-200/40 transition-shadow duration-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-slate-950">{rental.machineNumber}</p>
        <RentalStatusBadge status={rental.status} />
      </div>
      <p className="mt-1 text-sm text-slate-500">{rental.destinationLocation}</p>
      <p className="mt-2 text-xs text-slate-500">
        {formatDate(rental.startDate)} → {formatDate(rental.endDate)} · {rentalDays(rental)}d
      </p>
      {rental.status === RentalStatus.DITOLAK && rental.rejectionReason ? (
        <p className="mt-2 text-xs text-rose-600">Alasan ditolak: {rental.rejectionReason}</p>
      ) : null}
      {children ? <div className="mt-3 flex flex-wrap gap-2">{children}</div> : null}
    </div>
  )
}

function EmptyColumn({ message }: { message: string }) {
  return <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">{message}</p>
}
