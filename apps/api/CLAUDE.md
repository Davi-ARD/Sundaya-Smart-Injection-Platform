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
- Transisi status (MoldTrackingStatus 6-state, JobLifecycle, MachineStatus, MachineOperationalStatus) hanya lewat service layer dengan validasi transisi yang sah; controller tidak boleh mengubah status langsung. Machine punya dua sumbu status terpisah: status (ketersediaan/rental) dan operationalStatus (realtime Layer 1).
- Mold tracking sebagian besar otomatis: PLANNING, DELIVERY, RECEIVED, dan PRODUCTION digerakkan event domain lewat `MoldTrackingService.advance` (idempoten, hanya maju) di dalam transaksi service pemicu. Hanya SEND_BACK dan COMPLETED lewat `PATCH /molds/:id/tracking` (ADMIN_SUNDAYA). Lihat PROJECT_CONTEXT.md bagian 5a.
- Teknisi hanya menginput operationalStatus SETUP dan RUNNING (`TEKNISI_INPUT_STATUS`). MAINTENANCE disetel modul Maintenance yang menyimpan `statusBeforeMaintenance` lalu memulihkannya saat selesai. Tidak ada reason code manual.
- Satu booking memuat beberapa cetakan lewat relasi `Mold.jobId` (bukan `Job.moldId`). Satu mesin untuk seluruh booking; pengecekan assign memakai `machine.tonaseTon >= max(mold.tonaseTon)` karena tonase mesin adalah batas atas, bukan kesamaan persis.
- Plan cetakan (`Mold.targetOutput`, `Mold.estimasiKg`) adalah batas keras yang ditegakkan `LogProduksiService.assertWithinPlan` pada event PRODUKSI_HARIAN. Log Produksi dicatat per cetakan (`moldId`), begitu juga item MOLD di Log Pengiriman dan Log Penerimaan.
- Nomor mesin digenerate service (`IM-001`), tidak diterima dari client. `standardRatio` sudah dihapus; jangan dikembalikan tanpa pemakai perhitungan.
- Event yang mencatat kejadian nyata (operational, log produksi, penerimaan) wajib lewat `assertNotFuture`: durasi antar-event dihitung dari timestamp, jadi tanggal masa depan merusak hitungan OEE. Rencana pengiriman justru boleh bertanggal depan.
- Semua endpoint diproteksi JwtAuthGuard + RolesGuard kecuali yang ditandai publik di docs/api-contract.md. Role: SUPER_ADMIN, ADMIN_SUNDAYA, TEKNISI_SUNDAYA, MANAGER_PENYEWA, ADMIN_PENYEWA.
- Penyaringan tenant dilakukan di service: Manager Penyewa dan Admin Penyewa (child-nya, lewat parentId) hanya melihat data perusahaannya; staf Sundaya melihat semua. Single-provider: penyedia selalu Sundaya, ditegakkan di service.
- Dual-layer append-only: OperationalData (Layer 1, Teknisi) dan LogProduksi (Layer 2, Admin Penyewa) tidak dihapus, koreksi lewat event baru.
- Env dibaca dari apps/api/.env (lihat .env.example). Jangan commit .env.
- Ponytail full aktif: peta transisi konstan bukan library state machine, konstanta env bukan tabel setting kalau env cukup, tanpa abstraksi spekulatif. RBAC dan validasi tidak disederhanakan. Jalankan /ponytail-review sebelum PR.
