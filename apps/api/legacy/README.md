# Legacy modules (karantina)

Modul dari model rental generik lama, belum diremodel ke domain SSIP. Dipindah
ke sini agar tidak ikut compile/test (build tetap hijau) sambil kodenya tetap
tersedia untuk dipakai ulang saat rewrite per modul.

Excluded dari build lewat `tsconfig.json` (`exclude: ["legacy"]`) dan dari jest
(`rootDir: src`).

Saat sebuah modul diremodel, pindahkan foldernya kembali ke `src/<domain>`,
sesuaikan ke schema baru (lihat `docs/ssip-spec.md`), lalu wire di
`src/app.module.ts`.

Isi: machines, rentals, production, reports, notifications.
Reuse yang berguna: `machines/warranty.ts`, `production/efficiency.ts` (basis
OEE/MTBF), `reports/csv.ts`, `rentals/rental-state.ts` (pola state machine).
