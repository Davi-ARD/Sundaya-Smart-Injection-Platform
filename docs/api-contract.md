# Kontrak API: Mold Tracker

Sumber kebenaran endpoint backend. Frontend membangun mock berdasarkan dokumen ini. Semua bentuk tipe (User, Machine, Rental, dan seterusnya) serta enum didefinisikan di `packages/shared` dan diimpor kedua sisi.

## Konvensi umum

- Base path: `/api`. Semua path di bawah relatif terhadap base ini.
- Format: JSON. Waktu memakai ISO 8601 string.
- Autentikasi: header `Authorization: Bearer <accessToken>`. Semua endpoint butuh token kecuali yang ditandai Publik.
- Otorisasi: kolom Role menyatakan role yang boleh mengakses. Role lain mendapat 403.
- Error umum: 400 (validasi), 401 (belum login), 403 (role tidak berwenang), 404 (tidak ditemukan), 409 (konflik, misalnya transisi status tidak valid).
- Penyaringan berbasis kepemilikan dilakukan server: Penyewa hanya melihat data miliknya, Penyedia hanya melihat mesin dan sewa miliknya, kecuali Admin.

---

## Modul Auth

### POST /auth/register
Publik. Registrasi mandiri untuk PENYEWA atau PENYEDIA. Operator dibuat oleh Penyewa lewat endpoint Operator, bukan di sini.
- Request: `RegisterRequest` { nama, email, password, role (PENYEWA | PENYEDIA) }
- Response 201: `AuthResponse` { accessToken, user: User }

### POST /auth/login
Publik. `identifier` adalah email untuk ADMIN/PENYEDIA/PENYEWA, atau nama untuk OPERATOR (OPERATOR tidak punya email — lihat modul Operator).
- Request: `LoginRequest` { identifier, password }
- Response 200: `AuthResponse` { accessToken, user: User }

### GET /auth/me
Semua role terautentikasi.
- Response 200: `User`

### PATCH /auth/me
Semua role terautentikasi. Edit profil sendiri. Field opsional — hanya yang dikirim yang diubah.
- `email` ditolak untuk OPERATOR (400) karena OPERATOR login memakai nama.
- Ganti password: kirim `newPassword` (min 6) beserta `currentPassword`. `currentPassword` diverifikasi (401 bila salah); `newPassword` tanpa `currentPassword` → 400.
- Bentrok `email` unik → 409; bentrok `nama` (unik per role) → 409.
- JWT keyed by id, jadi ganti nama/email tidak membatalkan sesi (tidak ada token baru).
- Request: `UpdateProfileRequest` { nama?, email?, currentPassword?, newPassword? }
- Response 200: `User`

### POST /auth/me/avatar
Semua role terautentikasi. Upload foto profil (`multipart/form-data`, field `avatar`).
- Format: JPEG/PNG/WEBP saja, maks 5MB (400 bila ditolak).
- File lama otomatis dihapus dari disk saat diganti.
- File tersimpan di `apps/api/uploads/avatars/`, disajikan statis di `/api/uploads/avatars/:filename` (gabungkan dengan `avatarUrl` yang dikembalikan, sudah berupa path relatif diawali `/uploads/...` — akses via `${API_BASE_URL}${avatarUrl}`).
- Response 200: `User` (dengan `avatarUrl` terbaru)

---

## Modul User

### GET /users
Role: ADMIN.
- Query opsional: `role`, `isActive`
- Response 200: `User[]`

### POST /users
Role: ADMIN. Membuat user role apa pun. `email` wajib untuk semua role kecuali OPERATOR (OPERATOR login memakai nama, lihat modul Operator).
- Request: `CreateUserRequest` { nama, email?, password, role, parentId? }
- Response 201: `User`

### PATCH /users/:id
Role: ADMIN. Menonaktifkan (`isActive: false`) akun sendiri yang sedang login ditolak (403, cegah lockout tidak sengaja).
- Request: `UpdateUserRequest` { nama?, email?, role?, isActive? }
- Response 200: `User`

### PATCH /users/:id/deactivate
Role: ADMIN. Menonaktifkan akun sendiri yang sedang login ditolak (403, sama seperti di atas).
- Response 200: `User`

### DELETE /users/:id
Role: ADMIN. Menghapus akun apa pun secara permanen.
- Menghapus akun sendiri yang sedang login ditolak (403), untuk mencegah lockout tidak sengaja.
- Ditolak 409 bila akun itu masih punya riwayat data terkait (mesin, sewa, batch, dst.) — nonaktifkan saja lewat PATCH /users/:id/deactivate sebagai gantinya.
- Response 204

### POST /operators
Role: PENYEWA. Membuat sub-akun Operator di bawah Penyewa ini (parentId di-set otomatis ke id Penyewa). Operator tidak punya email — login memakai `nama` sebagai `identifier` di POST /auth/login. `nama` harus unik di antara sesama OPERATOR (409 bila bentrok).
- Request: `CreateOperatorRequest` { nama, password }
- Response 201: `User`

### GET /operators
Role: PENYEWA. Daftar operator di bawah Penyewa ini.
- Response 200: `User[]`

