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

**MoldTrackingStatus** (6-state linear, tracking fisik mold):
```
PLANNING, DELIVERY, RECEIVED, PRODUCTION, SEND_BACK, COMPLETED
```
Empat status pertama digerakkan otomatis oleh event domain (bagian 5), hanya
SEND_BACK dan COMPLETED yang manual dan khusus ADMIN_SUNDAYA.

**ItemPengiriman** (jenis barang di Log Pengiriman dan Log Penerimaan):
```
MOLD, MATERIAL
```

**ProgressMolding** (baru, Layer 2):
```
PLANNING, ONGOING, SUDAH_DIPRODUKSI
```

**MachineOperationalStatus** (Layer 1 realtime, field kedua Machine):
```
STANDBY, SETUP, RUNNING, MAINTENANCE
```
Teknisi hanya boleh menginput SETUP dan RUNNING (konstanta `TEKNISI_INPUT_STATUS`
di shared, ditegakkan DTO). STANDBY hanya default mesin baru. MAINTENANCE disetel
modul Maintenance, yang menyimpan `Machine.statusBeforeMaintenance` saat mulai dan
memulihkannya saat selesai.

`DowntimeReason` dihapus: dengan Teknisi hanya memilih SETUP dan RUNNING, lima dari
enam reason code tidak lagi terjangkau input, dan setup sudah terbaca dari status
itu sendiri. Six big losses tetap tercakup lewat sumber lain (bagian 6a).

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

`DeliveryStatus` dihapus bersama view banding rencana vs aktual: Log Pengiriman
sekarang log informasi biasa (bagian 6).

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
- Rename model `Rental` menjadi `Job`. `jobNumber String @unique`, dibentuk dari kode
  cetakan plus sekuens (`JOB-MDA1-MDB2-001`) supaya nomornya menyebut isi jobnya.
- `moldId String` relasi ke Mold (baru).
- Relasi mesin **banyak-ke-banyak** (`Job.machines` / `Machine.jobs`, tabel implisit
  `_JobToMachine`): satu booking dipinjami beberapa mesin, satu mesin dipakai beberapa
  booking sepanjang waktu sehingga riwayat tetap terbaca. Kolom `Job.machineId` lama
  dibuang. `requestedMachineCount Int` menyimpan jumlah mesin yang diminta penyewa.
- Buang `penyediaId` + relasi RentalPenyedia (single-provider). Penyedia
  implisit Sundaya.
- `penyewaId` menjadi `managerId` (Manager Penyewa yang booking).
- `status RentalStatus` (lifecycle booking). Tambah `jobStatus JobStatus` untuk
  status dashboard (On Schedule/Warning/Critical) yang dihitung dari sisa sewa
  dan progress.
- Tambah plan fields: `planMaterialUtama String?`, `estimasiMaterialKg Float?`,
  `materialTambahan String?`, `targetOutput Float?`.
- Tambah `assignedById String?`, pertahankan `confirmedAt/shippedAt/receivedAt/
  returnedAt/rejectionReason`.
- `rencanaKirimMold` dihapus: rencana kirim dicatat Manager di LogPengiriman,
  bukan sekali saat booking.
- **`moldId` unique dihapus.** Relasi dibalik menjadi `Mold.jobId`, jadi satu
  booking memuat banyak cetakan (`Job.molds Mold[]`) sementara satu cetakan tetap
  hanya ikut satu booking.
- `destinationLocation` dihapus (single-provider: tujuannya selalu Sundaya).
  `planMaterialUtama`, `estimasiMaterialKg`, `materialTambahan`, `targetOutput`
  dihapus: semuanya dibaca dari Mold, tidak diduplikasi.
- Tambah `catatan String?` untuk catatan booking.
- Relasi baru: `logPengiriman LogPengiriman[]`, `logPenerimaan LogPenerimaan[]`.

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
- Dipakai untuk timestamp transisi dan jejak audit siapa yang memicunya. Ditulis
  baik oleh transisi manual maupun otomatis (`advance`), jadi papan tracking punya
  riwayat lengkap tanpa input tambahan.

