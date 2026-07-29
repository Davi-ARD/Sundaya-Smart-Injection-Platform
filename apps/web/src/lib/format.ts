// Tanggal tampilan: format lokal Indonesia, tanda hubung bila kosong.
export const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    : '-'

// Angka dengan pemisah ribuan Indonesia.
export const formatNumber = (value: number) => value.toLocaleString('id-ID')

// Sisa masa sewa. Nilai negatif berarti sudah lewat jatuh tempo.
export const formatSisaHari = (days: number | null) => {
  if (days == null) return 'Belum aktif'
  if (days < 0) return `Lewat ${Math.abs(days)} hari`
  return `${days} hari`
}

// Tanggal beserta jam, untuk event yang waktunya penting (log produksi).
export const formatDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-'
