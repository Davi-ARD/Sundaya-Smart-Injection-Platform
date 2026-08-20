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
Production Job yang bisa memuat **beberapa cetakan sekaligus**, dan menjadi pusat
seluruh transaksi: booking, mold tracking, operasional mesin, log produksi,
material, sampai laporan akhir.

## 2. Prinsip inti: Dual Layer Manufacturing Information System

Ini adalah konsep paling penting dan TIDAK BOLEH dilanggar saat membuat
fitur baru. Ada dua jenis data yang terpisah dan tidak boleh dicampur:

| | Layer 1 - Operational Data | Layer 2 - Log Produksi |
|---|---|---|
| Diinput oleh | Teknisi Sundaya | Admin Penyewa (berada di lokasi Sundaya) |
| Sifat data | Real time | Event log / timeline |
| Contoh field | Setup, Running, Cycle Time | Log produksi harian (Good/Reject/Material terpakai), Progress molding (Planning / Ongoing / Sudah diproduksi) |
| Aturan hapus | Tidak boleh dihapus, hanya dikoreksi via event baru | Append-only event; koreksi via event baru |
| Menghasilkan | Availability, Performance, Utilization, MTBF, MTTR | Quality, Production Report, Material Report, Customer Dashboard, Production Progress |

Kalau nanti diminta menambah field atau form baru, selalu tanya: field ini
masuk Layer 1 (operasional mesin, real-time, milik Teknisi Sundaya) atau
Layer 2 (log produksi, milik Admin Penyewa)? Jangan campur keduanya dalam
satu form/tabel.

**Metrik pemantauan mesin dihitung lintas layer.** OEE tidak lagi bergantung
pada satu daftar reason code yang diinput manual. Sumbernya dipisah menurut
pihak yang paling tahu:

- **Availability** dari Layer 1: durasi status Setup ditambah maintenance
  korektif (padanan breakdown).
- **Performance** dari Layer 1: cycle time aktual yang dilaporkan Teknisi
  dibanding cycle time ideal.
- **Quality** dari Layer 2: good product dibanding reject di Log Produksi.
- **MTBF dan MTTR** dari record Maintenance bertipe korektif.

Teknisi hanya menginput **Setup** dan **Running**. Status Maintenance disetel
otomatis oleh modul Maintenance, bukan diketik Teknisi. Jangan buat input manual
untuk angka yang bisa dihitung (lihat bagian 8).

**Cycle time** adalah durasi satu siklus molding penuh (tutup mold, injeksi,
pendinginan, sampai eject). Disimpan kanonik dalam detik, diinput dan
ditampilkan sebagai jam + menit + detik.

## 3. Pembagian tanggung jawab

**Sundaya bertanggung jawab atas:** Mesin, Teknisi, Jadwal Mesin,
**Assign mesin ke booking**, Maintenance, OEE, Machine Performance,
Rental Management. Tanggung jawab ini dipecah antara dua peran staf Sundaya:

- **Admin Sundaya (manajerial/administratif):** approval booking, assign
  mesin, jadwal mesin, rental management, monitoring OEE & dashboard, rencana
  maintenance, laporan. Tidak menginput status mesin real-time.
- **Teknisi Sundaya (operasional lapangan):** input Operational Data Layer 1
  (status mesin Setup/Running dan cycle time), eksekusi setup mold dan
  maintenance. Tidak mengelola booking/assign/rental.

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

1. Manager Penyewa daftarkan cetakan/mold beserta plan material & target.
   Mold otomatis berstatus **Planning**.
2. Manager Penyewa booking: memilih **satu atau beberapa cetakan** yang akan
   dikirim, **jumlah mesin yang ingin dipinjam**, plus waktu sewa dan catatan.
   **Tidak memilih mesin mana** saat booking, dan tidak mengisi plan material atau
   target output lagi (sudah ada di cetakan).