### DELETE /operators/:id
Role: PENYEWA (pemilik). Menghapus permanen sub-akun Operator miliknya. Ditolak 409 bila operator itu sudah punya riwayat batch produksi (data audit tidak boleh hilang) — pemilik harus minta ADMIN menonaktifkan lewat PATCH /users/:id/deactivate sebagai gantinya.
- Response 204

---

## Modul Cetakan (Mold)

CRUD cetakan milik Manager Penyewa. Scoping tenant di server: Manager hanya melihat dan mengubah cetakan miliknya sendiri; cetakan milik tenant lain dibalas 404 (tidak dibocorkan keberadaannya). Transisi `trackingStatus` tidak lewat modul ini melainkan endpoint tracking terpisah (service-guarded); cetakan baru selalu berstatus `PLANNING`.

### GET /molds
Role: MANAGER_PENYEWA (miliknya), ADMIN_SUNDAYA, TEKNISI_SUNDAYA. Manager melihat cetakan miliknya (terbaru dulu); staf Sundaya melihat semua (single-provider, tanpa scoping tenant) untuk approval booking dan transisi tracking.
- Response 200: `Mold[]`

### GET /molds/:id
Role: MANAGER_PENYEWA (pemilik, lainnya 404), ADMIN_SUNDAYA, TEKNISI_SUNDAYA (baca semua).
- Response 200: `Mold`

### POST /molds
Role: MANAGER_PENYEWA. Membuat cetakan (status `PLANNING`, `managerId` di-set dari token). `kodeMold` unik global (409 bila bentrok).
- Request: `CreateMoldRequest` { kodeMold, namaProduk, cavity, tonaseTon, deskripsi?, planMaterialUtama?, estimasiKg?, targetOutput? }
- Response 201: `Mold`

### PATCH /molds/:id
Role: MANAGER_PENYEWA (pemilik). Ubah field plan saja; `kodeMold` dan `trackingStatus` tidak dapat diubah di sini. Cetakan milik Manager lain dibalas 404.
- Request: `UpdateMoldRequest` { namaProduk?, cavity?, tonaseTon?, deskripsi?, planMaterialUtama?, estimasiKg?, targetOutput? }
- Response 200: `Mold`

### PATCH /molds/:id/tracking
Role: ADMIN_SUNDAYA. **Hanya untuk dua transisi penutup siklus**: PRODUCTION->SEND_BACK dan SEND_BACK->COMPLETED. Empat status sebelumnya (PLANNING, DELIVERY, RECEIVED, PRODUCTION) digerakkan otomatis oleh event domain, bukan endpoint ini. Dalam satu transaksi: update `Mold.trackingStatus` + append `MoldTrackingEvent` (byId, at).
- Status yang seharusnya otomatis ditolak 409 (`Status RECEIVED disetel otomatis dari event domain, tidak lewat tombol`).
- Transisi tidak sah menurut urutan ditolak 409 (mis. PRODUCTION langsung ke COMPLETED).
- Role selain ADMIN_SUNDAYA ditolak 403; mold tidak ada 404.
- Request: `UpdateMoldTrackingRequest` { status (MoldTrackingStatus) }
- Response 200: `Mold`

### Transisi otomatis mold tracking (bukan endpoint)
Empat status awal bergerak sebagai efek samping event domain, di dalam transaksi service pemicunya:

| Status | Dipicu oleh |
|---|---|
| PLANNING | `POST /molds` (default schema) |
| DELIVERY | `POST /pengiriman` dengan `item: MOLD` |
| RECEIVED | `POST /penerimaan` dengan `item: MOLD` |
| PRODUCTION | `POST /jobs/:jobId/logs` dengan `eventType: PRODUKSI_HARIAN` |

Bersifat idempoten dan hanya maju: event yang terulang tidak menulis `MoldTrackingEvent` ganda dan tidak menurunkan status. Lompatan maju diizinkan (penerimaan dicatat tanpa log pengiriman lebih dulu).

---

## Modul Mesin

Modul internal Sundaya. Single-provider: semua mesin milik Sundaya, jadi staf melihat semua. Penyewa (Manager/Admin Penyewa) tidak mengakses modul ini; booking dilakukan lewat mold tanpa memilih mesin. Mesin punya dua sumbu status terpisah: `status` (ketersediaan/rental) dan `operationalStatus` (realtime Layer 1). Kedua sumbu tidak diubah lewat create/update: ketersediaan hanya lewat lifecycle job, realtime hanya lewat Operational Data (Layer 1).

### GET /machines
Role: SUPER_ADMIN, ADMIN_SUNDAYA, TEKNISI_SUNDAYA. Menampilkan semua mesin Sundaya.
- Query opsional: `status` (MachineStatus), `archived` (`'true'` untuk melihat mesin yang diarsipkan; default/tanpa param menyembunyikan mesin arsip)
- Response 200: `Machine[]`

### GET /machines/:id
Role: SUPER_ADMIN, ADMIN_SUNDAYA, TEKNISI_SUNDAYA.
- Response 200: `Machine`

### POST /machines
Role: ADMIN_SUNDAYA. `machineNumber` **digenerate server** berpola `IM-001` berurutan (tidak diterima dari client). `ownerId` di-set ke user Sundaya pembuat (penegakan single-provider di service). `operationalStatus` awal STANDBY, `status` awal TERSEDIA. `tonaseTon` adalah clamping force: batas atas cetakan yang bisa dijalankan mesin ini.
- Request: `CreateMachineRequest` { spesifikasi, tonaseTon, warrantyStart, warrantyDurationMonths }
- Response 201: `Machine`

