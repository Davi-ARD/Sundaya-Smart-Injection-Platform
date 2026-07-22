# SSIP - Sundaya Smart Injection Platform
## Project Knowledge untuk Claude

Dokumen ini adalah source of truth konteks bisnis dan domain SSIP: peran, alur
proses, aturan data, dan enum. Spec teknis (schema Prisma, enum, state machine,
matriks RBAC, delta API) ada di `docs/ssip-spec.md`. Implementasi berupa
aplikasi nyata: NestJS di apps/api, React di apps/web. Baca dokumen ini sebelum
mengubah domain atau menambah fitur.

---

## 1. Apa itu SSIP

SSIP adalah platform digital dari **PT Sundaya Indonesia**, penyedia jasa
sewa mesin **Injection Molding**. Sundaya tidak hanya menyewakan mesin,
tapi juga menyediakan sistem digital sebagai media kolaborasi dengan
**Penyewa** (customer yang menyewa mesin).

**Single-provider (penting).** Penyedia di sistem ini hanya Sundaya. Tidak ada
konsep multi-penyedia. Sistem dikembangkan dan dimiliki oleh Sundaya. Sisi
yang jamak (multi-tenant) hanya **Penyewa**: banyak perusahaan penyewa, dan
tiap perusahaan penyewa punya datanya sendiri yang terisolasi (tenant per
perusahaan penyewa). Jangan membangun abstraksi "penyedia" yang generik.

Entitas utama sistem: **Production Job**. Satu Booking menghasilkan satu
Production Job, yang menjadi pusat seluruh transaksi: booking, mold
tracking, operasional mesin, log produksi, material, sampai laporan akhir.

## 2. Prinsip inti: Dual Layer Manufacturing Information System

Ini adalah konsep paling penting dan TIDAK BOLEH dilanggar saat membuat
fitur baru. Ada dua jenis data yang terpisah dan tidak boleh dicampur:

| | Layer 1 - Operational Data | Layer 2 - Log Produksi |
|---|---|---|
| Diinput oleh | Teknisi Sundaya | Admin Penyewa (berada di lokasi Sundaya) |
| Sifat data | Real time | Event log / timeline |
| Contoh field | Running, Setup, Standby, Breakdown, Maintenance, Cycle Time, Downtime + alasan (reason code), Running Hour, Shot Count | Material datang, Log produksi harian (Good/Reject/Material remaining), Progress molding (Planning / Ongoing / Sudah diproduksi) |
| Aturan hapus | Tidak boleh dihapus, hanya dikoreksi via event baru | Append-only event; koreksi via event baru |
| Menghasilkan | Availability, Performance, Quality, OEE, Utilization, MTBF, MTTR, breakdown six big losses | Production Report, Material Report, Customer Dashboard, Production Progress |

Kalau nanti diminta menambah field atau form baru, selalu tanya: field ini
masuk Layer 1 (operasional mesin, real-time, milik Teknisi Sundaya) atau
Layer 2 (log produksi, milik Admin Penyewa)? Jangan campur keduanya dalam
satu form/tabel.

**Metrik pemantauan mesin (standar industri) tetap milik Layer 1.** Semua
pengembangan pemantauan mesin (MTBF, MTTR, downtime reason code, six big
losses, availability breakdown) adalah pengayaan Layer 1, dihitung dari event
status mesin yang sudah diinput Teknisi. Ini tidak mengubah alur bisnis:
Teknisi tetap satu-satunya penginput status mesin, hanya form-nya diperkaya
dengan pilihan alasan downtime. Jangan buat input manual untuk angka yang
bisa dihitung (lihat bagian 8).

## 3. Pembagian tanggung jawab

**Sundaya bertanggung jawab atas:** Mesin, Teknisi, Jadwal Mesin,
**Assign mesin ke booking**, Maintenance, OEE, Machine Performance,
Rental Management. Tanggung jawab ini dipecah antara dua peran staf Sundaya:

- **Admin Sundaya (manajerial/administratif):** approval booking, assign
  mesin, jadwal mesin, rental management, monitoring OEE & dashboard, rencana
  maintenance, laporan. Tidak menginput status mesin real-time.
- **Teknisi Sundaya (operasional lapangan):** input Operational Data Layer 1
  (status mesin real-time, cycle time, downtime + alasan, running hour),
  eksekusi setup mold dan maintenance. Tidak mengelola booking/assign/rental.

**Penyewa bertanggung jawab atas:** Mold & booking & rencana pengiriman
(Manager), Material & Log Produksi di lokasi Sundaya (Admin Penyewa).