3. Admin Sundaya approval **dan meminjamkan mesin ke booking itu; beberapa mesin
   boleh dipilih sekaligus dalam satu aksi** sampai jumlah permintaan terpenuhi.
   Mesin tidak dipasangkan ke cetakan tertentu. Booking yang disetujui inilah yang
   menempatkan cetakan-cetakannya ke **Planning**: sebelum disetujui, cetakan yang
   didaftarkan Manager belum punya status sama sekali.
4. Manager Penyewa mencatat **Log Pengiriman**: kapan mold akan dikirim ke Sundaya,
   dan materialnya dicatat di log yang sama. Mold otomatis menjadi **Delivery**,
   Admin Sundaya dapat notifikasi.
5. Admin Sundaya mencatat **Log Aktivitas** saat barang tiba (mold ataupun
   material). Mold otomatis menjadi **Received**, Manager dapat notifikasi.
   Pencatatan ini **tidak memvalidasi status** dan tidak menjalankan booking:
   masa sewa mengikuti jadwal yang diinput penyewa saat booking dibuat.
6. **Teknisi Sundaya memasang cetakan ke mesin lalu menjalankannya, dan mencatat
   tiap perubahan kondisi mesin itu di tab Mesin lewat tombol "Input status".**
   Ini satu langkah, bukan dua: aksi fisik dan pencatatannya dilakukan orang yang
   sama di tempat yang sama. Yang dicatat adalah **Operational Data (Layer 1)**:
   status mesin plus cycle time.
   - Teknisi hanya boleh memilih **Setup** (sedang memasang dan menyetel cetakan)
     atau **Running** (mesin sudah berproduksi). Standby cuma status awal mesin
     baru, dan Maintenance disetel modul Maintenance, bukan diketik Teknisi.
   - Append-only: koreksi dilakukan dengan mencatat status baru, bukan mengedit
     catatan lama.
   - Urutannya menyusul kedatangan cetakan (langkah 5) secara praktik, tapi
     **tidak dikunci sistem**: tab Mesin tidak memeriksa status mold, karena Layer 1
     adalah sumbu mesin dan tidak boleh bergantung pada sumbu cetakan.
7. Admin Penyewa (datang ke Sundaya) input **Log Produksi** (timeline): produksi
   harian dan progress molding. Tiap event wajib menyebut **cetakan mana di mesin
   mana**, karena mesin dipinjamkan tanpa dipasangkan. Produksi harian pertama
   otomatis memindahkan mold ke **Production** sekaligus **menjalankan booking-nya**
   (job menjadi **Aktif**, mesin pinjamannya ikut aktif): mengisi produksi harian
   itulah bukti job sudah on-going.
8. Progress molding **Sudah diproduksi** menutup siklus cetakan langsung ke
   **Completed**. Tidak ada langkah kirim balik terpisah. Cetakan terakhir yang
   selesai menutup booking-nya sendiri (job **Selesai**, mesin kembali ke
   pengecekan lalu tersedia).

**Tidak ada langkah pengiriman mesin di alur ini.** Mesin tidak pernah keluar dari
Sundaya, penyewa yang mengirim cetakannya ke sini. Jangan menambahkan tombol atau
status yang mengasumsikan mesin dikirim atau dikembalikan.

## 5a. Status cetakan dan lifecycle booking otomatis (penting)

Status fisik mold **tidak pernah digeser manual**: seluruhnya menyusul event
domain. Tidak ada tab Mold Tracking dan tidak ada tombol transisi. Peta pemicunya:

| Status | Pemicu |
|---|---|
| (belum ada) | Manager Penyewa mendaftarkan cetakan; status masih kosong |
| Planning | Booking yang memuat cetakan itu disetujui Admin Sundaya |
| Delivery | Manager Penyewa membuat Log Pengiriman item Mold |
| Received | Admin Sundaya membuat Log Aktivitas item Mold |
| Production | Admin Penyewa mencatat produksi harian pertama di Log Produksi |
| Completed | Progress molding Sudah diproduksi di Log Produksi |

Lifecycle booking ikut aturan yang sama, cuma dua sisi yang berupa tombol:

