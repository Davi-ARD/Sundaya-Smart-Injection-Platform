# SSIP — Sundaya Smart Injection Platform
## Project Knowledge untuk AI Coding Assistant (Cursor)

Dokumen ini adalah source of truth untuk memahami konteks bisnis, struktur data,
dan konvensi teknis file wireframe `ssip-wireframe.html`. Baca dokumen ini
sebelum melakukan perubahan apa pun pada wireframe atau saat mengembangkan
lebih lanjut menjadi aplikasi nyata.

---

## 1. Apa itu SSIP

SSIP adalah platform digital dari **PT Sundaya Indonesia**, penyedia jasa
sewa mesin **Injection Molding**. Sundaya tidak hanya menyewakan mesin,
tapi juga menyediakan sistem digital sebagai media kolaborasi dengan
**Penyewa** (customer yang menyewa mesin).

Entitas utama sistem: **Production Job**. Satu Booking menghasilkan satu
Production Job, yang menjadi pusat seluruh transaksi — booking, mold
tracking, operasional mesin, log produksi, material, sampai laporan akhir.

## 2. Prinsip inti: Dual Layer Manufacturing Information System

Ini adalah konsep paling penting dan TIDAK BOLEH dilanggar saat membuat
fitur baru. Ada dua jenis data yang terpisah dan tidak boleh dicampur:

| | Layer 1 — Operational Data | Layer 2 — Log Produksi |
|---|---|---|
| Diinput oleh | Teknisi Sundaya | Admin Penyewa (berada di lokasi Sundaya) |
| Sifat data | Real time | Event log / timeline |
| Contoh field | Running, Setup, Standby, Breakdown, Maintenance, Cycle Time, Downtime, Running Hour | Material datang, Log produksi harian (Good/Reject/Material remaining), Progress molding (Planning / Ongoing / Sudah diproduksi) |
| Aturan hapus | Tidak boleh dihapus, hanya dikoreksi via event baru | Append-only event; koreksi via event baru |
| Menghasilkan | Availability, Performance, Quality, OEE, Utilization | Production Report, Material Report, Customer Dashboard, Production Progress |

Kalau nanti diminta menambah field atau form baru, selalu tanya: field ini
masuk Layer 1 (operasional mesin, real-time, milik Teknisi Sundaya) atau
Layer 2 (log produksi, milik Admin Penyewa)? Jangan campur keduanya dalam
satu form/tabel.

## 3. Pembagian tanggung jawab

**Sundaya bertanggung jawab atas:** Mesin, Teknisi, Jadwal Mesin,
**Assign mesin ke booking**, Maintenance, OEE, Machine Performance,
Rental Management.

**Penyewa bertanggung jawab atas:** Mold & booking (Manager), Material &
Log Produksi di lokasi Sundaya (Admin Penyewa).

## 4. User roles

- **Super Admin** — konfigurasi sistem.
- **Admin Sundaya** — approval booking, **assign mesin**, jadwal mesin, rental management, dashboard, OEE monitoring.
- **Teknisi Sundaya** — input Operational Data (Layer 1).
- **Manager Penyewa** — plan & kelola cetakan/mold, booking mesin (tanpa pilih mesin), monitoring dashboard produksi.
- **Admin Penyewa** — berada di lokasi Sundaya; input Log Produksi (Layer 2) dan pantau job operasional harian. **Tidak** mengelola booking/cetakan.

## 5. Business process (urutan end-to-end)

1. Manager Penyewa daftarkan cetakan/mold (status Planning) beserta plan material & target.
2. Manager Penyewa booking — memilih mold yang akan dikirim, plan material, dan waktu sewa.
   **Tidak memilih mesin** saat booking.
3. Admin Sundaya approval **dan assign mesin**.
4. Penyewa kirim mold (status → Ready Delivery → Delivery).
5. Mold diterima Sundaya.
6. Teknisi setup mold.
7. Mesin running.
8. Teknisi input Operational Data (Layer 1).
9. Admin Penyewa (datang ke Sundaya) input **Log Produksi** (timeline): material datang,
   produksi harian, progress molding. Mesin yang dipakai terlihat dari assign Sundaya.
10. Mold dikirim kembali.
11. Job selesai.

