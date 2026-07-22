# SSIP Technical Spec (perombakan domain)

Spec teknis yang menjembatani `PROJECT_CONTEXT.md` (spec bisnis) dan
`ssip-wireframe.html` (spec UI) ke kode nyata (NestJS + Prisma + React).
Ini output langkah spec-driven-development. Baca bareng `PROJECT_CONTEXT.md`.
Dokumentasi tanpa em dash.

Status: draft awal untuk disepakati 2 developer sebelum sentuh kode.

---

## 1. Tujuan & ruang lingkup

Merombak sistem sewa+produksi generik (multi-provider) menjadi SSIP:
platform single-provider Sundaya dengan Production Job sebagai spine,
dual-layer data, 5 role, dan entitas mold/log produksi/log pengiriman baru.

Basis DB: **greenfield**. Belum ada data production, jadi kita buang semua
migrasi lama dan bikin 1 baseline schema baru. Tidak ada migrasi data.

## 2. Keputusan arsitektur (fork yang sudah disepakati)

1. **Greenfield schema.** Hapus `apps/api/prisma/migrations/*` lama, bikin satu
   migrasi baseline baru. Tidak menulis data migration.
2. **Evolve `Rental` menjadi `Job`.** Bukan model baru; rename + ubah field
   (machine jadi nullable karena di-assign belakangan, buang penyediaId).
3. **Role OPERATOR dihapus** dari enum. Lihat catatan di bawah.
4. **`ProductionBatch` dilebur** menjadi event `LogProduksi` (Layer 2,
   append-only).
5. **Machine dua field status:** `rentalStatus` (siklus ketersediaan, enum lama)
   dan `operationalStatus` (realtime Layer 1, enum baru).

**Catatan fork 3 (BUTUH KONFIRMASI):** OPERATOR lama secara fungsi tidak
memetakan bersih ke Teknisi Sundaya. OPERATOR = anak Penyewa yang input data
produksi. Di model baru itu pecah dua:
- Input data produksi (good/reject/material) menjadi tanggung jawab
  **Admin Penyewa** (Layer 2), sejalan fork 4.
- Input status mesin realtime (Layer 1) menjadi **Teknisi Sundaya** (aktor baru).

Karena greenfield, ini bukan migrasi rows. Kita definisikan 5 role baru dari
nol. Mekanisme lama yang dipakai ulang: relasi `parentId` untuk Admin Penyewa,
dan pola auth untuk staf. Spec ini menempatkan Log Produksi di Admin Penyewa
dan Operational Data di Teknisi. Jika tim tetap ingin memaksa pemetaan
OPERATOR ke Teknisi secara literal, tandai di sini sebelum implementasi.

## 3. Enum target

Sinkron di `apps/api/prisma/schema.prisma` dan `packages/shared/src/index.ts`.

**Role** (ganti total enum lama):
```
SUPER_ADMIN, ADMIN_SUNDAYA, TEKNISI_SUNDAYA, MANAGER_PENYEWA, ADMIN_PENYEWA
```

**MoldTrackingStatus** (baru, 10-state linear, tracking fisik mold):
```
PLANNING, READY_DELIVERY, DELIVERY, RECEIVED, WAITING_PRODUCTION,
ON_MACHINE, PRODUCTION, REPAIR, SEND_BACK, COMPLETED
```

**ProgressMolding** (baru, Layer 2):
```
PLANNING, ONGOING, SUDAH_DIPRODUKSI
```

**MachineOperationalStatus** (baru, Layer 1 realtime, field kedua Machine):
```
RUNNING, SETUP, STANDBY, BREAKDOWN, MAINTENANCE
```

**DowntimeReason** (baru, six big losses, dilampirkan saat status non-Running):
```
BREAKDOWN, SETUP_ADJUSTMENT, MINOR_STOP, REDUCED_SPEED,
STARTUP_REJECT, PRODUCTION_REJECT
```

**LogProduksiEventType** (baru, jenis event timeline Layer 2):
```
MATERIAL_DATANG, PRODUKSI_HARIAN, PROGRESS_MOLDING
```