## 4. User roles

Lima peran fungsional. Perhatikan cara akses dan hierarki akun di bagian 4a.

- **Super Admin** - konfigurasi sistem, kelola akun staf Sundaya. Staf Sundaya.
- **Admin Sundaya** - approval booking, **assign mesin**, jadwal mesin,
  rental management, dashboard & OEE monitoring, rencana maintenance, laporan.
  Staf Sundaya.
- **Teknisi Sundaya** - input Operational Data (Layer 1), setup mold, eksekusi
  maintenance. Staf Sundaya.
- **Manager Penyewa** - plan & kelola cetakan/mold, booking mesin (tanpa pilih
  mesin), rencana pengiriman (Log Pengiriman), monitoring dashboard produksi.
  Akun **induk (parent)** dari sebuah perusahaan penyewa. Bisa berdiri sendiri.
- **Admin Penyewa** - berada di lokasi Sundaya; input Log Produksi (Layer 2)
  dan pantau job operasional harian. **Tidak** mengelola booking/cetakan.
  Akun **anak (child)** milik satu Manager Penyewa. **Tidak bisa berdiri
  sendiri** tanpa Manager Penyewa.

## 4a. Model akses & hierarki akun (penting)

**Landing page publik dikhususkan untuk Penyewa.** Halaman login/register di
domain publik hanya melayani Penyewa. Staf Sundaya tidak login dari sini.

**Registrasi publik hanya untuk Manager Penyewa.** Manager Penyewa mewakili
sebuah perusahaan penyewa dan dapat mendaftar sendiri (self-register) di
landing page. Satu Manager Penyewa sama dengan satu tenant perusahaan penyewa.

**Admin Penyewa dibuat/diundang oleh Manager Penyewa (parent-child).**
Admin Penyewa **tidak** bisa self-register. Manager Penyewa membuat atau
mengundang akun Admin Penyewa di bawah perusahaannya. Konsekuensi:
- Admin Penyewa selalu terikat ke tepat satu Manager Penyewa (tenant yang sama).
- Manager bisa punya nol atau banyak Admin Penyewa.
- Jika Manager Penyewa dinonaktifkan/dihapus, seluruh Admin Penyewa di
  bawahnya ikut nonaktif (child tidak boleh yatim).
- Data Penyewa terscope per tenant: Manager dan Admin-nya hanya melihat data
  perusahaan mereka sendiri.

**Staf Sundaya (Super Admin, Admin Sundaya, Teknisi Sundaya) akses via route
internal tersembunyi.** Contoh path internal: `/internal` (atau `/staff`),
tidak di-link dari landing publik dan tidak punya self-register. Akun staf
Sundaya dibuat internal oleh Super Admin. Satu aplikasi, satu backend auth;
yang membedakan hanyalah halaman masuk terpisah dan redirect berbasis role
setelah autentikasi. Karena single-provider, semua staf berada di bawah satu
organisasi Sundaya.

Ringkasan akses:

| Peran | Cara masuk | Self-register? | Dibuat oleh |
|---|---|---|---|
| Super Admin | Route internal | Tidak | Bootstrap sistem |
| Admin Sundaya | Route internal | Tidak | Super Admin |
| Teknisi Sundaya | Route internal | Tidak | Super Admin / Admin Sundaya |
| Manager Penyewa | Landing publik | Ya | Self-register |
| Admin Penyewa | Landing publik (login saja) | Tidak | Manager Penyewa (parent) |

## 5. Business process (urutan end-to-end)

1. Manager Penyewa daftarkan cetakan/mold (status Planning) beserta plan material & target.
2. Manager Penyewa booking: memilih mold yang akan dikirim, plan material, dan
   waktu sewa. **Tidak memilih mesin** saat booking.
3. Admin Sundaya approval **dan assign mesin**.
4. Manager Penyewa susun **rencana pengiriman** (Log Pengiriman): kapan mold &
   material seharusnya dikirim dan tiba di Sundaya.
5. Penyewa kirim mold (status Ready Delivery lalu Delivery).
6. Mold diterima Sundaya (Received).
7. Teknisi setup mold.
8. Mesin running.
9. Teknisi input Operational Data (Layer 1), termasuk downtime + alasan.
10. Admin Penyewa (datang ke Sundaya) input **Log Produksi** (timeline):
    material datang, produksi harian, progress molding. Mesin yang dipakai
    terlihat dari assign Sundaya. Tanggal aktual material/mold tiba dari sini
    menjadi pembanding rencana di Log Pengiriman.
