import { Fragment, type ReactNode } from 'react'
import { MoldTrackingStatus, type MoldPlanRow } from '@mold-tracker/shared'
import {
  JobLifecycleBadge,
  MoldTrackingBadge,
  ProgressMoldingBadge,
  moldTrackingLabel,
} from '../../components/ui/Badge'
import { DailyProductionChart } from '../../components/ui/DailyProductionChart'
import { formatDate, formatNumber, formatSisaHari } from '../../lib/format'

// Status sesi produksi cetakan dalam satu kalimat. Dibaca dari sesi terbaru di
// riwayat (bukan akumulasi umur cetakan), supaya cetakan yang dipakai lagi dengan
// target baru tidak terlihat selesai hanya karena produksi lamanya banyak.
function statusSesi(row: MoldPlanRow): { teks: string; kelas: string } {
  const sesi = row.runs[0]
  if (!sesi) {
    return {
      teks: 'Belum ada target output. Produksi cetakan ini tidak dibatasi target.',
      kelas: 'bg-slate-50 text-slate-600',
    }
  }
  if (sesi.goodProduct >= sesi.targetOutput) {
    return {
      teks: `Selesai. Target ${formatNumber(sesi.targetOutput)} pcs sudah tercapai, produksi tidak bisa ditambah lagi. Ubah target output bila ingin mencetak lagi.`,
      kelas: 'bg-emerald-50 text-emerald-800',
    }
  }
  if (sesi.goodProduct === 0) {
    return {
      teks: `Belum mulai. Target sesi ini ${formatNumber(sesi.targetOutput)} pcs.`,
      kelas: 'bg-slate-50 text-slate-600',
    }
  }
  return {
    teks: `Sedang berjalan. ${formatNumber(sesi.goodProduct)} dari ${formatNumber(sesi.targetOutput)} pcs, sisa ${formatNumber(sesi.targetOutput - sesi.goodProduct)} pcs.`,
    kelas: 'bg-brand-50 text-brand-800',
  }
}

// Jalur tracking fisik mold, linear tanpa cabang.
const MAIN_FLOW = [
  MoldTrackingStatus.PLANNING,
  MoldTrackingStatus.DELIVERY,
  MoldTrackingStatus.RECEIVED,
  MoldTrackingStatus.PRODUCTION,
  MoldTrackingStatus.COMPLETED,
]