### [BARU] LogProduksi (Layer 2, append-only, gabungan pengganti ProductionBatch)
Single-table timeline dengan kolom nullable per jenis event.
- `id`, `jobId`, `moldId`, `machineId String?`, `eventType LogProduksiEventType`,
  `occurredAt DateTime`, `byId` (Admin Penyewa), `catatan String?`, `createdAt`.
- `machineId` wajib untuk `PRODUKSI_HARIAN` dan `PROGRESS_MOLDING` (ditegakkan service),
  null untuk `MATERIAL_DATANG` yang tidak menyentuh mesin. Mesin dipinjamkan ke booking
  tanpa dipasangkan ke cetakan, jadi tabel inilah satu-satunya catatan pasangan
  cetakan-mesin yang sebenarnya, sekaligus sumber Quality per mesin.
- Material datang: `materialName String?`, `jumlahKg Float?`, `noSuratJalan String?`.
- Produksi harian: `goodProduct Int?`, `rejectCount Int?`, `materialUsedKg Float?`.
- Progress molding: `progressMolding ProgressMolding?`, `keteranganProgress String?`.
- Append-only: tanpa update/delete; koreksi lewat event baru.
- ponytail: satu tabel kolom-nullable lebih ringkas dari 3 tabel event; naikkan
  ke tabel per-tipe hanya jika query jadi kotor.
- **`MATERIAL_DATANG.occurredAt`** adalah sumber aktual-tiba material di Log
  Pengiriman.
- `CauseCategory`/`ReviewStatus`/`flaggedMachineIssue`/`efficiency` dari
  ProductionBatch lama: pindah ke sini hanya jika alur review masih dipakai;
  default buang sampai diminta (belum ada di wireframe/PROJECT_CONTEXT baru).

### [EVOLVE] Mold (tambahan)
- Tambah `jobId String?`: booking yang memuat cetakan ini, null berarti belum
  dibooking. Booking yang ditolak mengosongkannya kembali.
- `targetOutput` dan `estimasiKg` naik peran menjadi **batas keras** yang
  ditegakkan Log Produksi, bukan sekadar angka rencana.
- Relasi baru: `logProduksi`, `logPengiriman`, `logPenerimaan`.

### [BARU] OperationalData (Layer 1, append-only, realtime Teknisi)
- `machineNumber` digenerate service berpola `IM-001` berurutan (bukan input).
  `standardRatio` dihapus: data mati sejak modul batches dikarantina.
- `id`, `machineId`, `status MachineOperationalStatus`, `cycleTimeSec Float?`,
  `occurredAt DateTime`, `byId` (Teknisi), `catatan String?`.
- Append-only. Sumber hitung Availability, Performance, dan Utilization.
- `cycleTimeSec` = durasi satu siklus molding penuh, kanonik dalam detik. UI
  memakai `hmsToSeconds`/`secondsToHms` dari shared untuk input dan tampilan
  jam + menit + detik.
- `occurredAt` tidak boleh bertanggal masa depan (`assertNotFuture`), karena durasi
  tiap status dihitung dari jarak antar-event.

### [BARU] Maintenance
- `id`, `machineId`, `type MaintenanceType`, `scheduledAt DateTime`,
  `startedAt DateTime?`, `completedAt DateTime?`, `status MaintenanceStatus`,
  `notes String?`, `byId`, `createdAt`.
- `startedAt`/`completedAt` diisi saat transisi status; durasi pada maintenance
  CORRECTIVE menjadi sumber MTBF dan MTTR.

### [BARU] LogPengiriman (Manager Penyewa)
- `id`, `jobId`, `item ItemPengiriman`, `rencanaKirim DateTime`, `catatan String?`,
  `byId`, `createdAt`; khusus MATERIAL: `materialName String?`, `jumlahKg Float?`,
  `noSuratJalan String?`.

### [BARU] LogPenerimaan (Admin Sundaya)
- Sama seperti LogPengiriman, dengan `diterimaAt DateTime` menggantikan
  `rencanaKirim`, plus `kondisi String?`.