### PATCH /machines/:id
Role: ADMIN_SUNDAYA. Tidak mengubah kedua sumbu status.
- Request: `UpdateMachineRequest` { spesifikasi?, tonaseTon?, warrantyStart?, warrantyDurationMonths? }
- Response 200: `Machine`

### PATCH /machines/:id/archive
Role: ADMIN_SUNDAYA. Arsip (soft-delete) — set `isArchived: true`. Mesin tetap ada di database (relasi job/operational tidak hilang), cuma disembunyikan dari daftar aktif kecuali diminta lewat `?archived=true`.
- Response 200: `Machine`

### PATCH /machines/:id/unarchive
Role: ADMIN_SUNDAYA. Kembalikan mesin dari arsip — set `isArchived: false`.
- Response 200: `Machine`

### GET /machines/operational
Role: TEKNISI_SUNDAYA, ADMIN_SUNDAYA. Ringkasan realtime Layer 1: jumlah mesin (non-arsip) per `operationalStatus`, zero-fill keempat status.
- Response 200: `MachineStatusCount[]` { status (MachineOperationalStatus), count }

### POST /machines/:id/operational
Role: TEKNISI_SUNDAYA. Append event status realtime mesin (Layer 1, append-only). Dalam satu transaksi: menulis `OperationalData` dan menyetel `Machine.operationalStatus` ke status yang diposting. Koreksi lewat event baru, bukan update/delete.
- `status` hanya boleh `SETUP` atau `RUNNING` (400 bila lain). `STANDBY` hanya status awal mesin baru; `MAINTENANCE` disetel modul Maintenance.
- Ditolak 409 bila mesin sedang `MAINTENANCE`: statusnya akan dipulihkan modul Maintenance saat maintenance selesai, jadi input di sini akan tertimpa.
- `occurredAt` tidak boleh bertanggal masa depan (400), karena durasi tiap status dihitung dari jarak antar-event.
- `cycleTimeSec` = durasi satu siklus molding penuh dalam detik (UI merakitnya dari input jam + menit + detik).
- Mesin harus ada (404).
- Request: `CreateOperationalDataRequest` { status (SETUP | RUNNING), cycleTimeSec?, occurredAt, catatan? }
- Response 201: `OperationalData`

---

## Modul Job (SSIP)

Evolusi dari modul Sewa lama. Satu booking menghasilkan satu Production Job yang memuat **satu atau lebih cetakan** (relasi `Mold.jobId`, dikembalikan sebagai `Job.molds`). Satu mesin untuk seluruh booking, di-assign Admin Sundaya (bukan dipilih saat booking), `machineId` null sampai assign. Plan material dan target output tidak ada di Job: dibaca dari masing-masing cetakan. Lifecycle (`JobLifecycle`) hanya berpindah lewat service layer (peta `JOB_LIFECYCLE_FLOW`); sumbu ketersediaan mesin (`Machine.status`) berjalan lockstep lewat `MACHINE_FLOW`. `jobStatus` (ON_SCHEDULE/WARNING/CRITICAL/COMPLETED) dihitung saat baca dari sisa sewa, bukan disimpan. Scoping tenant di server: staf Sundaya lihat semua; Manager lihat miliknya; Admin Penyewa lihat tenant induknya.

### GET /jobs
Semua terautentikasi, disaring per tenant di server.
- Query opsional: `lifecycle` (JobLifecycle)
- Response 200: `Job[]`

### GET /jobs/:id
Pihak terkait (tenant pemilik) atau staf Sundaya. Tenant lain dibalas 403.
- Response 200: `Job`

### POST /jobs
Role: MANAGER_PENYEWA. Booking satu atau lebih cetakan tanpa memilih mesin (`machineId` null, lifecycle DIAJUKAN). Seluruh `moldIds` harus cetakan milik Manager (404 bila ada yang bukan miliknya atau tidak ada, tidak dibocorkan). Satu cetakan hanya boleh ikut satu booking: cetakan yang sudah dibooking dibalas 409 beserta kode cetakannya. `jobNumber` dibuat server; `startDate` yang dikirim adalah rencana (durasi sewa penuh baru dihitung saat job aktif). Plan material dan target output tidak diminta: sudah tersimpan di cetakan.
- Request: `CreateJobRequest` { moldIds (minimal 1, unik), requestedDurationDays, startDate, catatan? }
- Response 201: `Job`

### PATCH /jobs/:id/assign
Role: ADMIN_SUNDAYA. Approve + assign satu mesin untuk seluruh booking: DIAJUKAN -> DIKONFIRMASI, set `machineId`/`assignedById`/`confirmedAt`. Mesin harus TERSEDIA (409 bila tidak). Mesin berjalan TERSEDIA -> DIKONFIRMASI.
- **Tonase mesin adalah batas atas, bukan angka yang harus sama.** Mesin diterima bila `tonaseTon >=` tonase cetakan terbesar dalam booking; bila kurang dibalas 400 beserta cetakan mana yang tidak terpenuhi. Mesin 150 ton sanggup menjalankan cetakan 100 ton.
- Booking tanpa cetakan dibalas 409.
- Request: `AssignJobRequest` { machineId }
- Response 200: `Job`