11. Mold dikirim kembali (Send Back).
12. Job selesai (Completed).

**Catatan flow booking (penting):**
- Manager Penyewa punya master mold & mengajukan booking.
- Booking = pilih **cetakan yang akan dikirim** + **plan material** + **plan waktu**.
- **Mesin di-assign Admin Sundaya**, bukan dipilih Manager.
- Admin Penyewa di Sundaya melihat mesin assigned lewat Log produksi / dashboard job.

**Catatan pembagian tampilan (penting):**
- **Tampilan Admin Sundaya** = approval booking, assign mesin, mold tracking,
  rental management, dashboard & OEE monitoring, rencana maintenance.
- **Tampilan Teknisi Sundaya** = input status mesin real-time (Layer 1),
  eksekusi setup & maintenance.
- **Tampilan Manager** = plan cetakan, booking mesin, Log Pengiriman, dashboard
  monitoring.
- **Tampilan Admin Penyewa** = khusus orang yang datang ke Sundaya (dashboard
  job + Log produksi). Tidak ada menu Cetakan / Booking / Log Pengiriman.

**Catatan Log Produksi (penting):**
- Menggantikan konsep "Daily Production Audit".
- Semua event dalam **satu timeline** per job/mold.
- Jenis event: Material datang | Log produksi harian | Progress molding
  (Planning / Ongoing / Sudah diproduksi).

**Catatan Log Pengiriman (penting, fitur Manager, read-only, tanpa input manual):**
- Milik **Manager Penyewa** saja. Tujuannya membandingkan **rencana** kapan
  material/mold seharusnya dikirim ke Sundaya vs **aktual** kedatangannya.
- **Tidak ada form input di layar ini sama sekali.** Sisi rencana maupun
  aktual sama-sama di-derive, tidak ada satu pun field yang diketik ulang
  khusus untuk Log Pengiriman.
- Sisi **rencana** diambil otomatis dari planning yang sudah diisi Manager di
  tempat lain: tanggal pada field "Rencana kirim mold ke Sundaya" dan plan
  material (material utama, material tambahan, estimasi kg) di form Booking
  mesin (bagian 5, langkah 2) dan Cetakan. Begitu Manager mengisi rencana
  kirim saat booking, baris Log Pengiriman muncul otomatis; tidak ada input
  rencana kedua kalinya.
- Sisi **aktual** di-derive dari Layer 2 (Log Produksi event "Material datang"
  untuk material, dan Mold Tracking status "Received" untuk mold).
- Ini menjaga dual-layer sekaligus single-source-of-truth planning: rencana
  hanya diisi sekali (saat Booking/Cetakan), aktual hanya diisi sekali (saat
  Log Produksi/Mold Tracking). Log Pengiriman murni tampilan pembanding +
  hitungan sistem, tidak menyimpan input barunya sendiri.
- Sistem menghitung selisih (on-time / terlambat berapa hari) dan status
  pengiriman (lihat enum bagian 6). Manager memakai ini untuk memantau apakah
  pasokan datang sesuai rencana.

**Packing & Shipment (belum di-scope):**
Field lama dari blueprint untuk status barang jadi (dikemas / dikirim ke
customer), bukan kirim mold. Belum dimasukkan ke Log produksi sampai diminta.
Kalau nanti ditambah, paling natural sebagai jenis event timeline.

## 6. Status enums (gunakan persis ini, jangan improvisasi nama status baru)

**Mold Tracking status** (urutan linear, sisi tracking fisik mold):
Planning, Ready Delivery, Delivery, Received, Waiting Production,
On Machine, Production, Repair, Send Back, Completed

**Progress molding** (status di Log Produksi, Layer 2):
Planning, Ongoing, Sudah diproduksi

**Machine status** (input Teknisi):
Running, Setup, Standby, Breakdown, Maintenance

**Downtime reason code** (dilampirkan Teknisi saat status non-produktif,
mengikuti kerangka six big losses OEE):
Breakdown, Setup & Adjustment, Minor Stop, Reduced Speed, Startup Reject,
Production Reject. Reason code ini memperkaya input Layer 1 yang sudah ada,
bukan form baru terpisah.

**Delivery status** (Log Pengiriman, dihitung dari rencana vs aktual):
Direncanakan, Dikirim, Tiba On-time, Tiba Terlambat, Belum Tiba (Overdue)

**Production Job status** (dashboard Sundaya):
On Schedule, Warning, Critical, Completed

**Rental status rules:**
- Warning jika sisa sewa kurang dari atau sama dengan 3 hari
- Critical jika sisa sewa kurang dari atau sama dengan 1 hari
- Overdue jika melewati End Date
- Penyewa bisa ajukan Extension Request

