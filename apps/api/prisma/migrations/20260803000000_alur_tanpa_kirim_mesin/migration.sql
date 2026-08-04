-- Alur SSIP tanpa langkah "kirim mesin".
--
-- Mesin tidak pernah keluar dari Sundaya: penyewa yang mengirim cetakan ke sini.
-- Karena itu status pengiriman dan pengembalian mesin dibuang dari kedua sumbu
-- (JobLifecycle dan MachineStatus), dan lifecycle job menyusut jadi:
--   DIAJUKAN -> DIKONFIRMASI -> AKTIF -> SELESAI (plus DITOLAK)
-- AKTIF disetel otomatis saat cetakan pertama diterima Sundaya, SELESAI saat
-- seluruh cetakan booking sudah dikonfirmasi kembali ke penyewa.
--
-- Log Produksi kehilangan event MATERIAL_DATANG: kedatangan material sudah
-- tercatat di Log Pengiriman (Manager) dan Log Penerimaan (Admin Sundaya).

-- 1. Buang event material datang beserta kolom yang hanya dipakai event itu.
--    Baris ini juga satu-satunya yang boleh ber-machineId null, jadi dihapus
--    lebih dulu supaya kolomnya bisa dijadikan NOT NULL.
DELETE FROM "LogProduksi" WHERE "eventType" = 'MATERIAL_DATANG';

ALTER TABLE "LogProduksi" DROP COLUMN "materialName";
ALTER TABLE "LogProduksi" DROP COLUMN "jumlahKg";
ALTER TABLE "LogProduksi" DROP COLUMN "noSuratJalan";
ALTER TABLE "LogProduksi" ALTER COLUMN "machineId" SET NOT NULL;

CREATE TYPE "LogProduksiEventType_new" AS ENUM ('PRODUKSI_HARIAN', 'PROGRESS_MOLDING');
ALTER TABLE "LogProduksi"
  ALTER COLUMN "eventType" TYPE "LogProduksiEventType_new"
  USING ("eventType"::text::"LogProduksiEventType_new");
DROP TYPE "LogProduksiEventType";
ALTER TYPE "LogProduksiEventType_new" RENAME TO "LogProduksiEventType";

-- 2. Job: tanggal kirim dan tanggal kembali mesin tidak lagi ada. receivedAt
--    dipertahankan, artinya kini "cetakan pertama tiba dan sewa mulai berjalan".
--    Waktu booking ditutup tidak diberi kolom sendiri: sudah terekam sebagai
--    MoldTrackingEvent COMPLETED cetakan terakhir.
ALTER TABLE "Job" DROP COLUMN "shippedAt";
ALTER TABLE "Job" DROP COLUMN "returnedAt";

-- 3. JobLifecycle menyusut. Booking yang terlanjur di status lama dipetakan ke
--    padanan terdekat: sudah dikirim tapi belum jalan = DIKONFIRMASI, sudah
--    lewat masa sewa tapi belum ditutup = AKTIF.
UPDATE "Job" SET "lifecycle" = 'DIKONFIRMASI' WHERE "lifecycle" = 'DIKIRIM';
UPDATE "Job" SET "lifecycle" = 'AKTIF' WHERE "lifecycle" IN ('SELESAI_SEWA', 'DIKEMBALIKAN');

CREATE TYPE "JobLifecycle_new" AS ENUM ('DIAJUKAN', 'DITOLAK', 'DIKONFIRMASI', 'AKTIF', 'SELESAI');
ALTER TABLE "Job" ALTER COLUMN "lifecycle" DROP DEFAULT;
ALTER TABLE "Job"
  ALTER COLUMN "lifecycle" TYPE "JobLifecycle_new"
  USING ("lifecycle"::text::"JobLifecycle_new");
DROP TYPE "JobLifecycle";
ALTER TYPE "JobLifecycle_new" RENAME TO "JobLifecycle";
ALTER TABLE "Job" ALTER COLUMN "lifecycle" SET DEFAULT 'DIAJUKAN';

-- 4. MachineStatus menyusut mengikuti sumbu yang sama.
UPDATE "Machine" SET "status" = 'DIKONFIRMASI' WHERE "status" = 'DIKIRIM';
UPDATE "Machine" SET "status" = 'AKTIF' WHERE "status" IN ('SELESAI_SEWA', 'DIKEMBALIKAN');

CREATE TYPE "MachineStatus_new" AS ENUM ('TERSEDIA', 'DIAJUKAN', 'DIKONFIRMASI', 'AKTIF', 'PENGECEKAN', 'MAINTENANCE');
ALTER TABLE "Machine" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Machine"
  ALTER COLUMN "status" TYPE "MachineStatus_new"
  USING ("status"::text::"MachineStatus_new");
DROP TYPE "MachineStatus";
ALTER TYPE "MachineStatus_new" RENAME TO "MachineStatus";
ALTER TABLE "Machine" ALTER COLUMN "status" SET DEFAULT 'TERSEDIA';