### PATCH /jobs/:id/reject
Role: ADMIN_SUNDAYA. DIAJUKAN -> DITOLAK dengan alasan. Cetakan booking ini dilepas (`Mold.jobId` dikosongkan) supaya bisa dibooking ulang.
- Request: `RejectJobRequest` { reason }
- Response 200: `Job`

### PATCH /jobs/:id/ship
Role: ADMIN_SUNDAYA. DIKONFIRMASI -> DIKIRIM (mesin -> DIKIRIM).
- Response 200: `Job`

### PATCH /jobs/:id/activate
Role: ADMIN_SUNDAYA. DIKIRIM -> AKTIF (mesin -> AKTIF). `startDate`/`endDate` dihitung ulang dari momen aktif memakai `requestedDurationDays`.
- Response 200: `Job`

### PATCH /jobs/:id/return
Role: ADMIN_SUNDAYA. AKTIF -> SELESAI_SEWA (mesin -> SELESAI_SEWA), set `returnedAt`.
- Response 200: `Job`

### PATCH /jobs/:id/collect
Role: ADMIN_SUNDAYA. SELESAI_SEWA -> DIKEMBALIKAN (mesin -> DIKEMBALIKAN).
- Response 200: `Job`

### PATCH /jobs/:id/complete
Role: ADMIN_SUNDAYA. DIKEMBALIKAN -> SELESAI (mesin lewat PENGECEKAN kembali ke TERSEDIA).
- Response 200: `Job`

### POST /jobs/:id/extensions
Role: MANAGER_PENYEWA. Mengajukan perpanjangan masa sewa untuk job miliknya. Job harus AKTIF (409 bila bukan) dan tidak boleh ada pengajuan lain yang masih DIAJUKAN (409). Job tenant lain dibalas 403. Status pengajuan mulai dari DIAJUKAN.
- Request: `CreateExtensionRequest` { additionalDays (1 sampai 365) }
- Response 201: `RentalExtension`

### GET /jobs/extensions
Role: SUPER_ADMIN, ADMIN_SUNDAYA, TEKNISI_SUNDAYA. Antrean perpanjangan seluruh penyewa untuk tab Booking dan rental monitoring. Semua status disertakan supaya riwayat keputusan ikut terlihat.
- Response 200: `ExtensionRequestRow[]`

### PATCH /jobs/extensions/:extensionId/decide
Role: ADMIN_SUNDAYA. Memutuskan perpanjangan. Hanya pengajuan berstatus DIAJUKAN yang bisa diputuskan (409 bila sudah). DITERIMA menambah `requestedDurationDays` dan menggeser `endDate` job dalam satu transaksi; DITOLAK tidak mengubah job.
- Request: `DecideExtensionRequest` { decision (DITERIMA | DITOLAK) }
- Response 200: `RentalExtension`

---

## Modul Log Produksi (SSIP, Layer 2)

Timeline event produksi **per cetakan** (Layer 2), diinput Admin Penyewa di lokasi Sundaya. Satu booking bisa memuat beberapa cetakan, jadi tiap event menyebut `moldId`; cetakan harus benar-benar bagian dari booking itu (404 bila bukan). **Append-only**: tidak ada PATCH/DELETE; koreksi lewat event baru. Tiga jenis event (`LogProduksiEventType`) berbagi satu timeline; tiap event hanya menyimpan field milik tipenya. `occurredAt` event `MATERIAL_DATANG` dipakai sebagai aktual-tiba material di Log Pengiriman. Scoping tenant di server: job harus milik tenant pengakses (Admin Penyewa lewat `parentId`, Manager lewat dirinya); job tenant lain dibalas 404.

### GET /jobs/:jobId/logs
Role: ADMIN_PENYEWA, MANAGER_PENYEWA, ADMIN_SUNDAYA, SUPER_ADMIN. Timeline event job (urut `occurredAt` menaik).
- Response 200: `LogProduksi[]`

### POST /jobs/:jobId/logs
Role: ADMIN_PENYEWA. Append satu event; `byId` di-set dari token. `occurredAt` tidak boleh bertanggal masa depan (400). Event `PRODUKSI_HARIAN` memajukan `Mold.trackingStatus` cetakan itu ke `PRODUCTION` dalam transaksi yang sama (idempoten).

**Plan cetakan adalah batas keras** (ditegakkan pada `PRODUKSI_HARIAN`, 400 bila dilewati beserta sisa kuotanya):
- akumulasi `goodProduct` tidak boleh melewati `Mold.targetOutput`
- akumulasi `materialUsedKg` tidak boleh melewati `Mold.estimasiKg`
- plan yang null berarti tidak dibatasi; tepat sampai batas masih diterima

Field wajib per `eventType` (400 bila kurang):
- `MATERIAL_DATANG`: wajib `materialName`, `jumlahKg` (opsional `noSuratJalan`)
- `PRODUKSI_HARIAN`: wajib `goodProduct`, `rejectCount` (opsional `materialUsedKg`, yaitu material yang dipakai hari itu; sisa kuota dihitung sistem)
- `PROGRESS_MOLDING`: wajib `progressMolding` (opsional `keteranganProgress`)
- Request: `CreateLogProduksiRequest` { moldId, eventType, occurredAt, catatan?, dan field sesuai tipe di atas }
- Response 201: `LogProduksi`

