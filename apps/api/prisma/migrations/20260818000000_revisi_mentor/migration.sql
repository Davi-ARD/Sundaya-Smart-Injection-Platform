-- Revisi mentor: garansi per tanggal, material sebagai pilihan tetap,
-- status cetakan mulai kosong, dan siklus cetakan tanpa langkah kirim balik.

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('PP', 'PE', 'PS', 'ABS', 'PVC', 'PC', 'POM', 'PA', 'PET', 'SAN');

-- Garansi cukup rentang tanggal; durasi bulan tidak dipakai lagi.
ALTER TABLE "Machine" DROP COLUMN "warrantyDurationMonths";

-- Nama material jadi pilihan tetap. Nilai teks lama tidak dapat dipetakan
-- otomatis, jadi dikosongkan lalu diisi ulang lewat form.
ALTER TABLE "Mold" DROP COLUMN "planMaterialUtama";
ALTER TABLE "Mold" ADD COLUMN "planMaterialUtama" "MaterialType";
ALTER TABLE "LogPengiriman" DROP COLUMN "materialName";
ALTER TABLE "LogPengiriman" ADD COLUMN "materialName" "MaterialType";
ALTER TABLE "LogPenerimaan" DROP COLUMN "materialName";
ALTER TABLE "LogPenerimaan" ADD COLUMN "materialName" "MaterialType";

-- Cetakan baru belum punya status; PLANNING baru disetel saat booking disetujui.
ALTER TABLE "Mold" ALTER COLUMN "trackingStatus" DROP DEFAULT;
ALTER TABLE "Mold" ALTER COLUMN "trackingStatus" DROP NOT NULL;

-- Siklus cetakan berakhir langsung di COMPLETED, tanpa SEND_BACK.
UPDATE "Mold" SET "trackingStatus" = 'COMPLETED' WHERE "trackingStatus" = 'SEND_BACK';
UPDATE "MoldTrackingEvent" SET "status" = 'COMPLETED' WHERE "status" = 'SEND_BACK';

BEGIN;
CREATE TYPE "MoldTrackingStatus_new" AS ENUM ('PLANNING', 'DELIVERY', 'RECEIVED', 'PRODUCTION', 'COMPLETED');
ALTER TABLE "Mold" ALTER COLUMN "trackingStatus" TYPE "MoldTrackingStatus_new" USING ("trackingStatus"::text::"MoldTrackingStatus_new");
ALTER TABLE "MoldTrackingEvent" ALTER COLUMN "status" TYPE "MoldTrackingStatus_new" USING ("status"::text::"MoldTrackingStatus_new");
ALTER TYPE "MoldTrackingStatus" RENAME TO "MoldTrackingStatus_old";
ALTER TYPE "MoldTrackingStatus_new" RENAME TO "MoldTrackingStatus";
DROP TYPE "MoldTrackingStatus_old";
COMMIT;