### [REUSE] Notification (`schema.prisma:98-110`), RentalExtension
(`schema.prisma:159-168`, extension request Manager tetap valid),
ConditionCheck (evaluasi: dipakai untuk Repair mold? pertahankan bila relevan).

### [EVOLVE] Machine (tambahan)
- Tambah `statusBeforeMaintenance MachineOperationalStatus?`: status operasional
  sebelum maintenance dimulai, dipakai memulihkan mesin saat maintenance selesai.
  Null di luar masa maintenance.

### Material (stok per job)
Turunan dari event LogProduksi (material datang minus material remaining).
ponytail: belum bikin model Material master; tambah bila butuh katalog grade.

## 5. State machine

**Mold tracking (linear satu arah, sebagian besar otomatis):**
```
PLANNING -> DELIVERY -> RECEIVED -> PRODUCTION -> SEND_BACK -> COMPLETED
```
Transisi hanya lewat service layer (aturan tim). Peta transisi konstan
(`MOLD_TRACKING_FLOW` di shared), bukan library state machine.

Pemicu tiap status:

| Status | Pemicu | Jalur |
|---|---|---|
| PLANNING | `POST /molds` (Manager) | default schema |
| DELIVERY | `POST /pengiriman` item MOLD (Manager) | `MoldTrackingService.advance` |
| RECEIVED | `POST /penerimaan` item MOLD (Admin Sundaya) | `MoldTrackingService.advance` |
| PRODUCTION | `POST /jobs/:id/logs` eventType PRODUKSI_HARIAN (Admin Penyewa) | `MoldTrackingService.advance` |
| SEND_BACK | `PATCH /molds/:id/tracking` (ADMIN_SUNDAYA) | `transition` |
| COMPLETED | `PATCH /molds/:id/tracking` (ADMIN_SUNDAYA) | `transition` |

`advance(tx, moldId, target, byId)` dipanggil di dalam transaksi service pemicu,
jadi log dan transisi status jadi satu unit atomik. Sifatnya **idempoten dan hanya
maju**: bila `moldRank(current) >= moldRank(target)` fungsi tidak menulis apa pun,
sehingga event domain yang terulang tidak menggandakan MoldTrackingEvent dan tidak
menurunkan status. Lompatan maju diizinkan (mis. penerimaan dicatat tanpa log kirim
lebih dulu).

`transition` menolak status yang seharusnya otomatis dengan 409
(`assertManualTransition`), supaya papan tracking tidak bisa dipalsukan via tombol.

**Job/booking lifecycle (RentalStatus):**
```
DIAJUKAN -> (DITOLAK | DIKONFIRMASI+mesin pertama) -> DIKIRIM -> AKTIF ->
SELESAI_SEWA -> DIKEMBALIKAN -> SELESAI
```
**Mesin dipinjamkan, bukan dipasangkan.** `PATCH /jobs/:id/assign` menambah satu mesin
ke booking dan hanya boleh oleh Admin Sundaya. Mesin pertama sekaligus memindahkan
lifecycle DIAJUKAN -> DIKONFIRMASI; mesin berikutnya lewat endpoint yang sama tanpa
menyentuh lifecycle. `DELETE /jobs/:id/machines/:machineId` menarik satu mesin kembali ke
TERSEDIA. Keduanya hanya berlaku selama lifecycle DIAJUKAN atau DIKONFIRMASI (sebelum
mesin dikirim), dan mesin terakhir tidak bisa ditarik.

Seluruh mesin booking berjalan lockstep dengan lifecycle job-nya: transisi lifecycle
memvalidasi jalur tiap mesin dari statusnya masing-masing lalu memperbarui semuanya
dalam satu transaksi (status mesin ditulis lebih dulu supaya payload job yang memuat
relasi mesin tidak basi).