## 7. Functional modules (MVP scope)

Auth & Access (landing Penyewa + route internal staf, hierarki tenant),
Booking (tanpa pilih mesin di sisi Penyewa), Assign Mesin (Admin Sundaya),
Rental Management, Mold Tracking, Machine Monitoring (Layer 1, Teknisi),
Maintenance Management, Log Produksi (Layer 2), Log Pengiriman (Manager),
Dashboard Admin Sundaya, Console Teknisi Sundaya, Dashboard Penyewa,
Dashboard Manager, Notification, Report. Master Data (Customer/Perusahaan
Penyewa, Machine, Mold, Material, User) mendasari semua modul di atas.

**Future development (belum di-scope, jangan dibangun dulu kecuali diminta):**
QR Code Mold, Barcode Material, Mobile App, WhatsApp Notification, SAP
Business One Integration, IoT Machine Counter, Automatic Cycle Time, AI
Production Prediction, Predictive Maintenance, Smart Scheduling,
Packing/Shipment sebagai event log.

## 8. Data yang dihitung otomatis oleh sistem (jangan buat input manual untuk ini)

Availability, Performance, Quality, OEE, Utilization, MTBF (Mean Time Between
Failures), MTTR (Mean Time To Repair), Total Downtime, breakdown six big
losses, Production Progress, Achievement, Remaining Target, Material Used,
Reject Rate, ETA, Remaining Rental Time, Delivery Variance (selisih rencana vs
aktual kirim), On-time Delivery Rate.

Metrik pemantauan mesin baru (MTBF, MTTR, Total Downtime, six big losses)
dihitung dari event status mesin Layer 1 yang sudah diinput Teknisi. Jangan
tambahkan input manual untuk angka-angka ini; yang diinput manual hanyalah
event status mentah (status + waktu + reason code).

---

## 9. Instruksi untuk Claude saat membantu perubahan

Spec teknis (schema Prisma, enum, state machine mold, matriks RBAC, delta API)
ada di `docs/ssip-spec.md`. Kode dikembangkan dengan remodel in-place dari
codebase existing, bukan rewrite: pakai ulang infra auth, relasi parentId,
Machine, notifications, reports, dan komponen UI web.

- Saat diminta menambah field/form, cek dulu field itu masuk Layer 1 atau
  Layer 2 (bagian 2), dan role mana yang berwenang menginputnya (bagian 4).
- Saat menambah status baru, jangan buat istilah baru di luar enum bagian 6
  kecuali user eksplisit minta perluasan scope. Enum di schema Prisma dan
  packages/shared harus tetap konsisten.
- Kalau ragu apakah sebuah data dihitung sistem otomatis atau diinput manual,
  cek bagian 8 dulu.
- Transisi status (mold tracking, job lifecycle, machine status) hanya lewat
  service layer dengan validasi transisi yang sah, bukan query mentah.
- Admin Sundaya (approval/assign/rental/OEE) dan Teknisi Sundaya (input Layer 1
  real-time) adalah dua peran terpisah; jangan gabung kembali.
- Booking mesin, Cetakan, dan Log Pengiriman hanya milik Manager Penyewa;
  jangan pindah ke Admin Penyewa kecuali user eksplisit meminta.
- Log Pengiriman read-only, tanpa input manual. Rencana di-derive dari field
  "Rencana kirim mold ke Sundaya" + plan material di Booking/Cetakan. Aktual
  di-derive dari Log Produksi (Layer 2) dan Mold Tracking. Kalau data rencana
  kosong, arahkan user mengisi di Booking, bukan bikin input baru.
- Metrik pemantauan mesin (MTBF, MTTR, downtime, six big losses) adalah hasil
  hitung Layer 1, bukan input manual. Yang diinput hanya event status + reason
  code oleh Teknisi.
- Akses: landing publik hanya untuk Penyewa (register hanya Manager Penyewa).
  Staf Sundaya via route internal, tanpa self-register. Admin Penyewa child
  dari Manager Penyewa, dibuat oleh Manager, tidak bisa berdiri sendiri.
- Single-provider: penyedia hanya Sundaya. Jangan bangun abstraksi multi-penyedia.
- Packing/Shipment jangan ditambahkan kecuali user eksplisit meminta.
- Label UI berbahasa Indonesia; nama status/enum pakai istilah bagian 6 apa
  adanya. Dokumentasi berbahasa Indonesia dan tidak memakai tanda em dash.