**JobStatus** (baru, status Production Job di dashboard Sundaya):
```
ON_SCHEDULE, WARNING, CRITICAL, COMPLETED
```

**MaintenanceType** (baru):
```
PREVENTIVE, CORRECTIVE
```

**DeliveryStatus** (dihitung, tidak disimpan; dipakai di view Log Pengiriman):
```
DIRENCANAKAN, DIKIRIM, TIBA_ONTIME, TIBA_TERLAMBAT, BELUM_TIBA
```

**Dipertahankan dari enum lama:** `MachineStatus` (dipakai sebagai
`rentalStatus`, siklus ketersediaan), `WarrantyStatus`, `RentalStatus`
(dipakai sebagai status booking/job lifecycle), `ExtensionStatus`,
`ConditionResult`. `CauseCategory` dan `ReviewStatus` ikut ProductionBatch;
evaluasi apakah masih perlu setelah lebur ke LogProduksi (lihat bagian 4).

## 4. Model target (evolve / baru / reuse)

Penanda: [EVOLVE] ubah model lama, [BARU] model baru, [REUSE] pakai apa adanya.

### [EVOLVE] User
Basis `schema.prisma:73-96`.
- `role` pakai enum Role baru.
- `parentId` + relasi self: dipakai untuk **Admin Penyewa (child) ke Manager
  Penyewa (parent)**. Manager parentId null (tenant root). Staf Sundaya
  parentId null.
- `email` jadi **wajib** untuk semua role (buang jalur email-null login-by-nama
  milik OPERATOR). Login staf dan penyewa sama-sama by email.
- Tambah `companyName String?` untuk Manager Penyewa (identitas perusahaan =
  Customer di wireframe). ponytail: belum bikin model Customer terpisah; tenant
  = subtree Manager. Tambah model Customer jika nanti satu perusahaan butuh
  banyak Manager.
- Buang `@@unique([nama, role])` (khusus operator login-by-nama).

### [EVOLVE] Machine
Basis `schema.prisma:112-132`.
- Tambah `operationalStatus MachineOperationalStatus @default(STANDBY)` (Layer 1).
- `status` lama tetap sebagai sumbu ketersediaan/rental.
- Tambah `tonaseTon Int` (dipakai matching booking, wireframe tampilkan 150 ton).
- `ownerId` tetap tapi selalu menunjuk satu user sistem Sundaya (di-seed).
  ponytail: pertahankan FK owner biar minim churn; single-provider ditegakkan
  di service, bukan hapus kolom.

### [EVOLVE] Rental menjadi Job
Basis `schema.prisma:134-157`.
- Rename model `Rental` menjadi `Job`. `jobNumber String @unique` (SSIP-xxxx).
- `moldId String` relasi ke Mold (baru).
- `machineId String?` **jadi nullable** (di-assign Admin Sundaya, bukan saat booking).
- Buang `penyediaId` + relasi RentalPenyedia (single-provider). Penyedia
  implisit Sundaya.
- `penyewaId` menjadi `managerId` (Manager Penyewa yang booking).
- `status RentalStatus` (lifecycle booking). Tambah `jobStatus JobStatus` untuk
  status dashboard (On Schedule/Warning/Critical) yang dihitung dari sisa sewa
  dan progress.
- Tambah plan fields: `planMaterialUtama String?`, `estimasiMaterialKg Float?`,
  `materialTambahan String?`, `targetOutput Float?`.
- Tambah `rencanaKirimMold DateTime?` (sumber rencana untuk Log Pengiriman).
- Tambah `assignedById String?`, pertahankan `confirmedAt/shippedAt/receivedAt/
  returnedAt/rejectionReason`.

### [BARU] Mold (Cetakan)
- `id`, `kodeMold String @unique`, `namaProduk`, `cavity Int`, `tonaseTon Int`,
  `deskripsi String?`.
- `managerId` (Manager Penyewa pemilik plan).
- `trackingStatus MoldTrackingStatus @default(PLANNING)`.
- Plan opsional: `planMaterialUtama String?`, `estimasiKg Float?`,
  `targetOutput Float?`.
- `createdAt`.