| Transisi | Pemicu |
|---|---|
| Diajukan -> Dikonfirmasi | Admin Sundaya meminjamkan mesin pertama |
| Diajukan -> Ditolak | Tombol tolak Admin Sundaya |
| Dikonfirmasi -> Aktif | Produksi harian pertama di Log Produksi (otomatis) |
| Aktif -> Selesai | Cetakan terakhir booking mencapai Completed (otomatis) |

Transisi otomatis bersifat **idempoten dan hanya maju**: event domain yang
terulang tidak menulis event ganda dan tidak menurunkan status. Lompatan maju
diizinkan karena bisa terjadi secara fisik (Sundaya menerima mold tanpa Manager
mencatat pengiriman lebih dulu); status menyusul ke kenyataan.

Endpoint transisi manual menolak status yang seharusnya otomatis, dan menolak role
yang bukan pemilik tombol itu, supaya papan tracking tidak bisa dipalsukan.

**Catatan flow booking (penting):**
- Manager Penyewa punya master mold & mengajukan booking.
- Booking = pilih **satu atau beberapa cetakan** + **jumlah mesin** + **plan waktu**
  + **catatan**. Satu cetakan hanya boleh ikut satu booking; booking yang ditolak
  melepas cetakannya supaya bisa dibooking ulang.
- Plan material dan target output **tidak diisi di booking**: keduanya milik
  cetakan, diisi sekali saat Manager merancang cetakan.
- **Mesin dipinjamkan, bukan dipasangkan.** Sundaya memasukkan beberapa mesin ke satu
  booking; tidak ada aturan satu cetakan satu mesin. Penyewa yang minta 2 mesin untuk
  10 cetakan bebas menjalankan cetakan mana pun di antara kedua mesin itu, dan boleh
  bertukar kapan saja.
- Konsekuensinya, **Log Produksi wajib menyebut pasangannya**: cetakan mana berjalan di
  mesin mana pada event itu. Itulah satu-satunya catatan pasangan yang sebenarnya.
- **Tonase mesin adalah batas atas, bukan angka yang harus sama.** Mesin 150 ton
  sanggup menjalankan cetakan 100 ton, tapi tidak cetakan 200 ton. Saat meminjamkan,
  syaratnya cuma mesin itu sanggup **cetakan terkecil** di booking (kalau tidak, mesin
  itu tidak berguna di sana); kecocokan per pasangan ditegakkan saat Log Produksi
  dicatat, beserta nomor mesin yang ditolak.
- Susunan mesin masih bisa diubah selama booking belum berjalan (sebelum cetakan tiba):
  mesin bisa ditambah atau ditarik kembali ke Tersedia. Mesin terakhir tidak bisa
  ditarik (booking tanpa mesin sama dengan booking yang tidak disetujui, jalurnya
  reject).
- **Nomor job menyebut kode cetakannya**, mis. `JOB-MDA1-MDB2-001`, supaya penyewa tahu
  job itu tugas untuk cetakan mana. Tiga cetakan atau lebih diringkas jadi
  `JOB-MDA1-MDB2-DLL-003`; tiga digit terakhir sekuens penjaga keunikan.
- Admin Penyewa di Sundaya melihat mesin pinjaman lewat Log Produksi / dashboard job.

**Catatan pembagian tampilan (penting):**
- **Tampilan Admin Sundaya** = tab Booking (approval + peminjaman mesin + lifecycle),
  Log Penerimaan, mold tracking, mesin, rencana maintenance, dashboard OEE
  (baca saja).
- **Tampilan Teknisi Sundaya** = input status mesin real-time (Layer 1, hanya
  Setup dan Running), eksekusi setup & maintenance.
- **Tampilan Manager** = plan cetakan, booking mesin, Log Pengiriman, dashboard
  monitoring (baca saja).
- **Tampilan Admin Penyewa** = khusus orang yang datang ke Sundaya (dashboard
  job + Log produksi). Tidak ada menu Cetakan / Booking / Log Pengiriman.

**Catatan Log Produksi (penting):**
- Menggantikan konsep "Daily Production Audit".
- Event dicatat **per cetakan**, bukan per booking: satu booking bisa memuat
  beberapa cetakan dan batasnya ditetapkan per cetakan.
