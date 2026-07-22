# apps/api (NestJS)

Backend Mold Tracker. Prefix global `/api`, port dari env PORT (default 3000).

## Perintah

```bash
pnpm --filter @mold-tracker/api dev      # nest start --watch
pnpm --filter @mold-tracker/api build    # nest build
pnpm --filter @mold-tracker/api test     # jest
pnpm --filter @mold-tracker/api lint     # eslint
pnpm --filter @mold-tracker/api prisma:migrate
pnpm --filter @mold-tracker/api seed
```

## Konvensi

- Satu domain bisnis = satu module: folder src/<domain> berisi module, controller, service.
- Tipe request/response impor dari @mold-tracker/shared, jangan duplikasi interface.
- Enum di prisma/schema.prisma harus konsisten dengan enum di packages/shared.
- Transisi status (MoldTrackingStatus 10-state, JobLifecycle, MachineStatus, MachineOperationalStatus) hanya lewat service layer dengan validasi transisi yang sah; controller tidak boleh mengubah status langsung. Machine punya dua sumbu status terpisah: status (ketersediaan/rental) dan operationalStatus (realtime Layer 1).
- Semua endpoint diproteksi JwtAuthGuard + RolesGuard kecuali yang ditandai publik di docs/api-contract.md. Role: SUPER_ADMIN, ADMIN_SUNDAYA, TEKNISI_SUNDAYA, MANAGER_PENYEWA, ADMIN_PENYEWA.
- Penyaringan tenant dilakukan di service: Manager Penyewa dan Admin Penyewa (child-nya, lewat parentId) hanya melihat data perusahaannya; staf Sundaya melihat semua. Single-provider: penyedia selalu Sundaya, ditegakkan di service.
- Dual-layer append-only: OperationalData (Layer 1, Teknisi) dan LogProduksi (Layer 2, Admin Penyewa) tidak dihapus, koreksi lewat event baru.
- Env dibaca dari apps/api/.env (lihat .env.example). Jangan commit .env.
- Ponytail full aktif: peta transisi konstan bukan library state machine, konstanta env bukan tabel setting kalau env cukup, tanpa abstraksi spekulatif. RBAC dan validasi tidak disederhanakan. Jalankan /ponytail-review sebelum PR.
