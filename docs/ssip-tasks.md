# SSIP Task Breakdown (per modul, 2 developer)

Output langkah planning-and-task-breakdown. Turunan dari `docs/ssip-spec.md`.
Dokumentasi tanpa em dash.

## Status

- **Selesai**: Fase 0 (schema, shared, seed, baseline) PR #13. Auth (RBAC 5
  role + hierarki tenant) PR #14. Seluruh modul backend Dev A dan Dev B.
  Seluruh halaman web Dev A (Sundaya) dan Dev B (Penyewa).
- **Selesai (revisi alur otomatis)**: mold tracking dipersempit ke 6 state dan
  digerakkan event domain, Log Pengiriman jadi log informasi, Log Penerimaan
  modul baru, notifikasi dua arah, status mesin Teknisi tinggal Setup/Running
  dengan pemulihan status pasca-maintenance, OEE tiga dimensi lintas layer,
  dashboard tiap role jadi read-only.
- **Sisa**: revisi detail sisi Manager Penyewa dan Admin Penyewa.

Aturan domain yang mengikat pekerjaan selanjutnya ada di `PROJECT_CONTEXT.md`
bagian 5a (mold tracking otomatis) dan `docs/ssip-spec.md` bagian 6 dan 6a.

## Konvensi kerja

- Tiap task = 1 branch feature dari `refactor/ssip-domain` (atau dari `main`
  setelah #13 dan #14 merge), 1 PR per modul.
- Modul dari `apps/api/legacy/` dipindah balik ke `src/<domain>`, disesuaikan ke
  schema baru, lalu di-wire di `src/app.module.ts`. Lihat `legacy/README.md`.
- Definition of Done tiap task: build + test + lint hijau, endpoint sesuai
  kontrak, RBAC + validasi ada, `docs/api-contract.md` diperbarui,
  `/ponytail-review` sebelum PR.
- Transisi status selalu lewat service layer (peta transisi konstan).

## Titik koordinasi (dikerjakan berdua, hindari konflik)

Dua modul disentuh dua dev. Sepakati pemilik file, split per endpoint:
- **Modul `jobs`**: Dev B bikin endpoint booking (Manager), Dev A bikin assign +
  lifecycle (Admin Sundaya). Pemilik file service = Dev A; Dev B tambah method
  lewat PR kecil atau pair. Kerjakan setelah `machines` + `molds` ada.
- **Modul `molds`**: Dev B bikin CRUD cetakan (Manager). Endpoint transisi
  tracking (`PATCH /molds/:id/tracking`) dipakai Admin Sundaya (Dev A). Pemilik
  file = Dev B; Dev A tambah endpoint tracking.

## Urutan dependensi

```
Fase 0 + Auth (selesai)
  -> [2] machines (A) , molds CRUD (B) , un-quarantine notifications (siapa saja)
  -> [3] jobs: booking (B) + assign/lifecycle (A)
  -> [4] operationalData (A) , maintenance (A) , logProduksi (B)
  -> [5] mold tracking transisi (A) , logPengiriman (B) , dashboards (A & B)
  -> [6] web per modul (A sisi Sundaya, B sisi Penyewa)
```

---

## Dev A - sisi Sundaya

### A1. Machines (remodel dari legacy)
Depends: Fase 0. Pindahkan `legacy/machines` ke `src/machines`.
- Tambah `operationalStatus` + `tonaseTon`; pertahankan warranty (reuse
  `warranty.ts`) dan arsip.
- CRUD: `GET /machines` (staf), `POST/PATCH /machines` (ADMIN_SUNDAYA),
  archive/unarchive.
- Owner selalu user Sundaya (single-provider ditegakkan di service).
- Acceptance: mesin dibuat dengan dua sumbu status terpisah; PENYEWA tidak bisa
  akses; test transisi `status` (ketersediaan) valid; build/test/lint hijau.

### A2. Jobs - assign + lifecycle (koordinasi dengan B2)
Depends: A1, molds (B1). Modul `jobs` (evolve dari `legacy/rentals`).
- `GET /jobs` scoped (Admin Sundaya lihat semua).
- `PATCH /jobs/:id/assign` (ADMIN_SUNDAYA): set `machineId`, lifecycle
  DIAJUKAN -> DIKONFIRMASI, `assignedById`, `confirmedAt`. Validasi tonase mesin
  cocok mold.
- `PATCH /jobs/:id/reject` (alasan), transisi lifecycle lain (DIKIRIM, AKTIF,
  SELESAI_SEWA, DIKEMBALIKAN, SELESAI) lewat service.
- Hitung `jobStatus` (ON_SCHEDULE/WARNING/CRITICAL) dari sisa sewa
  (RENTAL_WARNING_DAYS/RENTAL_CRITICAL_DAYS di shared).
- Acceptance: assign hanya oleh Admin Sundaya; mesin non-TERSEDIA ditolak;
  test peta transisi lifecycle + kalkulasi jobStatus.

### A3. Mold tracking transisi (koordinasi dengan B1)
> **Digantikan revisi alur otomatis.** Tracking kini 6 state dan empat status
> pertama digerakkan event domain, bukan endpoint transisi. Lihat
> `PROJECT_CONTEXT.md` bagian 5a. Deskripsi di bawah adalah rencana awal.
Depends: molds (B1). Endpoint di modul `molds`.
- `PATCH /molds/:id/tracking` (ADMIN_SUNDAYA, sebagian TEKNISI untuk setup):
  transisi 10-state linear, tulis `MoldTrackingEvent` (byId, at).
- Acceptance: transisi tidak sah ditolak (mis. PLANNING langsung ke COMPLETED);
  event RECEIVED tersimpan (dipakai Log Pengiriman); test peta transisi.

### A4. Operational Data (Layer 1, Teknisi)
Depends: A1. Modul baru `operational` atau di `machines`.
- `POST /machines/:id/operational` (TEKNISI_SUNDAYA): append status +
  downtimeReason + cycleTime + occurredAt. Update `Machine.operationalStatus`
  ke status terakhir.
- `GET /machines/operational` ringkasan status realtime semua mesin.
- Append-only (tanpa update/delete).
- Acceptance: hanya Teknisi; reason wajib saat status non-RUNNING; test append +
  update operationalStatus.

### A5. Maintenance (Teknisi)
Depends: A1. Modul `maintenance`.
- `GET/POST /maintenance`, `PATCH /maintenance/:id/status`
  (TERJADWAL/BERLANGSUNG/SELESAI). RBAC TEKNISI (write), ADMIN_SUNDAYA (read).
- Acceptance: transisi status maintenance valid; test.

### A6. Dashboard Sundaya + metrik mesin
Depends: A4, A2. Modul `reports`/`dashboard` (reuse `legacy/production/
efficiency.ts` sebagai basis).
- Hitung Availability, Performance, Quality, OEE, Utilization, MTBF, MTTR, total
  downtime dari OperationalData.
> **Direvisi.** Sumber OEE sekarang lintas layer dan reason code six big losses
> dihapus. Lihat `docs/ssip-spec.md` bagian 6a.
- `GET /dashboard/sundaya`, `GET /machines/:id/metrics`.
- Acceptance: angka dihitung dari event Layer 1 (bukan input manual); test
  fungsi hitung dengan data contoh.

---

## Dev B - sisi Penyewa

### B1. Molds CRUD (Manager)
Depends: Fase 0. Modul `molds`.
- `GET /molds` (Manager, scoped tenant), `POST /molds` (status PLANNING),
  `PATCH /molds/:id`. Plan material opsional.
- Acceptance: Manager hanya lihat mold miliknya; Admin Penyewa tidak akses;
  test scoping tenant.

### B2. Jobs - booking (koordinasi dengan A2)
Depends: B1, machines (A1). Modul `jobs`.
- `POST /jobs` (MANAGER_PENYEWA): pilih mold, plan material, plan waktu,
  `rencanaKirimMold`. **Tanpa `machineId`** (di-assign Admin Sundaya).
- `GET /jobs` scoped ke tenant Manager; Admin Penyewa lihat job aktif di lokasi.
- Acceptance: booking tanpa mesin berhasil (lifecycle DIAJUKAN); Manager tidak
  bisa set mesin; test validasi + scoping.

### B3. Log Produksi (Layer 2, Admin Penyewa)
Depends: B2. Modul `log-produksi` (pengganti `legacy/production`).
- `GET /jobs/:id/logs` timeline; `POST /jobs/:id/logs` (ADMIN_PENYEWA) append
  event (MATERIAL_DATANG/PRODUKSI_HARIAN/PROGRESS_MOLDING) sesuai field.
- Append-only; scoping tenant.
- Acceptance: hanya Admin Penyewa tenant terkait; field sesuai eventType; test
  append + tolak update/delete.

### B4. Log Pengiriman (turunan, read-only, Manager)
> **Digantikan revisi alur otomatis.** Log Pengiriman sekarang tabel log
> informasi dengan endpoint tulis, bukan view turunan, dan berpasangan dengan
> Log Penerimaan milik Admin Sundaya. Lihat `docs/ssip-spec.md` bagian 6.
Depends: B2, B3, A3. Modul `pengiriman` (query saja, tanpa tabel).
- `GET /pengiriman` atau `GET /jobs/:id/pengiriman`: gabung rencana
  (`Job.rencanaKirimMold` + plan material) vs aktual (LogProduksi
  MATERIAL_DATANG + MoldTrackingEvent RECEIVED). Hitung selisih + DeliveryStatus
  + on-time rate.
- **Tanpa endpoint tulis apa pun.**
- Acceptance: baris muncul dari data booking + log; status dihitung benar
  (on-time/terlambat/overdue); test fungsi hitung selisih + status.

### B5. Dashboard Manager + Dashboard job
Depends: B1, B2, B3, B4. Modul `dashboard`.
- `GET /dashboard/manager` (mold di Sundaya, ongoing, total good, achievement,
  on-time delivery rate).
- `GET /dashboard/job` (Admin Penyewa: progress job, mesin assigned, material
  remaining, log terbaru).
- Acceptance: scoping tenant; angka konsisten dengan log; test agregasi.

---

## Web (fase 6, setelah backend modul masing-masing)

Sisi web masih refer domain lama, ditulis ulang paralel dengan backend.

**Fondasi (kerjakan dulu, koordinasi):**
- Auth pages: landing publik (login + register Manager), route internal staf
  (`/internal`), role-based routing. Update `roleLabels`, `AuthContext`,
  `ProtectedRoute` ke 5 role.

**Dev A (sisi Sundaya):** halaman Dashboard Admin Sundaya (baca saja), Booking
(approval + assign + lifecycle), Log Penerimaan, Mold tracking (papan otomatis),
Machine monitoring (input Layer 1: Setup/Running + cycle time), Maintenance.

**Dev B (sisi Penyewa):** landing + register/invite, Dashboard Manager, Cetakan,
Booking mesin (form tanpa mesin), Log Pengiriman (log informasi), Dashboard job +
Log Produksi (Admin Penyewa).

Referensi tata letak: histori `ssip-wireframe.html` (dihapus dari repo, ada di
git history sebelum commit remodel) dan `PROJECT_CONTEXT.md`.