**Tonase mesin adalah batas atas, bukan kesamaan persis.** Karena cetakan tidak
dipasangkan ke mesin, syarat saat meminjamkan hanya `machine.tonaseTon >=
min(mold.tonaseTon)` di booking itu (400 bila mesin tidak sanggup satu cetakan pun).
Kecocokan per pasangan ditegakkan saat Log Produksi dicatat:
`machine.tonaseTon >= mold.tonaseTon` (400 menyebut nomor mesin dan kode cetakannya).

**Batas plan per cetakan (Log Produksi).** Plan cetakan menjadi kuota, ditegakkan
saat append event `PRODUKSI_HARIAN`:

```
sum(goodProduct)    + baru <= Mold.targetOutput   (400 bila lewat, sebut sisa)
sum(materialUsedKg) + baru <= Mold.estimasiKg     (400 bila lewat, sebut sisa)
```

Plan yang null berarti tidak dibatasi. Event dicatat per pasangan cetakan-mesin
(`LogProduksi.moldId` + `machineId`); cetakan harus benar-benar bagian dari booking itu
dan mesin harus salah satu mesin pinjaman booking itu (404 bila bukan).

**Machine operationalStatus (Layer 1):** Teknisi hanya menyetel SETUP dan RUNNING
lewat `POST /machines/:id/operational`; tiap perubahan menulis OperationalData event
dan tidak ada urutan wajib. STANDBY hanya default mesin baru.

MAINTENANCE tidak diinput Teknisi melainkan efek samping modul Maintenance:

```
maintenance BERLANGSUNG -> simpan statusBeforeMaintenance, mesin jadi MAINTENANCE
maintenance SELESAI      -> mesin pulih ke statusBeforeMaintenance (fallback STANDBY)
```

Selama mesin MAINTENANCE, `POST /machines/:id/operational` dibalas 409: input
Teknisi akan tertimpa pemulihan status saat maintenance selesai. Bila mesin sudah
MAINTENANCE dari record lain, `statusBeforeMaintenance` tidak ditimpa supaya status
semula yang pertama tersimpan tetap yang dipulihkan.

**Machine rentalStatus (enum lama):** dipertahankan seperti alur rental
existing.

## 6. Log Pengiriman dan Log Penerimaan

Dua modul terpisah yang saling melengkapi, masing-masing memisahkan item MOLD dan
MATERIAL lewat enum `ItemPengiriman` (satu tabel, kolom `item`).

**LogPengiriman (Manager Penyewa).** Log informasi kapan barang akan dikirim ke
Sundaya, bukan pembanding rencana vs aktual. Field: `item`, `rencanaKirim`, dan
untuk MATERIAL: `materialName`, `jumlahKg`, `noSuratJalan`. Item MOLD memajukan
tracking mold ke DELIVERY. `rencanaKirim` boleh bertanggal depan (memang rencana).

**LogPenerimaan (Admin Sundaya).** Konfirmasi barang tiba di lokasi Sundaya. Field
sama plus `kondisi`, dengan `diterimaAt` menggantikan `rencanaKirim`. Item MOLD
memajukan tracking mold ke RECEIVED. `diterimaAt` tidak boleh bertanggal depan.

**Integrasi notifikasi (dua arah).** `POST /pengiriman` memberi notifikasi ke semua
ADMIN_SUNDAYA aktif (link `/penerimaan`); `POST /penerimaan` memberi notifikasi ke
Manager pemilik job (link `/pengiriman`). Notifikasi dikirim **setelah** transaksi
sukses supaya tidak terkirim untuk transaksi yang gagal.

**Batas dengan Layer 2.** LogPenerimaan item MATERIAL dan LogProduksi
`MATERIAL_DATANG` mencatat dua kejadian fisik berbeda: yang pertama kedatangan di
gerbang Sundaya (tanggung jawab Sundaya), yang kedua material masuk stok lantai
produksi (tanggung jawab Penyewa). Bukan duplikasi, dan dual-layer tetap terjaga.

## 6a. Perhitungan OEE lintas layer

Reason code manual dihapus, jadi tiga dimensi OEE diambil dari sumber yang paling
dekat dengan pihak yang tahu (`apps/api/src/dashboard/metrics.ts`):