### [BARU] MoldTrackingEvent (append-only histori pergerakan mold)
- `id`, `moldId`, `status MoldTrackingStatus`, `at DateTime @default(now())`,
  `byId`.
- Dipakai untuk timestamp transisi. **`RECEIVED.at`** adalah sumber aktual-tiba
  mold di Log Pengiriman.
- ponytail: kalau kanban cukup pakai status current saja tanpa histori, tabel
  ini bisa ditunda; tapi Log Pengiriman butuh timestamp RECEIVED, jadi minimal
  simpan event RECEIVED. Diputuskan: simpan semua transisi (kecil, audit gratis).

### [BARU] LogProduksi (Layer 2, append-only, gabungan pengganti ProductionBatch)
Single-table timeline dengan kolom nullable per jenis event.
- `id`, `jobId`, `eventType LogProduksiEventType`, `occurredAt DateTime`,
  `byId` (Admin Penyewa), `catatan String?`, `createdAt`.
- Material datang: `materialName String?`, `jumlahKg Float?`, `noSuratJalan String?`.
- Produksi harian: `goodProduct Int?`, `rejectCount Int?`, `materialRemainingKg Float?`.
- Progress molding: `progressMolding ProgressMolding?`, `keteranganProgress String?`.
- Append-only: tanpa update/delete; koreksi lewat event baru.
- ponytail: satu tabel kolom-nullable lebih ringkas dari 3 tabel event; naikkan
  ke tabel per-tipe hanya jika query jadi kotor.
- **`MATERIAL_DATANG.occurredAt`** adalah sumber aktual-tiba material di Log
  Pengiriman.
- `CauseCategory`/`ReviewStatus`/`flaggedMachineIssue`/`efficiency` dari
  ProductionBatch lama: pindah ke sini hanya jika alur review masih dipakai;
  default buang sampai diminta (belum ada di wireframe/PROJECT_CONTEXT baru).

### [BARU] OperationalData (Layer 1, append-only, realtime Teknisi)
- `id`, `machineId`, `status MachineOperationalStatus`,
  `downtimeReason DowntimeReason?`, `cycleTimeSec Float?`,
  `occurredAt DateTime`, `byId` (Teknisi), `catatan String?`.
- Append-only. Sumber hitung Availability, Performance, Quality, OEE,
  Utilization, MTBF, MTTR, total downtime, six big losses.

### [BARU] Maintenance
- `id`, `machineId`, `type MaintenanceType`, `scheduledAt DateTime`,
  `status` (Terjadwal/Berlangsung/Selesai; enum kecil atau string),
  `notes String?`, `byId`, `createdAt`.

### [REUSE] Notification (`schema.prisma:98-110`), RentalExtension
(`schema.prisma:159-168`, extension request Manager tetap valid),
ConditionCheck (evaluasi: dipakai untuk Repair mold? pertahankan bila relevan).

### Tanpa model: LogPengiriman
Murni turunan (bagian 6). Tidak ada tabel, tidak ada input. Query gabungan
rencana (Job) vs aktual (LogProduksi + MoldTrackingEvent).

### Material (stok per job)
Turunan dari event LogProduksi (material datang minus material remaining).
ponytail: belum bikin model Material master; tambah bila butuh katalog grade.

## 5. State machine

**Mold tracking (linear, satu arah kecuali Repair):**
```
PLANNING -> READY_DELIVERY -> DELIVERY -> RECEIVED -> WAITING_PRODUCTION ->
ON_MACHINE -> PRODUCTION -> (REPAIR -> ON_MACHINE)* -> SEND_BACK -> COMPLETED
```
Transisi hanya lewat service layer (aturan tim). Peta transisi konstan, bukan
library state machine (ponytail, sejalan konvensi rentals lama).

**Job/booking lifecycle (RentalStatus):**
```
DIAJUKAN -> (DITOLAK | DIKONFIRMASI+assign mesin) -> DIKIRIM -> AKTIF ->
SELESAI_SEWA -> DIKEMBALIKAN -> SELESAI
```
Assign mesin hanya boleh oleh Admin Sundaya, hanya saat transisi ke DIKONFIRMASI.

