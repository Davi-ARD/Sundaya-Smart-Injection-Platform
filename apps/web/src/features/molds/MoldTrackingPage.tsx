import { useCallback, useEffect, useMemo, useState } from 'react'
import { Info, Lock, Route as RouteIcon } from 'lucide-react'
import {
  MOLD_MANUAL_TRANSITIONS,
  MOLD_TRACKING_FLOW,
  MoldTrackingStatus,
  Role,
  type Mold,
} from '@mold-tracker/shared'
import { useAuth } from '../auth/authContextValue'
import { api } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { PageHeader } from '../../components/PageHeader'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { moldTrackingLabel } from '../../components/ui/Badge'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { useToast } from '../../components/ui/Toast'
import { errorMessage } from '../../lib/errorMessage'

const COLUMN_ORDER = Object.values(MoldTrackingStatus)

// Pemicu otomatis tiap status, ditampilkan sebagai keterangan kolom supaya staf
// paham status tidak digeser manual.
const AUTO_TRIGGER: Partial<Record<MoldTrackingStatus, string>> = {
  [MoldTrackingStatus.PLANNING]: 'Saat Manager mendaftarkan cetakan',
  [MoldTrackingStatus.DELIVERY]: 'Saat Manager mencatat Log Pengiriman cetakan',
  [MoldTrackingStatus.RECEIVED]: 'Saat Sundaya mencatat Log Penerimaan cetakan',
  [MoldTrackingStatus.PRODUCTION]: 'Saat Admin Penyewa mencatat produksi harian pertama',
  [MoldTrackingStatus.SEND_BACK]: 'Ditekan Admin Sundaya saat produksi selesai',
  [MoldTrackingStatus.COMPLETED]: 'Saat penyewa mengonfirmasi cetakan sudah diterima kembali',
}

// Mold Tracking (staf Sundaya): papan status fisik cetakan. Empat status pertama
// bergerak otomatis dari event domain. Status kelima ditekan Admin Sundaya, dan
// status terakhir bukan wewenang Sundaya: yang menyatakan cetakan sudah sampai
// kembali adalah penyewa pemiliknya, lewat tab Cetakan mereka.
export function MoldTrackingPage() {
  const { accessToken, user } = useAuth()
  const toast = useToast()
  const canClose = user?.role === Role.ADMIN_SUNDAYA

  const [molds, setMolds] = useState<Mold[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      setMolds(await api.listMolds(accessToken))
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal memuat cetakan'))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, toast])

  useEffect(() => {
    void load()
  }, [load])

  const columns = useMemo(
    () =>
      COLUMN_ORDER.map((status) => ({
        status,
        molds: molds.filter((m) => m.trackingStatus === status),
      })),
    [molds],
  )

  // Halaman ini cuma menampilkan tombol milik Admin Sundaya, yaitu Send Back.
  // Completed sengaja tidak muncul di sini walau ada di peta transisi: approval
  // pengembalian datang dari penyewa, bukan dari Sundaya.
  const manualNext = (from: MoldTrackingStatus): MoldTrackingStatus | null => {
    if (!canClose) return null
    const next = MOLD_TRACKING_FLOW[from].find(
      (to) => MOLD_MANUAL_TRANSITIONS[to] === Role.ADMIN_SUNDAYA,
    )
    return next ?? null
  }

  const transition = async (mold: Mold, to: MoldTrackingStatus) => {
    setPendingId(mold.id)
    try {
      await api.updateMoldTracking(accessToken, mold.id, { status: to })
      toast.success(`${mold.kodeMold} menjadi ${moldTrackingLabel[to]}`)
      void load()
    } catch (caught) {
      toast.error(errorMessage(caught, 'Transisi gagal'))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-full">
      <PageHeader
        breadcrumb={[{ label: 'Beranda', to: '/staff' }, { label: 'Mold Tracking' }]}
        title="Mold Tracking"
        description="Status fisik cetakan bergerak otomatis mengikuti event Log Pengiriman, Log Penerimaan, dan Log Produksi. Hanya penutupan siklus yang dilakukan manual."
      />

      {isLoading ? (
        <Card>
          <CardSkeleton lines={5} />
        </Card>
      ) : molds.length === 0 ? (
        <Card>
          <EmptyState
            icon={RouteIcon}
            title="Belum ada cetakan"
            message="Cetakan muncul setelah Manager Penyewa mendaftarkannya."
          />
        </Card>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column) => {
            const trigger = AUTO_TRIGGER[column.status]
            return (
              <div key={column.status} className="w-72 shrink-0">
                <div className="mb-1 flex items-center justify-between px-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {moldTrackingLabel[column.status]}
                  </p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                    {column.molds.length}
                  </span>
                </div>
                <p className="mb-2 flex items-start gap-1 px-1 text-[11px] leading-4 text-slate-400">
                  {/* Kolom yang tidak bisa ditekan dari sini diberi gembok supaya
                      jelas status itu menyusul kejadian, bukan menunggu diklik. */}
                  {column.status === MoldTrackingStatus.SEND_BACK ? null : (
                    <Lock className="mt-0.5 h-3 w-3 shrink-0" />
                  )}
                  {trigger}
                </p>
                <div className="space-y-3">
                  {column.molds.map((mold) => {
                    const next = manualNext(mold.trackingStatus)
                    return (
                      <div
                        key={mold.id}
                        className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm shadow-slate-200/50"
                      >
                        <p className="text-sm font-semibold text-slate-900">{mold.kodeMold}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{mold.namaProduk}</p>
                        <p className="mt-1 text-xs text-slate-400">{mold.tonaseTon} ton</p>
                        {next ? (
                          <Button
                            className="mt-3"
                            size="sm"
                            variant="secondary"
                            disabled={pendingId === mold.id}
                            onClick={() => void transition(mold, next)}
                          >
                            Selesai produksi, kirim balik
                          </Button>
                        ) : null}
                        {mold.trackingStatus === MoldTrackingStatus.SEND_BACK ? (
                          <p className="mt-3 text-xs text-amber-700">
                            Menunggu penyewa mengonfirmasi cetakan sudah diterima.
                          </p>
                        ) : null}
                      </div>
                    )
                  })}
                  {column.molds.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
                      Kosong
                    </p>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-slate-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Tombol Selesai produksi memindahkan cetakan ke Send Back dan memberi tahu penyewa. Siklus
        baru tertutup menjadi Completed setelah penyewa sendiri mengonfirmasi cetakan itu sudah
        sampai kembali, satu konfirmasi per cetakan. Booking ikut selesai otomatis begitu seluruh
        cetakannya terkonfirmasi.
      </p>
    </div>
  )
}
