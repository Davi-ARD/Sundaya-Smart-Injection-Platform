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
Publik.
- Request: `LoginRequest` { email, password }
- Response 200: `AuthResponse` { accessToken, user: User }

### GET /auth/me
Semua role terautentikasi.
- Response 200: `User`

---

## Modul User

### GET /users
Role: ADMIN.
- Query opsional: `role`, `isActive`
- Response 200: `User[]`

### POST /users
Role: ADMIN. Membuat user role apa pun.
- Request: `CreateUserRequest` { nama, email, password, role, parentId? }
- Response 201: `User`

### PATCH /users/:id
Role: ADMIN.
- Request: `UpdateUserRequest` { nama?, email?, role?, isActive? }
- Response 200: `User`

### PATCH /users/:id/deactivate
Role: ADMIN.
- Response 200: `User`

### POST /operators
Role: PENYEWA. Membuat sub-akun Operator di bawah Penyewa ini (parentId di-set otomatis ke id Penyewa).
- Request: `CreateOperatorRequest` { nama, email, password }
- Response 201: `User`

### GET /operators
Role: PENYEWA. Daftar operator di bawah Penyewa ini.
- Response 200: `User[]`

---

## Modul Mesin

### GET /machines
Role: semua terautentikasi. Penyewa yang memakai ini untuk katalog hanya menerima mesin berstatus TERSEDIA (disaring server).
- Query opsional: `status` (MachineStatus)
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

### DELETE /machines/:id
Role: PENYEDIA (pemilik), ADMIN.
- Response 204

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
Role: semua terautentikasi, disaring per kepemilikan.
- Query opsional: `status` (RentalStatus)
- Response 200: `Rental[]`

### GET /rentals/:id
Role: pihak terkait (penyewa, penyedia) atau ADMIN.
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
Role: PENYEWA. Konfirmasi mesin diterima. Status DIKIRIM ke AKTIF. Sejak ini Operator boleh input batch.
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
- Response 200: `PenyewaDashboard` { activeRentals: [{ rentalId, machineNumber, remainingDays }], efficiencyByBatch: [{ batchId, machineNumber, date, efficiency }], rejectRate, machineIssueBatches: ProductionBatch[] }

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