**Machine operationalStatus (Layer 1, bebas, di-set Teknisi):**
RUNNING/SETUP/STANDBY/BREAKDOWN/MAINTENANCE. Tiap perubahan tulis
OperationalData event. Tidak ada urutan wajib.

**Machine rentalStatus (enum lama):** dipertahankan seperti alur rental
existing.

## 6. Log Pengiriman (aturan turunan, tanpa input manual)

Baris per item rencana kirim. Untuk tiap Job dengan `rencanaKirimMold` terisi
dan/atau plan material:
- **Rencana tiba** = `Job.rencanaKirimMold` (dan plan material dari Job/Mold).
- **Aktual tiba material** = `occurredAt` event LogProduksi `MATERIAL_DATANG`
  terkait job.
- **Aktual tiba mold** = `at` event MoldTrackingEvent `RECEIVED` terkait mold.
- **Selisih** = aktual minus rencana (hari).
- **DeliveryStatus** dihitung:
  - `DIRENCANAKAN`: belum ada aktual, rencana belum lewat.
  - `BELUM_TIBA`: belum ada aktual, rencana sudah lewat (overdue).
  - `TIBA_ONTIME`: aktual ada, selisih <= 0.
  - `TIBA_TERLAMBAT`: aktual ada, selisih > 0.
- Ringkasan: on-time delivery rate, rata-rata keterlambatan, jumlah overdue.

Endpoint read-only, contoh `GET /jobs/:id/pengiriman` atau
`GET /pengiriman?managerId=...`. Tidak ada POST/PUT.

## 7. Matriks RBAC (ringkas)

| Modul / aksi | SUPER_ADMIN | ADMIN_SUNDAYA | TEKNISI_SUNDAYA | MANAGER_PENYEWA | ADMIN_PENYEWA |
|---|---|---|---|---|---|
| Konfigurasi sistem, kelola akun staf | RW | - | - | - | - |
| Register publik | - | - | - | self | - (dibuat Manager) |
| Kelola akun Admin Penyewa | - | - | - | RW (child sendiri) | - |
| Cetakan (Mold) | - | R | - | RW | - |
| Booking (ajukan) | - | R | - | RW | - |
| Approval + assign mesin | - | RW | - | - | - |
| Rental management | - | RW | - | R (miliknya) | - |
| Mold tracking (ubah status) | - | RW | (setup) | R | R |
| Machine operationalData (Layer 1) | - | R | RW | - | - |
| Maintenance | - | R | RW | - | - |
| Log Produksi (Layer 2) | - | R | - | R | RW |
| Log Pengiriman (read-only turunan) | - | R | - | R | - |
| Dashboard Sundaya / OEE | - | RW | R | - | - |
| Dashboard Manager | - | - | - | R | - |
| Dashboard job (di lokasi) | - | - | - | - | R |

Scoping tenant: Manager dan Admin Penyewa-nya hanya lihat data perusahaan
sendiri (filter by subtree parentId di service, pola sama seperti filter
kepemilikan PENYEWA lama). Semua endpoint tetap di belakang JwtAuthGuard +
RolesGuard kecuali yang ditandai publik.

## 8. Auth & akses

- **Landing publik** (login + register): hanya Penyewa. Register hanya buat
  Manager Penyewa (self-register, jadi tenant root).
- **Admin Penyewa** dibuat/diundang Manager (endpoint mirip `/operators` lama:
  `POST /penyewa-admins` oleh Manager, set email+password awal). Child, tidak
  bisa self-register. Nonaktif Manager menonaktifkan child (cascade isActive).
- **Staf Sundaya** (Super Admin, Admin Sundaya, Teknisi) via route internal
  tersembunyi (mis. `/internal`), tanpa self-register. Akun dibuat Super Admin.
  Backend auth sama; beda hanya halaman masuk + redirect by role di frontend.

## 9. Delta API contract (perlu update `docs/api-contract.md`)

Modul yang berubah/baru. Detail request/response ditulis saat implementasi.

- **Auth:** `register` batasi hanya MANAGER_PENYEWA. Tambah alur login staf
  (role staf redirect internal). `me` tetap.
