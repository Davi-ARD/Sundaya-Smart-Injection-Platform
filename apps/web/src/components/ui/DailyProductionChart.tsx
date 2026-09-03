import { useMemo } from 'react'
import type { DailyCycleEntry } from '@mold-tracker/shared'
import { formatDate, formatNumber } from '../../lib/format'

// Grafik batang produksi harian: good product ditumpuk dengan reject supaya
// tinggi batang mewakili total output hari itu, dan porsi merahnya langsung
// terbaca sebagai kualitas. Menjawab yang tidak bisa dijawab angka ringkasan:
// lajunya stabil atau tersendat, dan hari mana yang bermasalah.
//
// ponytail: dibangun dari div + CSS, bukan library chart. Kebutuhannya satu
// bentuk grafik sederhana, jadi menambah dependensi tidak sepadan.
export function DailyProductionChart({ harian }: { harian: DailyCycleEntry[] }) {
  // Server mengirim terbaru dulu; grafik dibaca kiri ke kanan menurut waktu.
  const data = useMemo(() => [...harian].reverse(), [harian])

  const maksimum = useMemo(
    () => Math.max(...data.map((d) => d.goodProduct + d.rejectCount), 1),
    [data],
  )
  const rataRata = useMemo(
    () => (data.length ? data.reduce((a, d) => a + d.goodProduct, 0) / data.length : 0),
    [data],
  )

  if (!data.length) return null

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-semibold text-slate-950">Produksi harian</p>
        <p className="text-xs text-slate-500">
          Rata-rata {formatNumber(Math.round(rataRata))} pcs baik per hari produksi
        </p>
      </div>

      {/* items-stretch: tiap kolom setinggi baris, supaya area batang punya
          tinggi pasti sebagai acuan persentase. */}
      <div className="mt-3 flex h-40 items-stretch gap-1.5 overflow-x-auto pb-1">
        {data.map((hari) => {
          const total = hari.goodProduct + hari.rejectCount
          // Batang terpendek tetap disisakan 2% agar hari berproduksi tidak
          // terlihat kosong sama sekali.
          const tinggiTotal = total > 0 ? Math.max((total / maksimum) * 100, 2) : 0
          // Porsi reject dihitung dari total supaya kedua segmen menjumlah tepat.
          const porsiReject = total > 0 ? (hari.rejectCount / total) * 100 : 0
          return (
            <div
              key={hari.occurredAt}
              className="flex min-w-8 flex-1 flex-col items-center gap-1.5"
              title={`${formatDate(hari.occurredAt)} - ${formatNumber(hari.goodProduct)} baik, ${formatNumber(hari.rejectCount)} reject`}
            >
              <span className="text-[10px] font-medium tabular-nums text-slate-500">
                {formatNumber(hari.goodProduct)}
              </span>

              {/* Area batang mengambil sisa tinggi kolom (flex-1) sehingga
                  tingginya pasti; batang dipasang absolut dari dasar agar
                  persentasenya tidak digencet flexbox seperti sebelumnya. */}
              <div className="relative w-full flex-1">
                <div
                  className="absolute inset-x-0 bottom-0 flex flex-col justify-end overflow-hidden rounded-t bg-slate-100"
                  style={{ height: `${tinggiTotal}%` }}
                >
                  {porsiReject > 0 ? (
                    <div className="w-full bg-rose-400" style={{ height: `${porsiReject}%` }} />
                  ) : null}
                  <div className="w-full flex-1 bg-emerald-500" />
                </div>
              </div>

              <span className="w-full truncate text-center text-[10px] text-slate-400">
                {formatDate(hari.occurredAt).slice(0, 6)}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-2 flex items-center gap-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-emerald-500" /> Produk baik
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-rose-400" /> Reject
        </span>
      </div>
    </div>
  )
}