---

## Modul Log Pengiriman (SSIP, Manager Penyewa)

Log informasi kapan mold dan material akan dikirim ke Sundaya. **Bukan** pembanding rencana vs aktual: tidak ada perhitungan selisih atau status kedatangan. Item `MOLD` dan `MATERIAL` dibedakan lewat kolom `item` (enum `ItemPengiriman`) dalam satu tabel; field material hanya dipakai item MATERIAL. Scoping tenant di server: Manager melihat log job miliknya, staf Sundaya melihat semua.

### GET /pengiriman
Role: MANAGER_PENYEWA, ADMIN_SUNDAYA, SUPER_ADMIN. Urut `rencanaKirim` menurun.
- Query opsional: `jobId`
- Response 200: `LogPengiriman[]`

### POST /pengiriman
Role: MANAGER_PENYEWA. Mencatat rencana pengiriman. `byId` di-set dari token. Job harus milik Manager (404 bila bukan, tidak dibocorkan).
- `item: MOLD` wajib menyebut `moldId` (400 bila kosong) dan cetakan itu harus bagian dari booking (404 bila bukan); status cetakan itu maju ke `DELIVERY` dalam transaksi yang sama.
- `item: MATERIAL` wajib `materialName` dan `jumlahKg` (400 bila kurang).
- `rencanaKirim` boleh bertanggal depan (memang rencana).
- Setelah transaksi sukses, semua ADMIN_SUNDAYA aktif menerima notifikasi berisi nomor job dan tanggal rencana kirim (link `/penerimaan`).
- Request: `CreateLogPengirimanRequest` { jobId, item, moldId (wajib untuk item MOLD), rencanaKirim, materialName?, jumlahKg?, noSuratJalan?, catatan? }
- Response 201: `LogPengiriman`

---

## Modul Log Penerimaan (SSIP, Admin Sundaya)

Konfirmasi bahwa mold atau material tiba di lokasi Sundaya. Pemisahan item sama seperti Log Pengiriman. **Berbeda dari `LogProduksi` event `MATERIAL_DATANG` (Layer 2)**: yang ini kedatangan di gerbang Sundaya (tanggung jawab logistik Sundaya), yang itu material masuk stok lantai produksi (tanggung jawab Penyewa). Dua kejadian fisik berbeda, jadi dual-layer tetap terjaga.

### GET /penerimaan
Role: ADMIN_SUNDAYA, SUPER_ADMIN, MANAGER_PENYEWA (job miliknya). Urut `diterimaAt` menurun.
- Query opsional: `jobId`
- Response 200: `LogPenerimaan[]`

### POST /penerimaan
Role: ADMIN_SUNDAYA. `byId` di-set dari token. Job harus ada (404).
- `item: MOLD` wajib menyebut `moldId` (400 bila kosong) dan cetakan itu harus bagian dari booking (404 bila bukan); status cetakan itu maju ke `RECEIVED` dalam transaksi yang sama.
- `item: MATERIAL` wajib `materialName` dan `jumlahKg` (400 bila kurang).
- `diterimaAt` tidak boleh bertanggal masa depan (400).
- Setelah transaksi sukses, Manager pemilik job menerima notifikasi (link `/pengiriman`).
- Request: `CreateLogPenerimaanRequest` { jobId, item, moldId (wajib untuk item MOLD), diterimaAt, materialName?, jumlahKg?, noSuratJalan?, kondisi?, catatan? }
- Response 201: `LogPenerimaan`

---

## Modul Sewa (legacy, digantikan Modul Job)

Bagian di bawah ini adalah kontrak modul Sewa lama (rentals, model PENYEWA/PENYEDIA) yang sudah dikarantina dan digantikan Modul Job SSIP di atas. Dipertahankan sebagai referensi sampai dokumen dirapikan.

### POST /rentals
Role: PENYEWA. Mengajukan sewa. Mesin harus TERSEDIA. Status rental menjadi DIAJUKAN.
- Request: `CreateRentalRequest` { machineId, requestedDurationDays, destinationLocation, startDate }
- Response 201: `Rental`

### GET /rentals
Role: semua terautentikasi, disaring per kepemilikan. `Rental.extensions` berisi riwayat pengajuan perpanjangan (termasuk yang masih DIAJUKAN), supaya Penyedia bisa memutuskan langsung tanpa endpoint daftar terpisah.
- Query opsional: `status` (RentalStatus)
- Response 200: `Rental[]`

### GET /rentals/:id
Role: pihak terkait (penyewa, penyedia) atau ADMIN. `Rental.extensions` disertakan sama seperti GET /rentals.
- Response 200: `Rental`

### PATCH /rentals/:id/confirm
Role: PENYEDIA. Menerima request. Status DIAJUKAN ke DIKONFIRMASI.
- Response 200: `Rental`

### PATCH /rentals/:id/reject
Role: PENYEDIA. Menolak request. Status DIAJUKAN ke DITOLAK. Mesin kembali TERSEDIA.
- Request: `RejectRentalRequest` { reason }
- Response 200: `Rental`