- Semua event dalam **satu timeline** per cetakan.
- Jenis event cuma dua: Log produksi harian | Progress molding (Planning / Ongoing /
  Sudah diproduksi). **Material datang tidak ada di sini**: kedatangan material sudah
  dicatat Manager di Log Pengiriman dan dikonfirmasi Admin Sundaya di Log Penerimaan,
  jadi satu kejadian fisik tidak diinput dua kali oleh dua pihak. Yang tersisa di
  Layer 2 adalah pemakaian materialnya per hari.
- **Plan cetakan adalah batas keras, bukan pembanding.** Akumulasi produk baik
  tidak boleh melewati target output cetakan, dan akumulasi material terpakai
  tidak boleh melewati plan material cetakan. Keduanya ditolak sistem beserta
  sisa kuotanya. Plan yang kosong berarti tidak dibatasi.
- Produksi harian mencatat **material terpakai hari itu**, bukan sisa material.
  Sisa dihitung sistem: plan minus akumulasi terpakai.

**Catatan Log Pengiriman (fitur Manager Penyewa):**
- Milik **Manager Penyewa**. Isinya murni **log informasi**: kapan mold dan
  material akan dikirim ke Sundaya. Bukan lagi pembanding rencana vs aktual.
- **Mold dan material dipisah** jadi dua daftar, tetap dalam satu tab. Baris
  material menyimpan nama material, jumlah kg, dan nomor surat jalan; baris mold
  tidak memakai field itu.
- Mencatat item **Mold** memindahkan tracking mold ke Delivery secara otomatis.
- Admin Sundaya menerima notifikasi tiap ada log pengiriman baru, dan boleh
  membacanya untuk mengantisipasi kedatangan.

**Catatan Log Penerimaan (fitur Admin Sundaya):**
- Milik **Admin Sundaya**. Konfirmasi bahwa mold atau material benar-benar tiba
  di lokasi Sundaya, dicatat manual.
- **Mold dan material dipisah** jadi dua daftar, tetap dalam satu tab.
- Mencatat item **Mold** memindahkan tracking mold ke Received secara otomatis,
  sekaligus menjalankan booking-nya (job Aktif, masa sewa mulai dihitung).
- Manager Penyewa pemilik job menerima notifikasi tiap ada penerimaan baru, dan
  boleh membaca log job miliknya.
- Ini **satu-satunya tempat kedatangan barang dicatat**. Log Produksi tidak lagi
  punya event material datang, jadi tidak ada dua pihak yang mencatat kejadian
  fisik yang sama.
- Tab ini membuka dengan kartu **"Rencana pengiriman dari Penyewa"**: salinan
  baca-saja Log Pengiriman milik Manager, **kolomnya harus sepadan dengan yang
  dilihat Manager** (cetakan/material, jumlah, nomor surat jalan, rencana kirim,
  catatan). Satu data yang sama tidak boleh tampil dengan bentuk berbeda di dua
  peran; Admin justru butuh catatan dan nomor surat jalan itu untuk mencocokkan
  barang saat tiba. Daftarnya sengaja digabung jadi satu tabel karena fungsinya
  sekali lihat, sedangkan Manager memisah cetakan dan material karena dia yang
  mengisinya per jenis.
- **Waktu diterima tidak boleh melewati waktu sekarang.** Log Penerimaan mencatat
  barang yang sudah tiba, bukan rencana kedatangan, jadi tanggal masa depan
  ditolak walaupun rencana kirim penyewa memang bertanggal depan. Rencana hidup di
  Log Pengiriman, realisasi hidup di sini. Aturan ini ditegakkan server
  (`assertNotFuture`) dan pemilih tanggal di form ikut dikunci.

**Catatan dashboard (penting, semua role):**
Dashboard tiap role hanya untuk **membaca informasi**, bukan menjalankan aksi
atau mengakses fitur. Tombol yang mengarahkan ke tab terkait tetap boleh. Aksi
approval booking, assign mesin, dan transisi lifecycle job milik tab Booking
Admin Sundaya, bukan dashboard.

