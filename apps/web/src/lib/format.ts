// Tanggal tampilan: format lokal Indonesia, tanda hubung bila kosong.
export const formatDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    : '-'

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