### PATCH /rentals/:id/ship
Role: PENYEDIA. Menandai mesin dikirim. Status DIKONFIRMASI ke DIKIRIM.
- Response 200: `Rental`

### PATCH /rentals/:id/receive
Role: PENYEWA, ADMIN (override — Admin bisa memicu langsung tanpa menunggu Penyewa login, mis. setelah konfirmasi lewat telepon). Konfirmasi mesin diterima. Status DIKIRIM ke AKTIF. Sejak ini Operator boleh input batch.
- `startDate` dan `endDate` dihitung ulang dari momen konfirmasi ini (`startDate = now`, `endDate = now + requestedDurationDays`) — durasi sewa penuh selalu dimulai utuh saat mesin benar-benar mulai dipakai, tidak terpotong keterlambatan antara pengajuan dan pengiriman.
- Response 200: `Rental`

### PATCH /rentals/:id/return
Role: PENYEWA. Mengajukan pengembalian. Status AKTIF ke SELESAI_SEWA.
- Response 200: `Rental`

### POST /rentals/:id/condition-check
Role: PENYEDIA. Mencatat hasil pengecekan saat mesin kembali. Status rental menjadi SELESAI. Mesin menjadi TERSEDIA (result BAIK) atau MAINTENANCE (BUTUH_MAINTENANCE atau RUSAK).
- Request: `CreateConditionCheckRequest` { result (ConditionResult), notes? }
- Response 201: `ConditionCheck`

### POST /rentals/:id/extensions
Role: PENYEWA. Mengajukan perpanjangan. Status extension DIAJUKAN.
- Request: `CreateExtensionRequest` { additionalDays }
- Response 201: `RentalExtension`

### PATCH /extensions/:id/decide
Role: PENYEDIA. Memutuskan perpanjangan.
- Request: `DecideExtensionRequest` { decision (DITERIMA | DITOLAK) }
- Response 200: `RentalExtension`

---

## Modul Produksi

### POST /batches
Role: OPERATOR. Mesin harus AKTIF di rental terkait. Server menghitung `targetOutput` (bila tidak dikirim) dari materialInputKg dikali standardRatio mesin, lalu `efficiency` dan `flaggedMachineIssue`.
- Request: `CreateBatchRequest` { rentalId, startAt, endAt, materialInputKg, targetOutput?, actualOutput, rejectCount, causeCategory? }
- Response 201: `ProductionBatch`

### GET /batches
Role: semua terautentikasi, disaring per kepemilikan.
- Query opsional: `rentalId`, `machineId`, `operatorId`, `flagged` (boolean)
- Response 200: `ProductionBatch[]`

### GET /batches/:id
Role: pihak terkait atau ADMIN.
- Response 200: `ProductionBatch`

### PATCH /batches/:id/review
Role: ADMIN. Menyetujui atau menolak batch yang di-flag sebelum masuk laporan resmi.
- Request: `ReviewBatchRequest` { reviewStatus (APPROVED | REJECTED) }
- Response 200: `ProductionBatch`

### GET /batches/efficiency/by-operator
Role: PENYEWA (operatornya), ADMIN.
- Query opsional: `rentalId`, `machineId`
- Response 200: `OperatorEfficiency[]` { operatorId, nama, avgEfficiency, batchCount }

### GET /batches/efficiency/by-machine
Role: PENYEWA, PENYEDIA, ADMIN.
- Response 200: `MachineEfficiency[]` { machineId, machineNumber, avgEfficiency, batchCount, rejectRate }

---

## Modul Laporan dan Dashboard

### GET /dashboard/penyedia
Role: PENYEDIA.
- Response 200: `PenyediaDashboard` { machineStatusCounts, machineUtilization: [{ machineId, machineNumber, daysRented, daysIdle }], recurringIssueMachines: Machine[], warrantySummary: [{ machineId, machineNumber, warrantyStatus, warrantyEnd }] }

### GET /dashboard/penyewa
Role: PENYEWA.
- Response 200: `PenyewaDashboard` { activeRentals: [{ rentalId, machineNumber, endDate }], efficiencyByBatch: [{ batchId, machineNumber, date, efficiency }], rejectRate, machineIssueBatches: ProductionBatch[] }
  - `endDate` mentah (bukan jumlah hari terhitung server) — frontend menampilkannya lewat `CountdownTimer` yang sama dipakai di Status Sewa, biar konsisten (jam-menit live, bukan dibulatkan).

### GET /dashboard/admin
Role: ADMIN.
- Response 200: `AdminDashboard` { totalUsers, totalMachines, machineStatusCounts, totalActiveRentals, flaggedPendingReview: number }

### GET /reports/machine-issues
Role: PENYEWA, ADMIN. Batch berindikasi masalah mesin yang sudah APPROVED.
- Query opsional: `rentalId`, `machineId`
- Response 200: `ProductionBatch[]`

### GET /reports/machine-issues/export
Role: PENYEWA, ADMIN. Mengunduh laporan.
- Query: `format` (csv | pdf), opsional `rentalId`, `machineId`
- Response 200: file (Content-Type text/csv atau application/pdf)

---

## Modul Notifikasi

