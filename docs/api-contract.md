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

## Modul Mesin

### GET /machines
Role: semua terautentikasi. Penyewa yang memakai ini untuk katalog hanya menerima mesin berstatus TERSEDIA (disaring server).
- Query opsional: `status` (MachineStatus), `archived` (`'true'` untuk melihat mesin yang diarsipkan; default/tanpa param menyembunyikan mesin arsip)
- Response 200: `Machine[]`

### GET /machines/:id
Role: semua terautentikasi.
- Response 200: `Machine`

### POST /machines
Role: PENYEDIA, ADMIN. ownerId di-set ke Penyedia pembuat.
- Request: `CreateMachineRequest` { machineNumber, spesifikasi, standardRatio, warrantyStart, warrantyDurationMonths }
- Response 201: `Machine`

### PATCH /machines/:id
Role: PENYEDIA (pemilik), ADMIN.
- Request: `UpdateMachineRequest` { spesifikasi?, standardRatio?, warrantyStart?, warrantyDurationMonths? }
- Response 200: `Machine`

### PATCH /machines/:id/archive
Role: PENYEDIA (pemilik), ADMIN. Arsip (soft-delete) — set `isArchived: true`. Mesin tetap ada di database (relasi rental/batch/check tidak hilang), cuma disembunyikan dari daftar aktif kecuali diminta lewat `?archived=true`.
- Response 200: `Machine`

### PATCH /machines/:id/unarchive
Role: PENYEDIA (pemilik), ADMIN. Kembalikan mesin dari arsip — set `isArchived: false`.
- Response 200: `Machine`

### PATCH /machines/:id/complete-maintenance
Role: PENYEDIA (pemilik), ADMIN. Tandai maintenance selesai — mesin MAINTENANCE kembali TERSEDIA, siap diajukan sewa lagi. Ditolak (409) bila status mesin saat ini bukan MAINTENANCE (transisi divalidasi lewat `MACHINE_FLOW`, sama seperti transisi status di modul Sewa).
- Response 200: `Machine`

### GET /machines/:id/history
Role: PENYEDIA (pemilik), ADMIN. Rekam jejak satu mesin.
- Response 200: `MachineHistory` { rentals: Rental[], conditionChecks: ConditionCheck[] }

---

## Modul Sewa

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

Notifikasi in-app lintas role, dibuat otomatis oleh server di titik transisi siklus sewa dan produksi (bukan dibuat langsung lewat endpoint publik). Frontend polling `GET /notifications` secara berkala. Pengiriman email belum diimplementasikan (menyusul).

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