| Dimensi | Sumber | Rumus |
|---|---|---|
| Availability | Layer 1 + Maintenance | `operating / PPT`, PPT = total minus MAINTENANCE terencana, loss = durasi SETUP + maintenance CORRECTIVE |
| Performance | Layer 1 | `IDEAL_CYCLE_TIME_SEC / rata-rata cycleTimeSec`, dibatasi maksimum 1 |
| Quality | Layer 2 | `good / (good + reject)` dari LogProduksi PRODUKSI_HARIAN mesin itu |
| OEE | hasil kali | `Availability x Performance x Quality` |
| Utilization | Layer 1 | `durasi RUNNING / total durasi terpantau` |
| MTBF / MTTR | Maintenance | operating per kejadian CORRECTIVE, dan rata-rata durasinya |

Maintenance memperoleh `startedAt` dan `completedAt` agar durasi korektif terukur.
Tanpa laporan cycle time, Performance dipatok 100 persen (data belum masuk, bukan
mesin lambat). Tanpa produksi tercatat, Quality dipatok 100 persen.

`IDEAL_CYCLE_TIME_SEC` masih konstanta di shared. ponytail: cycle time ideal per mold
belum jadi master data; naikkan ke field Mold bila tiap produk butuh angka sendiri.

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
| Mold tracking (baca papan) | - | R | R | R | R |
| Mold tracking (tutup siklus: Send Back, Completed) | - | RW | - | - | - |
| Log Pengiriman | - | R | - | RW | - |
| Log Penerimaan | R | RW | - | R (miliknya) | - |
| Machine operationalData (Layer 1) | - | R | RW | - | - |
| Maintenance | - | R | RW | - | - |
| Log Produksi (Layer 2) | - | R | - | R | RW |
| Notifikasi (milik sendiri) | R | RW | RW | RW | RW |
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
- **Mesin:** tambah `operationalStatus` dan `statusBeforeMaintenance`. Input Layer 1
  (Teknisi): `POST /machines/:id/operational` (status SETUP/RUNNING + cycle time,
  tanpa reason code). Ditolak 409 bila mesin sedang MAINTENANCE.
- **Cetakan:** `GET/POST/PATCH /molds` (GET juga untuk staf Sundaya),
  `PATCH /molds/:id/tracking` hanya untuk SEND_BACK dan COMPLETED (ADMIN_SUNDAYA).
- **Booking/Job (evolve rentals):** `POST /jobs` (Manager, tanpa mesin dan tanpa
  rencanaKirimMold), `PATCH /jobs/:id/assign` (Admin Sundaya), lifecycle transitions,
  `GET /jobs` scoped.
- **Log Produksi (Admin Penyewa):** `GET /jobs/:id/logs`, `POST /jobs/:id/logs`
  (append event, tanpa update/delete). PRODUKSI_HARIAN memicu mold PRODUCTION.
- **Log Pengiriman (Manager):** `GET /pengiriman`, `POST /pengiriman`. Bukan lagi
  view turunan; item MOLD memicu mold DELIVERY dan menotifikasi Admin Sundaya.
- **Log Penerimaan (baru, Admin Sundaya):** `GET /penerimaan`, `POST /penerimaan`.
  Item MOLD memicu mold RECEIVED dan menotifikasi Manager pemilik job.
- **Maintenance (Teknisi):** `GET/POST /maintenance`,
  `PATCH /maintenance/:id/status`. Transisi status ikut menggerakkan
  `Machine.operationalStatus` (set MAINTENANCE lalu pulihkan).
- **Notifikasi (un-quarantine):** `GET /notifications`,
  `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`. Modul dipindah
  dari `legacy/` ke `src/` dan di-wire; sebelumnya web memanggil endpoint yang
  belum ada.
- **Reports/Dashboard:** OEE/MTBF/MTTR lintas layer (bagian 6a). `ManagerDashboard`
  kehilangan `onTimeDeliveryRate` seiring hilangnya banding rencana vs aktual.

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
