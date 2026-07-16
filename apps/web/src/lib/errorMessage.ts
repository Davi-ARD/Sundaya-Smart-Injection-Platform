// Pesan error dari catch: pakai message asli bila Error, selain itu fallback.
// Dipakai lintas halaman untuk toast error yang konsisten.
export const errorMessage = (caughtError: unknown, fallback: string) =>
  caughtError instanceof Error ? caughtError.message : fallback