Notifikasi in-app lintas role, dibuat otomatis oleh server di titik yang relevan bagi pihak lawan (bukan lewat endpoint publik). Frontend polling `GET /notifications` secara berkala. Pengiriman email belum diimplementasikan (menyusul).

Titik pembuatan notifikasi saat ini, sepasang dan dua arah:

| Pemicu | Penerima | Link |
|---|---|---|
| `POST /pengiriman` (Manager mencatat rencana kirim) | semua ADMIN_SUNDAYA aktif | `/penerimaan` |
| `POST /penerimaan` (Admin Sundaya mencatat barang tiba) | Manager pemilik job | `/pengiriman` |

Notifikasi dikirim **setelah** transaksi database sukses, supaya tidak ada notifikasi untuk transaksi yang gagal.

### GET /notifications
Semua role terautentikasi. Hanya notifikasi milik user yang login.
- Query opsional: `unreadOnly` (boolean)
- Response 200: `AppNotification[]` { id, title, message, link, isRead, createdAt }, maksimal 50 terbaru

### PATCH /notifications/:id/read
Semua role terautentikasi. Tandai satu notifikasi sudah dibaca.
- Response 200: `AppNotification`

### PATCH /notifications/read-all
Semua role terautentikasi. Tandai semua notifikasi milik user sudah dibaca.
- Response 204

---

## Modul Maintenance

Modul internal Sundaya (SSIP). Teknisi Sundaya menjadwalkan dan mengeksekusi maintenance mesin; Admin Sundaya hanya membaca. Status maintenance berpindah linear lewat service layer (peta transisi konstan): `TERJADWAL -> BERLANGSUNG -> SELESAI`. Modul ini mengelola lifecycle record Maintenance saja dan tidak mengubah sumbu ketersediaan `Machine.status`.

### GET /maintenance
Role: TEKNISI_SUNDAYA, ADMIN_SUNDAYA. Semua record (single-provider), urut `scheduledAt` menurun.
- Query opsional: `machineId`, `status` (MaintenanceStatus)
- Response 200: `Maintenance[]`

### POST /maintenance
Role: TEKNISI_SUNDAYA. Menjadwalkan maintenance. `byId` di-set ke teknisi pembuat; status awal TERJADWAL. Mesin harus ada (404 bila tidak).
- Request: `CreateMaintenanceRequest` { machineId, type (MaintenanceType), scheduledAt, notes? }
- Response 201: `Maintenance`

### PATCH /maintenance/:id/status
Role: TEKNISI_SUNDAYA. Transisi status lewat service (409 bila transisi tidak sah, misalnya TERJADWAL langsung ke SELESAI). `notes` opsional memperbarui catatan.

Sumbu operasional mesin ikut bergerak otomatis dalam transaksi yang sama:
- `BERLANGSUNG`: isi `startedAt`, simpan status mesin saat ini ke `Machine.statusBeforeMaintenance`, lalu setel `Machine.operationalStatus` ke `MAINTENANCE`. Bila mesin sudah MAINTENANCE dari record lain, `statusBeforeMaintenance` tidak ditimpa.
- `SELESAI`: isi `completedAt`, pulihkan `Machine.operationalStatus` ke `statusBeforeMaintenance` (fallback `STANDBY` bila tidak ada jejak), lalu kosongkan jejaknya.

Durasi `startedAt` sampai `completedAt` pada maintenance `CORRECTIVE` menjadi sumber MTBF dan MTTR di dashboard.
- Request: `UpdateMaintenanceStatusRequest` { status (MaintenanceStatus), notes? }
- Response 200: `Maintenance`

---

## Modul Dashboard Sundaya (SSIP)

Monitoring OEE Sundaya. Semua angka turunan, bukan input manual, dan sumbernya dipisah lintas layer karena reason code manual sudah dihapus:

- **Availability** dari Layer 1: `operating / PPT`. PPT = total waktu terpantau minus maintenance terencana; loss = durasi status SETUP ditambah durasi maintenance CORRECTIVE.
- **Performance** dari Layer 1: cycle time ideal dibagi rata-rata `cycleTimeSec` yang dilaporkan Teknisi, dibatasi maksimum 100 persen. Tanpa laporan cycle time nilainya 100 (data belum masuk, bukan mesin lambat).
- **Quality** dari Layer 2: `good / (good + reject)` dari Log Produksi PRODUKSI_HARIAN job yang memakai mesin itu. Tanpa produksi tercatat nilainya 100.
- **OEE** = Availability x Performance x Quality. **Utilization** = durasi RUNNING dibagi total waktu terpantau.
- **MTBF/MTTR** dari record Maintenance CORRECTIVE (`startedAt` sampai `completedAt`), menggantikan status BREAKDOWN yang sudah dihapus.

### GET /dashboard/sundaya
Role: SUPER_ADMIN, ADMIN_SUNDAYA, TEKNISI_SUNDAYA. Ringkasan armada.
- Response 200: `SundayaDashboard` { runningMachines, totalMachines, avgOee, utilization, activeBookings, operationalStatusCounts: MachineStatusCount[], rentalMonitoring: RentalMonitoring }
- `activeBookings` = job dengan lifecycle non-terminal (bukan DITOLAK/SELESAI). `avgOee`/`utilization` = rata-rata atas mesin yang punya event Layer 1.
- `rentalMonitoring` { shortestRemainingDays, pendingExtensions, overdueJobs } dihitung dari job AKTIF dan RentalExtension: sisa sewa terpendek (null bila tidak ada job aktif ber-endDate), jumlah pengajuan perpanjangan berstatus DIAJUKAN, dan jumlah job yang endDate-nya sudah lewat.

