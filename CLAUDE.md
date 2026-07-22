# Mold Tracker

Monorepo pnpm untuk SSIP (Sundaya Smart Injection Platform): sistem booking sewa dan monitoring produksi mesin injection molding, single-provider (Sundaya) dengan arsitektur dual-layer. Backend NestJS di apps/api, frontend Vite + React + Tailwind di apps/web, tipe dan DTO bersama di packages/shared. Konteks bisnis di PROJECT_CONTEXT.md, spec teknis di docs/ssip-spec.md, kontrak API di docs/api-contract.md. Domain sedang diremodel in-place dari model rental generik lama ke SSIP.

## Perintah

```bash
pnpm install                                 # install semua dependensi workspace
pnpm dev                                     # build shared lalu jalankan semua app paralel
pnpm --filter @mold-tracker/api dev          # dev API saja (port 3000, prefix /api)
pnpm --filter @mold-tracker/web dev          # dev web saja (port 5173)
pnpm --filter @mold-tracker/shared build     # build shared (wajib sebelum dev per app pertama kali)
docker compose up -d                         # nyalakan PostgreSQL 16 (db mold_tracker, user mold)
pnpm --filter @mold-tracker/api prisma:migrate   # prisma migrate dev
pnpm --filter @mold-tracker/api prisma:generate  # generate Prisma Client
pnpm --filter @mold-tracker/api seed         # seed database
pnpm lint                                    # lint semua package
pnpm test                                    # test semua package
```

## Catatan RTK

RTK aktif lewat hook. Untuk perintah dengan output besar (test, build, migrate, lint, git, docker) jalankan lewat Bash agar RTK memadatkan output. Untuk membaca file atau log besar, pakai perintah shell (cat, head, rg) atau rtk read/grep/find, bukan tool baca bawaan. Saat debug yang butuh output penuh, tambahkan --verbose.

## Catatan Ponytail

Ponytail full aktif tiap sesi. Solusi paling ringkas yang jalan, stdlib dan fitur native sebelum dependensi baru, tanpa abstraksi spekulatif. Jalankan /ponytail-review sebelum tiap PR. RBAC dan validasi tidak pernah disederhanakan.

## Struktur

```
apps/api          NestJS + Prisma (PostgreSQL)
apps/web          Vite + React + TypeScript + Tailwind CSS
packages/shared   Tipe, DTO, dan enum bersama (@mold-tracker/shared)
docs/             Dokumentasi, termasuk kontrak API
```

## Aturan tim

- Tipe request/response diambil dari packages/shared, tidak diduplikasi di api atau web.
- Satu domain bisnis sama dengan satu NestJS module (auth, users, machines, molds, jobs, log-produksi, operational, maintenance, reports, dan seterusnya).
- Transisi status (mold tracking, job lifecycle, machine status) hanya lewat service layer, tidak pernah langsung dari controller atau query mentah.
- RBAC lima role: SUPER_ADMIN, ADMIN_SUNDAYA, TEKNISI_SUNDAYA, MANAGER_PENYEWA, ADMIN_PENYEWA. Admin Penyewa adalah child dari Manager Penyewa. Semua endpoint diproteksi Guard kecuali yang ditandai publik di kontrak API.
- Dokumentasi berbahasa Indonesia dan tidak memakai tanda em dash.
- Jangan commit file .env. Gunakan .env.example sebagai templat.
