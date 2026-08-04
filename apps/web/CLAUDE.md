# apps/web (Vite + React + Tailwind)

Frontend Mold Tracker. Dev server port 5173, request ke /api diproxy ke http://localhost:3000.

## Perintah

```bash
pnpm --filter @mold-tracker/web dev      # vite dev server
pnpm --filter @mold-tracker/web build    # type check + vite build
pnpm --filter @mold-tracker/web lint     # eslint
```

## Konvensi

- Tipe entity dan DTO impor dari @mold-tracker/shared, jangan definisikan ulang.
- Styling hanya dengan Tailwind CSS (v4, konfigurasi lewat src/index.css), hindari CSS file terpisah per komponen.
- Struktur per fitur: src/features/<domain> untuk halaman dan komponen domain, src/components untuk komponen umum, src/lib untuk util dan API client.
- Panggilan API lewat satu API client di src/lib yang menyetel header Authorization Bearer dari token login.
- Tampilan menyesuaikan role user (SUPER_ADMIN, ADMIN_SUNDAYA, TEKNISI_SUNDAYA, MANAGER_PENYEWA, ADMIN_PENYEWA) sesuai kontrak di docs/api-contract.md. Satu form login (/login) untuk semua role; role akun dideteksi backend dari database, redirect tujuan mengikuti homePathForRole.
- Ponytail full aktif: komponen dan state seperlunya, fitur native (form, fetch, CSS) sebelum library, tanpa abstraksi spekulatif. Jalankan /ponytail-review sebelum PR.