**Catatan flow booking (penting):**
- Manager Penyewa punya master mold & mengajukan booking.
- Booking = pilih **cetakan yang akan dikirim** + **plan material** + **plan waktu**.
- **Mesin di-assign Admin Sundaya**, bukan dipilih Manager.
- Admin Penyewa di Sundaya melihat mesin assigned lewat Log produksi / dashboard job.

**Catatan pembagian tampilan Penyewa (penting):**
- **Tampilan Manager** = plan cetakan, booking mesin, dashboard monitoring.
- **Tampilan Admin Penyewa** = khusus orang yang datang ke Sundaya (dashboard job + Log produksi).
  Tidak ada menu Cetakan / Booking di sisi Admin.

**Catatan Log Produksi (penting):**
- Menggantikan konsep “Daily Production Audit”.
- Semua event dalam **satu timeline** per job/mold.
- Jenis event: Material datang | Log produksi harian | Progress molding
  (Planning / Ongoing / Sudah diproduksi).

**Packing & Shipment (belum di-scope wireframe saat ini):**
Field lama dari blueprint untuk status barang jadi (dikemas / dikirim ke
customer), bukan kirim mold. Belum dimasukkan ke Log produksi sampai user
meminta. Kalau nanti ditambah, paling natural sebagai jenis event timeline.

## 6. Status enums (gunakan persis ini, jangan improvisasi nama status baru)

**Mold Tracking status** (urutan linear — sisi tracking fisik mold):
Planning → Ready Delivery → Delivery → Received → Waiting Production →
On Machine → Production → Repair → Send Back → Completed

**Progress molding** (status di Log Produksi — Layer 2):
Planning, Ongoing, Sudah diproduksi

**Machine status** (input Teknisi):
Running, Setup, Standby, Breakdown, Maintenance

**Production Job status** (dashboard Sundaya):
On Schedule, Warning, Critical, Completed

**Rental status rules:**
- Warning jika sisa sewa ≤ 3 hari
- Critical jika sisa sewa ≤ 1 hari
- Overdue jika melewati End Date
- Penyewa bisa ajukan Extension Request

## 7. Functional modules (MVP scope)

Booking (tanpa pilih mesin di sisi Penyewa), Assign Mesin (Admin Sundaya),
Rental Management, Mold Tracking, Machine Monitoring, Log Produksi,
Dashboard Sundaya, Dashboard Penyewa, Notification, Report. Master Data
(Customer, Machine, Mold, Material, User) mendasari semua modul di atas.

**Future development (belum di-scope, jangan dibangun dulu kecuali diminta):**
QR Code Mold, Barcode Material, Mobile App, WhatsApp Notification, SAP
Business One Integration, IoT Machine Counter, Automatic Cycle Time, AI
Production Prediction, Predictive Maintenance, Smart Scheduling,
Packing/Shipment sebagai event log.

## 8. Data yang dihitung otomatis oleh sistem (jangan buat input manual untuk ini)

Availability, Performance, Quality, OEE, Utilization, Production
Progress, Achievement, Remaining Target, Material Used, Reject Rate,
ETA, Remaining Rental Time.

---

## 9. Struktur file wireframe (`ssip-wireframe.html`)

File wireframe adalah **single-file HTML/CSS/JS statis**, tanpa
framework/build step, tanpa dependency eksternal. Tujuannya supaya mudah
dibuka di browser (double click) dan mudah diedit langsung.

### Struktur navigasi
- Tiga role di top bar: `Tampilan Sundaya`, `Tampilan Admin Penyewa`, dan
  `Tampilan Manager`, dikontrol oleh objek JS `nav` (`nav.sundaya`,
  `nav.penyewa`, `nav.manager`).
- **Tampilan Manager** = Manager Penyewa: Dashboard monitoring + Cetakan + Booking mesin.
- **Tampilan Admin Penyewa** = Admin yang datang ke Sundaya: Dashboard job + Log produksi saja.
- Setiap role punya daftar menu sidebar sendiri.
- Setiap menu item punya `data-screen` yang match dengan `id` dari sebuah
  `<div class="screen">` di dalam `.main`.
- Fungsi `showScreen(id, el)` toggle class `.active` untuk switch antar
  layar. Fungsi `setRole(role)` rebuild sidebar sesuai role dan tampilkan
  screen pertama. Fungsi `toggleLogFields()` switch field form Log produksi
  sesuai jenis event.

