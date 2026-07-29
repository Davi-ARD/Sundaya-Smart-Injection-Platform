import { Fragment, type ReactNode } from 'react'
import { MoldTrackingStatus, type MoldPlanRow } from '@mold-tracker/shared'
import {
  JobLifecycleBadge,
  MoldTrackingBadge,
  ProgressMoldingBadge,
  moldTrackingLabel,
} from '../../components/ui/Badge'
import { formatDate, formatNumber, formatSisaHari } from '../../lib/format'

// Jalur utama tracking fisik mold. REPAIR adalah cabang dari PRODUCTION, jadi
// hanya ikut ditampilkan ketika cetakan sedang berada di sana.
const MAIN_FLOW = [
  MoldTrackingStatus.PLANNING,
  MoldTrackingStatus.READY_DELIVERY,
  MoldTrackingStatus.DELIVERY,
  MoldTrackingStatus.RECEIVED,
  MoldTrackingStatus.WAITING_PRODUCTION,
  MoldTrackingStatus.ON_MACHINE,
  MoldTrackingStatus.PRODUCTION,
  MoldTrackingStatus.SEND_BACK,
  MoldTrackingStatus.COMPLETED,
]

// Rangkaian status tracking dengan posisi saat ini ditebalkan.
export function MoldTrackingSteps({ current }: { current: MoldTrackingStatus }) {
  const steps =
    current === MoldTrackingStatus.REPAIR
      ? [...MAIN_FLOW.slice(0, 7), MoldTrackingStatus.REPAIR, ...MAIN_FLOW.slice(7)]
      : MAIN_FLOW
  const currentIndex = steps.indexOf(current)

  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
      {steps.map((step, index) => (
        <Fragment key={step}>
          {index > 0 ? <span className="text-slate-300">-</span> : null}
          <span
            className={
              index === currentIndex
                ? 'font-semibold text-brand-700'
                : index < currentIndex
                  ? 'text-slate-500'
                  : 'text-slate-300'
            }
          >
            {moldTrackingLabel[step]}
          </span>
        </Fragment>
      ))}
    </p>
  )
}

function Row({ label, value, tone }: { label: string; value: ReactNode; tone?: 'amber' | 'rose' }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd
        className={[
          'text-right text-sm font-medium',
          tone === 'amber' ? 'text-amber-700' : tone === 'rose' ? 'text-rose-700' : 'text-slate-900',
        ].join(' ')}
      >
        {value}
      </dd>
    </div>
  )
}

// Detail cepat satu cetakan: tracking fisik ke Sundaya, hasil produksi, dan
// realisasi material dibanding rencana awal. Dipakai panel detail cepat di
// dashboard Manager dan panel detail di halaman Cetakan.
export function MoldPlanDetail({ row }: { row: MoldPlanRow }) {
  const sisaMaterial =
    row.materialRemainingKg ??
    (row.estimasiKg != null && row.materialDatangKg === 0 ? row.estimasiKg : null)

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200/70 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-950">Tracking mold ke Sundaya</h3>
        <div className="mt-2">
          <MoldTrackingSteps current={row.trackingStatus} />
        </div>
        <dl className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
          <Row label="Status tracking" value={<MoldTrackingBadge status={row.trackingStatus} />} />
          <Row label="Job" value={row.jobNumber ?? 'Belum dibooking'} />
          <Row
            label="Status booking"
            value={row.lifecycle ? <JobLifecycleBadge status={row.lifecycle} /> : '-'}
          />
          <Row label="Mesin assigned" value={row.machineNumber ?? 'Belum assign'} />
          <Row
            label="Sisa masa sewa"
            value={formatSisaHari(row.sisaHariSewa)}
            tone={row.sisaHariSewa != null && row.sisaHariSewa <= 3 ? 'amber' : undefined}
          />
          <Row label="Rencana kirim mold" value={formatDate(row.rencanaKirimMold)} />
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200/70 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-950">Hasil produksi</h3>
        <dl className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
          <Row
            label="Progress molding"
            value={row.progressMolding ? <ProgressMoldingBadge status={row.progressMolding} /> : '-'}
          />
          <Row
            label="Target"
            value={row.targetOutput != null ? `${formatNumber(row.targetOutput)} pcs` : '-'}
          />
          <Row label="Good product" value={`${formatNumber(row.totalGoodProduct)} pcs`} />
          <Row
            label="Reject"
            value={`${formatNumber(row.totalReject)} pcs (${row.rejectRate}%)`}
            tone={row.rejectRate > 5 ? 'rose' : undefined}
          />
          <Row label="Achievement" value={`${row.achievement}%`} />
          <Row
            label="ETA selesai"
            value={
              row.etaHari == null ? 'Belum bisa dihitung' : row.etaHari === 0 ? 'Selesai' : `${row.etaHari} hari`
            }
          />
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200/70 bg-white p-4 lg:col-span-2">
        <h3 className="text-sm font-semibold text-slate-950">Material</h3>
        <p className="mt-1 text-xs text-slate-500">
          Rencana berasal dari estimasi awal saat booking; realisasi dihitung dari Log Produksi.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200/70 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4">Material</th>
                <th className="py-2 pr-4">Rencana</th>
                <th className="py-2 pr-4">Dikirim</th>
                <th className="py-2 pr-4">Terpakai</th>
                <th className="py-2 pr-4">Sisa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-2.5 pr-4 font-medium text-slate-900">
                  {row.planMaterialUtama ?? 'Belum ditentukan'}
                </td>
                <td className="py-2.5 pr-4">
                  {row.estimasiKg != null ? `${formatNumber(row.estimasiKg)} kg` : '-'}
                </td>
                <td className="py-2.5 pr-4">{formatNumber(row.materialDatangKg)} kg</td>
                <td className="py-2.5 pr-4">
                  {row.materialTerpakaiKg != null ? `${formatNumber(row.materialTerpakaiKg)} kg` : '-'}
                </td>
                <td className="py-2.5 pr-4 font-semibold text-slate-900">
                  {sisaMaterial != null ? `${formatNumber(sisaMaterial)} kg` : '-'}
                </td>
              </tr>
              {row.materialTambahan ? (
                <tr>
                  <td className="py-2.5 pr-4 font-medium text-slate-900">{row.materialTambahan}</td>
                  <td className="py-2.5 pr-4 text-slate-400" colSpan={4}>
                    Material tambahan, jumlah dicatat di Log Produksi
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