- **User:** ganti `/operators` menjadi pengelolaan Admin Penyewa oleh Manager
  (`/penyewa-admins`). Endpoint staf (buat Admin/Teknisi) khusus Super Admin.
- **Mesin:** tambah `operationalStatus`. Endpoint input Layer 1 (Teknisi):
  `POST /machines/:id/operational` (status + reason + cycle time).
  `complete-maintenance` lama menjadi bagian modul Maintenance.
- **Cetakan (baru):** `GET/POST/PATCH /molds`, `PATCH /molds/:id/tracking`
  (transisi status, service-guarded).
- **Booking/Job (evolve rentals):** `POST /jobs` (Manager, tanpa mesin),
  `PATCH /jobs/:id/assign` (Admin Sundaya), lifecycle transitions,
  `GET /jobs` scoped.
- **Log Produksi (baru, Admin Penyewa):** `GET /jobs/:id/logs`,
  `POST /jobs/:id/logs` (append event, tanpa update/delete).
- **Log Pengiriman (baru, read-only):** `GET /jobs/:id/pengiriman` atau
  `GET /pengiriman`.
- **Maintenance (baru, Teknisi):** `GET/POST/PATCH /maintenance`.
- **Reports/Dashboard:** tambah OEE/MTBF/MTTR/six losses (Sundaya), delivery
  variance (Manager). Reuse `production/efficiency.ts` sebagai basis hitung.

## 10. Inventaris reuse (jangan dibangun ulang)

- Auth: JwtAuthGuard, RolesGuard, decorators (`auth/*`). Ganti enum Role saja.
- Relasi `parentId` untuk hierarki tenant (Manager -> Admin Penyewa).
- Machine model + warranty (`machines/*`, `warranty.ts`).
- Notifications (`notifications/*`), Reports + CSV (`reports/*`, `csv.ts`).
- Hitung efisiensi (`production/efficiency.ts`) sebagai basis OEE/MTBF.
- Web UI kit: `DataTable`, `Modal`, `SidePanel`, `RentalStepper` (untuk stepper
  tracking mold), `CountdownTimer` (sisa sewa), `Badge`, `Toast`, `ConfirmDialog`.
- Web infra: `AuthContext`, `ProtectedRoute`, `lib/api.ts`, `roleLabels.ts`.

## 11. Task breakdown (preview) dan split 2 orang

Urutan (dependensi): schema+shared enums dulu (blocking), lalu modul.

Fase 0 (berdua, pair): rewrite `schema.prisma` + `packages/shared` enums +
1 migrasi baseline + seed dasar (Sundaya user, akun staf, contoh mold/job).

Setelah Fase 0, split per modul:
- **Dev A (sisi Sundaya):** Auth staf + route internal, Cetakan read + assign,
  Booking approval + assign mesin, Mold tracking (state machine),
  Machine operationalData (Layer 1) + reason code, Maintenance, Dashboard
  Sundaya + OEE/MTBF/MTTR.
- **Dev B (sisi Penyewa):** Auth landing + register Manager + invite Admin
  Penyewa, Cetakan (Manager RW), Booking form (tanpa mesin), Log Produksi
  (Layer 2 append), Log Pengiriman (turunan read-only), Dashboard Manager +
  Dashboard job.

Tiap modul: 1 branch feature dari `refactor/ssip-domain`, TDD untuk service
(state machine, RBAC, hitung), `/ponytail-review` sebelum PR, 1 PR per modul.

## 12. Butuh konfirmasi sebelum implementasi

1. Fork 3 (OPERATOR): setuju pemetaan Log Produksi ke Admin Penyewa dan Layer 1
   ke Teknisi? (rekomendasi: ya).
2. Buang `CauseCategory`, `ReviewStatus`, alur review batch? (rekomendasi: ya,
   tidak ada di scope baru; kembalikan bila diminta).
3. `ConditionCheck` masih dipakai untuk Repair mold, atau dibuang? 
4. Customer sebagai `companyName` di User Manager cukup, atau perlu model
   Customer terpisah (satu perusahaan banyak Manager)? (rekomendasi: companyName).