**Packing & Shipment (belum di-scope):**
Field lama dari blueprint untuk status barang jadi (dikemas / dikirim ke
customer), bukan kirim mold. Belum dimasukkan ke Log produksi sampai diminta.
Kalau nanti ditambah, paling natural sebagai jenis event timeline.

## 6. Status enums (gunakan persis ini, jangan improvisasi nama status baru)

**Status cetakan** (urutan linear, sisi fisik mold; null sebelum booking disetujui):
Planning, Delivery, Received, Production, Completed

Seluruh status **tidak digeser manual**, melainkan otomatis dari event domain
(lihat bagian 5a). Cetakan yang booking-nya belum disetujui belum punya status.

**Job lifecycle** (status booking):
Diajukan, Ditolak, Dikonfirmasi, Aktif, Selesai

Tidak ada status pengiriman atau pengembalian mesin: mesin tidak pernah keluar
dari Sundaya. Hanya Dikonfirmasi dan Ditolak yang ditekan tombol Admin Sundaya;
Aktif dan Selesai otomatis (lihat bagian 5a).

**Status ketersediaan mesin**:
Tersedia, Dikonfirmasi, Aktif, Pengecekan, Maintenance

Tidak ada status "diajukan" terpisah untuk mesin. Berbeda dari booking (yang
memang berhenti di Diajukan sampai Admin memutuskan), keputusan Admin meminjamkan
mesin sekaligus mengunci mesin itu dalam satu aksi, jadi mesin langsung berpindah
Tersedia ke Dikonfirmasi tanpa jeda status.

**Progress molding** (status di Log Produksi, Layer 2):
Planning, Ongoing, Sudah diproduksi

**Nomor mesin** digenerate sistem berpola IM-001 berurutan, tidak diinput manual.

**Tonase mesin** adalah clamping force: batas atas cetakan yang bisa dijalankan.

**Machine status** (sumbu operasional realtime):
Standby, Setup, Running, Maintenance

Hanya **Setup** dan **Running** yang diinput Teknisi. **Standby** hanya status
awal saat mesin pertama didaftarkan Admin Sundaya. **Maintenance** disetel
otomatis saat maintenance berlangsung dan dipulihkan ke status sebelumnya saat
maintenance selesai. Tidak ada reason code yang diinput manual.

**Item pengiriman/penerimaan** (Log Pengiriman dan Log Penerimaan):
Mold, Material

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
Rental Management, Mold Tracking (otomatis), Machine Monitoring (Layer 1,
Teknisi), Maintenance Management, Log Produksi (Layer 2), Log Pengiriman
(Manager), Log Penerimaan (Admin Sundaya), Dashboard Admin Sundaya, Console
Teknisi Sundaya, Dashboard Penyewa, Dashboard Manager, Notification, Report.
Master Data (Customer/Perusahaan Penyewa, Machine, Mold, Material, User)
mendasari semua modul di atas.

**Future development (belum di-scope, jangan dibangun dulu kecuali diminta):**
QR Code Mold, Barcode Material, Mobile App, WhatsApp Notification, SAP
Business One Integration, IoT Machine Counter, Automatic Cycle Time, AI
Production Prediction, Predictive Maintenance, Smart Scheduling,
Packing/Shipment sebagai event log.

## 8. Data yang dihitung otomatis oleh sistem (jangan buat input manual untuk ini)

Availability, Performance, Quality, OEE, Utilization, MTBF (Mean Time Between
Failures), MTTR (Mean Time To Repair), Total Downtime, Production Progress,
Achievement, Remaining Target, Material Used, Reject Rate, ETA, Remaining
Rental Time, dan status tracking mold (lihat bagian 5a).

Yang diinput manual hanyalah event mentah: status mesin + waktu + cycle time
(Teknisi), event Log Produksi (Admin Penyewa), Log Pengiriman (Manager), Log
Penerimaan dan jadwal maintenance (Admin Sundaya). Sisanya turunan.