// Rangkaian status tracking dengan posisi saat ini ditebalkan. Cetakan yang
// booking-nya belum disetujui belum punya status: seluruh langkah tampil redup.
export function MoldTrackingSteps({ current }: { current: MoldTrackingStatus | null }) {
  const steps = MAIN_FLOW
  const currentIndex = current ? steps.indexOf(current) : -1

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
          <Row
            label="Mesin dipinjamkan"
            value={row.machineNumbers.join(', ') || 'Belum dipinjami'}
          />
          <Row
            label="Sisa masa sewa"
            value={formatSisaHari(row.sisaHariSewa)}
            tone={row.sisaHariSewa != null && row.sisaHariSewa <= 3 ? 'amber' : undefined}
          />
        </dl>
      </section>

      <section className="rounded-xl border border-slate-200/70 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-950">Hasil produksi</h3>

        {/* Status sesi berjalan ditegaskan di depan supaya langsung terbaca:
            sudah selesai, sedang berjalan, belum mulai, atau memang tanpa batas. */}
        <div className={`mt-3 rounded-lg px-3 py-2.5 text-sm ${statusSesi(row).kelas}`}>
          {statusSesi(row).teks}
        </div>

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
          Plan material dari cetakan adalah batas maksimal pemakaian. Terpakai dihitung dari
          akumulasi Log Produksi; Admin Penyewa tidak bisa mencatat melebihi plan.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200/70 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4">Material</th>
                <th className="py-2 pr-4">Plan (batas)</th>
                <th className="py-2 pr-4">Terpakai</th>
                <th className="py-2 pr-4">Sisa kuota</th>
                <th className="py-2 pr-4">Pemakaian</th>
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
                <td className="py-2.5 pr-4">{formatNumber(row.materialUsedKg)} kg</td>
                <td className="py-2.5 pr-4 font-semibold text-slate-900">
                  {row.materialRemainingKg != null
                    ? `${formatNumber(row.materialRemainingKg)} kg`
                    : 'Tanpa batas'}
                </td>
                <td className="py-2.5 pr-4">
                  {row.materialUsagePercent != null ? `${row.materialUsagePercent}%` : '-'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Riwayat target output: tiap kali Manager mengganti target, sesi lama
          tetap tercatat lengkap dengan hasilnya supaya target sebelumnya tidak
          hilang begitu diganti target baru. */}
      {row.runs.length ? (
        <section className="rounded-xl border border-slate-200/70 bg-white p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-950">Riwayat target output</h3>
          <p className="mt-1 text-xs text-slate-500">
            Satu baris per sesi produksi. Sesi baru terbuka setiap target output cetakan diganti,
            dan hasil sesi lama tetap tersimpan sebagai riwayat.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200/70 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-4">Sesi</th>
                  <th className="py-2 pr-4">Target</th>
                  <th className="py-2 pr-4">Hasil</th>
                  <th className="py-2 pr-4">Material</th>
                  <th className="py-2 pr-4">Periode</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {row.runs.map((run, i) => {
                  const berjalan = run.selesai == null
                  return (
                    <tr key={run.id} className={berjalan ? 'bg-brand-50/40' : undefined}>
                      <td className="py-2.5 pr-4 font-medium text-slate-900">
                        {row.runs.length - i}
                      </td>
                      <td className="py-2.5 pr-4">{formatNumber(run.targetOutput)} pcs</td>
                      <td className="py-2.5 pr-4 font-semibold text-slate-900">
                        {formatNumber(run.goodProduct)} pcs
                      </td>
                      <td className="py-2.5 pr-4">{formatNumber(run.materialUsedKg)} kg</td>
                      <td className="whitespace-nowrap py-2.5 pr-4 text-slate-500">
                        {formatDate(run.mulai)}
                        {run.selesai ? ` - ${formatDate(run.selesai)}` : ''}
                      </td>
                      <td className="py-2.5">
                        {berjalan ? (
                          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                            Sesi berjalan
                          </span>
                        ) : run.tercapai ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Tercapai
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                            Tidak tercapai
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* Rincian harian ditempatkan di sini, bukan di dashboard: dashboard hanya
          memantau booking berjalan, sedangkan riwayat produksi tetap perlu bisa
          ditelusuri lewat detail cetakan walau booking-nya sudah selesai. */}
      <section className="rounded-xl border border-slate-200/70 bg-white p-4 lg:col-span-2">
        {row.harian.length === 0 ? (
          <>
            <h3 className="text-sm font-semibold text-slate-950">Produksi harian</h3>
            <p className="mt-1 text-xs text-slate-500">
              Belum ada produksi harian tercatat untuk cetakan ini.
            </p>
          </>
        ) : (
          <>
            <DailyProductionChart harian={row.harian} />

            <div className="mt-4 overflow-x-auto border-t border-slate-100 pt-4">
              <table className="min-w-full divide-y divide-slate-200/70 text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <th className="py-2 pr-4">Tanggal</th>
                    <th className="py-2 pr-4">Good</th>
                    <th className="py-2 pr-4">Reject</th>
                    <th className="py-2 pr-4">Material</th>
                    <th className="py-2">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {row.harian.map((hari) => (
                    <tr key={hari.occurredAt}>
                      <td className="whitespace-nowrap py-2 pr-4">{formatDate(hari.occurredAt)}</td>
                      <td className="py-2 pr-4">{formatNumber(hari.goodProduct)}</td>
                      <td className="py-2 pr-4">{formatNumber(hari.rejectCount)}</td>
                      <td className="py-2 pr-4">
                        {hari.materialUsedKg != null
                          ? `${formatNumber(hari.materialUsedKg)} kg`
                          : '-'}
                      </td>
                      <td className="py-2 text-slate-500">{hari.catatan ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
