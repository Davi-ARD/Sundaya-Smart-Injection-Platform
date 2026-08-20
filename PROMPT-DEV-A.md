# Prompt Claude Code - Dev A (sisi Sundaya)

> File sementara. Copy-paste isi blok di bawah sebagai pesan pertama ke Claude
> Code di dalam repo ini. Aman dihapus setelah dipakai (tidak di-commit).

---

Kamu membantu Dev A mengerjakan backend + web sisi Sundaya untuk proyek SSIP
(Sundaya Smart Injection Platform), monorepo pnpm (NestJS di apps/api, React di
apps/web, tipe bersama di packages/shared).

BACA DULU sebelum ngoding, berurutan:
1. CLAUDE.md (root) + apps/api/CLAUDE.md + apps/web/CLAUDE.md
2. PROJECT_CONTEXT.md (konteks bisnis + aturan domain)
3. docs/ssip-spec.md (schema, enum, state machine, RBAC, delta API)
4. docs/ssip-tasks.md (task breakdown) - fokus ke bagian "Dev A - sisi Sundaya"

SCOPE KAMU (detail + acceptance criteria ada di docs/ssip-tasks.md):
- A1 Machines (remodel dari apps/api/legacy/machines): dua sumbu status
  (status ketersediaan + operationalStatus realtime), tonaseTon, warranty reuse.
- A2 Jobs assign + lifecycle (Admin Sundaya): assign mesin, transisi lifecycle,
  hitung jobStatus. Koordinasi modul dengan Dev B.
- A3 Mold tracking transisi (endpoint di modul molds, koordinasi dengan Dev B).
- A4 Operational Data (Layer 1, Teknisi): append event + reason code.
- A5 Maintenance (Teknisi).
- A6 Dashboard Sundaya + metrik OEE/MTBF/MTTR (reuse legacy/production/efficiency.ts).
- Web sisi Sundaya menyusul setelah backend modul terkait (fase 6 di ssip-tasks.md).

ATURAN WAJIB (jangan dilanggar):
- Ponytail full aktif: solusi paling ringkas yang jalan, stdlib/native sebelum
  dependensi, tanpa abstraksi spekulatif. TAPI RBAC dan validasi tidak pernah
  disederhanakan. Jalankan /ponytail-review sebelum tiap PR.
- Tipe request/response dari packages/shared, jangan duplikasi. Kalau butuh DTO
  baru, tambah di shared dan jaga enum Prisma <-> shared tetap sinkron.
- Transisi status (mold tracking, job lifecycle, machine status) HANYA lewat
  service layer dengan peta transisi konstan, bukan query mentah dari controller.
- Semua endpoint di belakang JwtAuthGuard + RolesGuard, pakai @Roles. Role:
  SUPER_ADMIN, ADMIN_SUNDAYA, TEKNISI_SUNDAYA, MANAGER_PENYEWA, ADMIN_PENYEWA.
- Machine dua sumbu status terpisah. Layer 1 (OperationalData) append-only.
- Single-provider: penyedia selalu Sundaya, ditegakkan di service.

ALUR KERJA PER MODUL:
1. Pindahkan folder dari apps/api/legacy/<modul> ke apps/api/src/<modul>, lalu
   sesuaikan ke schema baru (lihat apps/api/legacy/README.md). Wire di
   apps/api/src/app.module.ts.
2. Branch dari main: git checkout -b feat/<modul>-ssip
3. TDD untuk logika non-trivial (state machine, RBAC, hitung metrik): tulis
   test dulu, lalu implementasi.
4. Update docs/api-contract.md sesuai endpoint baru.
5. Definition of Done: build + test + lint hijau, RBAC + validasi ada, kontrak
   API update, /ponytail-review beres. 1 PR per modul (base: main).

TITIK KOORDINASI dengan Dev B (hindari konflik):
- Modul jobs: Dev B bikin endpoint booking (Manager), kamu bikin assign +
  lifecycle (Admin Sundaya). Sepakati pemilik file service, split per endpoint.
- Modul molds: Dev B pemilik CRUD (Manager); kamu tambah endpoint transisi
  tracking. Sinkron dulu sebelum jalan.

PERINTAH VERIFIKASI (jalankan lewat Bash agar RTK memadatkan output):
- pnpm --filter @mold-tracker/shared build
- pnpm --filter @mold-tracker/api build
- pnpm --filter @mold-tracker/api test
- pnpm --filter @mold-tracker/api lint
- Prisma dipanggil via: pnpm --filter @mold-tracker/api exec prisma <cmd>
  (jangan panggil `prisma` langsung, tidak ada di PATH).

MULAI DARI: A1 Machines. Baca dulu semua dokumen di atas + kode di
apps/api/legacy/machines, buat rencana singkat (file yang disentuh, endpoint,
RBAC, test), tampilkan rencana itu dan MINTA KONFIRMASI sebelum menulis kode.