**Material diperlakukan sebagai kuota, bukan target.** Plan material cetakan
adalah batas maksimal pemakaian: sisa kuota, persentase pemakaian, dan penolakan
saat melewati batas semuanya dihitung sistem. Tidak ada lagi pembandingan rencana
kedatangan vs aktual.

Event yang mencatat kejadian nyata (status mesin, Log Produksi, Log Penerimaan)
**tidak boleh bertanggal masa depan**: durasi antar-event dihitung dari
timestamp-nya, jadi satu tanggal masa depan merusak seluruh hitungan OEE.
Rencana pengiriman justru memang bertanggal depan, jadi tidak dibatasi.

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
- **Status cetakan dan lifecycle booking otomatis (bagian 5a).** Jangan tambahkan
  tombol untuk status Planning, Delivery, Received, Production, Completed, job
  Aktif, atau job Selesai: semuanya digerakkan event domain. Kalau butuh status
  pindah, cari event pemicunya, bukan bikin endpoint baru. Yang manual hanya
  approve/reject booking dan penukaran mesin (keduanya Admin Sundaya).
- **Mesin tidak pernah keluar dari Sundaya.** Jangan menambahkan status, tombol,
  atau field yang mengasumsikan mesin dikirim ke penyewa atau dikembalikan; yang
  bergerak adalah cetakan milik penyewa.
- **Dashboard read-only (semua role).** Dashboard hanya membaca informasi.
  Tombol navigasi ke tab lain boleh; aksi yang mengubah data tidak, termasuk panel
  detail. Approval, assign mesin, dan lifecycle job ada di tab Booking Admin
  Sundaya; detail cetakan ada di tab Cetakan.
- **Satu booking bisa memuat beberapa cetakan** (relasi Mold.jobId). Jangan
  kembalikan asumsi satu job sama dengan satu cetakan. Plan material dan target
  output dibaca dari Mold, jangan diduplikasi ke Job.
- **Plan cetakan adalah batas keras di Log Produksi.** Kalau menambah field
  produksi, pikirkan dulu apakah ia perlu ikut dibatasi plan.
- `standardRatio` sudah dihapus dari mesin. Jangan dikembalikan tanpa pemakai
  perhitungan yang jelas.
- Admin Sundaya (approval/assign/rental/penerimaan/OEE) dan Teknisi Sundaya
  (input Layer 1 real-time) adalah dua peran terpisah; jangan gabung kembali.
- Booking mesin, Cetakan, dan Log Pengiriman hanya milik Manager Penyewa;
  jangan pindah ke Admin Penyewa kecuali user eksplisit meminta. Log Penerimaan
  milik Admin Sundaya.
- Log Pengiriman dan Log Penerimaan **memisahkan mold dan material** tapi tetap
  satu tab per fitur. Keduanya terhubung lewat notifikasi dua arah; jangan
  hapus notifikasi itu saat mengubah salah satu sisi.
- **Status mesin Teknisi hanya Setup dan Running.** Standby cuma status awal
  mesin baru; Maintenance disetel modul Maintenance dan dipulihkan ke status
  sebelumnya saat selesai. Jangan kembalikan Breakdown atau reason code manual.
- Metrik OEE dihitung lintas layer (bagian 2): Availability dan Performance dari
  Layer 1, Quality dari Layer 2, MTBF/MTTR dari maintenance korektif. Bukan input
  manual.
- Akses: landing publik hanya untuk Penyewa (register hanya Manager Penyewa).
  Staf Sundaya via route internal, tanpa self-register. Admin Penyewa child
  dari Manager Penyewa, dibuat oleh Manager, tidak bisa berdiri sendiri.
- Single-provider: penyedia hanya Sundaya. Jangan bangun abstraksi multi-penyedia.
- Packing/Shipment jangan ditambahkan kecuali user eksplisit meminta.
- Label UI berbahasa Indonesia; nama status/enum pakai istilah bagian 6 apa
  adanya. Dokumentasi berbahasa Indonesia dan tidak memakai tanda em dash.
