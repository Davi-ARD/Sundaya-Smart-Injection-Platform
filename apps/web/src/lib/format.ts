// Tanggal tampilan: format lokal Indonesia, tanda hubung bila kosong.
export const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    : '-'