### Screen ID yang sudah ada
| Screen ID | Role | Konten |
|---|---|---|
| `dash-sundaya` | Sundaya | Dashboard utama: metric cards, production progress table, rental monitoring, machine loading |
| `booking` | Sundaya | List booking + approval + form assign mesin |
| `mold` | Sundaya | Kanban mold tracking |
| `machine` | Sundaya | Form input status mesin (Teknisi) + list status semua mesin |
| `dash-penyewa` | Admin Penyewa | Dashboard job di lokasi Sundaya: progress, mesin assigned, material, log terbaru |
| `log-produksi` | Admin Penyewa | Form tambah log + timeline event (material / produksi harian / progress molding) |
| `dash-manager` | Manager | Dashboard: semua plan mold, tracking, progress molding, target vs produksi, ETA |
| `cetakan` | Manager | Kelola mold: form tambah cetakan (Planning), daftar mold, rincian cycle & material |
| `booking-form` | Manager | Form booking: pilih mold → plan material → plan waktu (tanpa pilih mesin) |

### Menambah screen baru
1. Tambahkan entry baru di object `nav.sundaya` atau `nav.penyewa` (format: `{id, label, icon}`).
2. Buat `<div class="screen" id="ID_BARU">...</div>` baru di dalam `.main`, ikuti pola card yang sudah ada.
3. Jangan ubah fungsi `showScreen`/`setRole` kecuali menambah role baru.

### Design tokens (CSS variables di `:root`)
Semua warna dan radius pakai CSS var, jangan hardcode hex baru di tengah
markup. Var utama: `--bg`, `--surface`, `--surface-2`, `--border`,
`--text`, `--text-2`, `--text-mute`, `--accent`/`--accent-bg`,
`--success`/`--success-bg`, `--warning`/`--warning-bg`,
`--danger`/`--danger-bg`, `--radius`.

### Komponen reusable (class CSS)
- `.card` — container putih dengan border & radius, unit dasar semua panel.
- `.metric-label` + `.metric-value` — untuk KPI card.
- `.badge` + varian warna (`.badge-success`, `.badge-warning`,
  `.badge-danger`, `.badge-accent`, `.badge-mute`) — status pill, mapping
  ke status enum di bagian 6.
- `.bar` + `.bar-fill` — progress bar, `width` inline % dan `background`
  warna sesuai status.
- `.row` — baris label-value di dalam card (rental monitoring, machine loading, dll).
- `.kanban` / `.kcol` / `.kcard` — kanban board untuk mold tracking.
- `.stepper` + `.step-active` — linear progress indicator (dipakai di
  tracking mold dashboard penyewa).
- `.timeline` / `.titem` / `.ttime` / `.tbody` / `.ttitle` — timeline Log produksi.
- Form: `label`, `input`, `select`, `textarea`, `.btn`, `.btn-primary`,
  `.btn-row`.

### Konvensi penamaan & bahasa
- Semua label UI pakai **Bahasa Indonesia**, konsisten dengan istilah di
  blueprint (jangan translate ke Inggris kecuali diminta).
- Nama status/enum tetap pakai istilah dari blueprint apa adanya (lihat
  bagian 6), jangan disingkat atau diganti sinonim.

---

## 10. Instruksi untuk Cursor saat membantu perubahan

- Saat diminta menambah field/form, cek dulu field itu masuk Layer 1 atau
  Layer 2 (bagian 2), dan role mana yang berwenang menginputnya (bagian 4).
- Saat menambah status baru, jangan buat istilah baru di luar enum bagian 6
  kecuali user eksplisit minta perluasan scope.
- File ini statis/no-build — kalau project berkembang jadi aplikasi nyata
  (React/backend), tanyakan dulu ke user sebelum migrasi stack, jangan
  asumsi framework.
- Kalau ragu apakah sebuah data dihitung sistem otomatis atau diinput
  manual, cek bagian 8 dulu.
- Jangan hardcode warna baru di luar CSS variables yang sudah ada di
  bagian 9, supaya konsisten dengan desain lain.
- Booking mesin & Cetakan hanya di **Tampilan Manager**; jangan dipindah
  ke Admin Penyewa kecuali user eksplisit meminta.
- Packing/Shipment jangan ditambahkan kecuali user eksplisit meminta.
