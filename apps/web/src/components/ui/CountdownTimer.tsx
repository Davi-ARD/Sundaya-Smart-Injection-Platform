import { useEffect, useState } from 'react'

const MINUTE_MS = 60_000

// Timer sungguhan: hari & jam dibulatkan ke bawah (floor) dari selisih target - sekarang,
// jadi tiap jam yang lewat langsung mengurangi angka jam, bukan menunggu genap hari baru
// turun (itu yang bikin "dipotong"/"disesuaikan" terasa aneh). endDate sendiri sudah
// dihitung dari momen konfirmasi (lihat rentals.service.ts receive()), jadi start jam
// berapa pun tetap dapat durasi penuh — timer ini cuma menampilkan sisa waktu apa adanya.
function formatRemaining(targetMs: number, nowMs: number) {
  const diff = targetMs - nowMs
  if (diff <= 0) {
    return { label: 'Waktu sewa berakhir', isOverdue: true }
  }

  const totalMinutes = Math.floor(diff / MINUTE_MS)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)

  if (days > 0) {
    return { label: `Sisa ${days} hari ${hours} jam`, isOverdue: false }
  }
  if (hours > 0) {
    const minutes = totalMinutes % 60
    return { label: `Sisa ${hours} jam ${minutes} menit`, isOverdue: false }
  }
  return { label: `Sisa ${totalMinutes} menit`, isOverdue: false }
}

// Countdown ringan: cukup akurat untuk tampilan "sisa durasi sewa", re-render tiap menit.
export function CountdownTimer({ target }: { target: string }) {
  const targetMs = new Date(target).getTime()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), MINUTE_MS)
    return () => window.clearInterval(interval)
  }, [])

  const { label, isOverdue } = formatRemaining(targetMs, now)

  return (
    <span className={['text-sm font-semibold', isOverdue ? 'text-rose-600' : 'text-slate-700'].join(' ')}>
      {label}
    </span>
  )
}
