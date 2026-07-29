import { useCallback, useEffect, useMemo, useState } from 'react'
import { Route as RouteIcon } from 'lucide-react'
import {
  MOLD_TEKNISI_ALLOWED,
  MOLD_TRACKING_FLOW,
  MoldTrackingStatus,
  Role,
  type Mold,
} from '@mold-tracker/shared'
import { useAuth } from '../auth/authContextValue'
import { api } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { moldTrackingLabel } from '../../components/ui/Badge'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { useToast } from '../../components/ui/Toast'
import { errorMessage } from '../../lib/errorMessage'

const COLUMN_ORDER = Object.values(MoldTrackingStatus)

// Mold Tracking (staf Sundaya): kanban ringkas per status fisik cetakan.
// ADMIN_SUNDAYA boleh semua transisi; TEKNISI_SUNDAYA hanya setup/produksi.
export function MoldTrackingPage() {
  const { accessToken, user } = useAuth()
  const toast = useToast()

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
    () => COLUMN_ORDER.map((status) => ({ status, molds: molds.filter((m) => m.trackingStatus === status) })),
    [molds],
  )

  const allowedNextSteps = (from: MoldTrackingStatus): MoldTrackingStatus[] => {
    const next = MOLD_TRACKING_FLOW[from]
    if (user?.role === Role.ADMIN_SUNDAYA) return next
    if (user?.role === Role.TEKNISI_SUNDAYA) {
      return next.filter((to) => MOLD_TEKNISI_ALLOWED.some(([f, t]) => f === from && t === to))
    }
    return []
  }

  const transition = async (mold: Mold, to: MoldTrackingStatus) => {
    setPendingId(mold.id)
    try {
      await api.updateMoldTracking(accessToken, mold.id, { status: to })
      toast.success(`${mold.kodeMold} -> ${moldTrackingLabel[to]}`)
      void load()
    } catch (caught) {
      toast.error(errorMessage(caught, 'Transisi gagal'))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Mold Tracking</h1>
        <p className="mt-1 text-sm text-slate-500">
          Transisi status fisik cetakan sepanjang siklus produksi, dari Planning sampai Completed.
        </p>
      </div>

      {isLoading ? (
        <Card>
          <CardSkeleton lines={5} />
        </Card>
      ) : molds.length === 0 ? (
        <Card>
          <div className="grid place-items-center py-14 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <RouteIcon className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-slate-800">Belum ada cetakan</p>
            <p className="mt-1 text-sm text-slate-500">Cetakan muncul setelah Manager Penyewa mendaftarkannya.</p>
          </div>
        </Card>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column) => (
            <div key={column.status} className="w-72 shrink-0">
              <div className="mb-2 flex items-center justify-between px-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {moldTrackingLabel[column.status]}
                </p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                  {column.molds.length}
                </span>
              </div>
              <div className="space-y-3">
                {column.molds.map((mold) => {
                  const nextSteps = allowedNextSteps(mold.trackingStatus)
                  return (
                    <div
                      key={mold.id}
                      className="rounded-xl border border-slate-200/70 bg-white p-4 shadow-sm shadow-slate-200/50"
                    >
                      <p className="text-sm font-semibold text-slate-900">{mold.kodeMold}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{mold.namaProduk}</p>
                      <p className="mt-1 text-xs text-slate-400">{mold.tonaseTon} ton</p>
                      {nextSteps.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {nextSteps.map((to) => (
                            <Button
                              key={to}
                              size="sm"
                              variant="secondary"
                              disabled={pendingId === mold.id}
                              onClick={() => void transition(mold, to)}
                            >
                              {moldTrackingLabel[to]}
                            </Button>
                          ))}
                        </div>
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
          ))}
        </div>
      )}
    </div>
  )
}