### GET /machines/:id/metrics
Role: SUPER_ADMIN, ADMIN_SUNDAYA, TEKNISI_SUNDAYA. Metrik OEE satu mesin dari event Layer 1-nya. Mesin tidak ada 404.
- Response 200: `MachineMetrics` { machineId, machineNumber, availability, performance, quality, oee, utilization, mtbfHours, mttrHours, totalDowntimeHours }

---

## Modul Dashboard Penyewa (SSIP)

Dashboard sisi Penyewa. Berbagi prefix `/dashboard` dengan Dashboard Sundaya tapi modul terpisah. Semua angka diturunkan dari data yang sudah ada (mold tracking, Job, Log Produksi, Log Pengiriman), bukan input manual. Scoping tenant di server.

### GET /dashboard/manager
Role: MANAGER_PENYEWA. Ringkasan tenant sendiri.
- Response 200: `ManagerDashboard` { moldsAtSundaya, ongoing, totalGoodProduct, avgAchievement }
- `moldsAtSundaya` = mold milik Manager yang fisik ada di Sundaya (trackingStatus RECEIVED atau PRODUCTION). `ongoing` = job lifecycle AKTIF. `totalGoodProduct` = jumlah good dari Log Produksi. `avgAchievement` = rata-rata (good / targetOutput) job bertarget, persen.

### GET /dashboard/manager/mold-plan
Role: MANAGER_PENYEWA. Perkembangan plan mold: satu baris per cetakan milik Manager, menggabung tracking fisik, job/mesin, capaian produksi, dan realisasi material. Dipakai tabel dashboard Manager, panel detail cepat, dan detail cetakan.
- Response 200: `MoldPlanRow[]` { moldId, kodeMold, namaProduk, cavity, tonaseTon, trackingStatus, jobId, jobNumber, lifecycle, machineNumber, progressMolding, targetOutput, totalGoodProduct, totalReject, achievement, rejectRate, sisaHariSewa, etaHari, planMaterialUtama, estimasiKg, materialUsedKg, materialRemainingKg, materialUsagePercent, endDate }
- Cetakan tanpa booking memberi angka produksi nol dan field booking null. `targetOutput`, `estimasiKg`, dan `planMaterialUtama` selalu dari master cetakan (tidak lagi ada salinan di Job).
- Material diperlakukan sebagai **kuota**: `estimasiKg` batas, `materialUsedKg` akumulasi terpakai dari Log Produksi, `materialRemainingKg` selisihnya (tidak pernah negatif), `materialUsagePercent` dibatasi 100. Tidak ada lagi pembandingan kedatangan vs pemakaian.
- `etaHari` = sisa target dibagi rata-rata output per hari produksi (null bila belum bisa dihitung, 0 bila target tercapai).

### GET /dashboard/manager/cycle-production
Role: MANAGER_PENYEWA. Capaian produksi dan kuota material dikelompokkan per booking berjalan, dirinci tiap cetakan. Semua turunan Log Produksi.
- Response 200: `JobCycleProduction[]` { jobId, jobNumber, lifecycle, machineNumber, sisaHariSewa, molds: `MoldCycleProduction[]` }
- `MoldCycleProduction` { moldId, kodeMold, namaProduk, targetOutput, totalGoodProduct, totalReject, totalOutput, achievement, rejectRate, remainingTarget, planMaterialUtama, planMaterialKg, materialUsedKg, materialRemainingKg, materialUsagePercent, harian: `DailyCycleEntry[]` }
- `DailyCycleEntry` { occurredAt, goodProduct, rejectCount, materialUsedKg, catatan }, terbaru dulu, hanya event PRODUKSI_HARIAN.

### GET /dashboard/job
Role: ADMIN_PENYEWA. Satu baris **per cetakan** pada booking aktif tenant induknya (lewat `parentId`). Booking dengan dua cetakan menghasilkan dua baris.
- Response 200: `JobDashboard[]` { jobId, jobNumber, lifecycle, machineNumber, moldKode, moldProduk, moldCavity, progressMolding, targetOutput, achievement, totalGoodProduct, totalReject, planMaterialKg, materialUsedKg, materialRemainingKg, endDate, sisaHariSewa, latestLogAt }
- Diturunkan dari Log Produksi cetakan itu: `progressMolding` = nilai terakhir dilaporkan, `materialUsedKg` = akumulasi terpakai, `materialRemainingKg` = plan minus terpakai; `latestLogAt` = waktu event terbaru. `sisaHariSewa` dihitung dari `endDate` (negatif berarti lewat jatuh tempo, null bila job belum aktif).

### GET /dashboard/job/logs
Role: ADMIN_PENYEWA. Log utama: seluruh event dari semua job tenant induk dalam satu timeline, terbaru dulu, dibatasi 50 event.
- Response 200: `JobLogEntry[]` (bentuk `LogProduksi` ditambah `jobNumber` dan `moldKode`)
