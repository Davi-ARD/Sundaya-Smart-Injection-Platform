-- Booking multi-mold: relasi Job->Mold dibalik dari satu-satu (Job.moldId unique)
-- menjadi satu-banyak (Mold.jobId). Kolom moldId ditambahkan ke tiga tabel log dan
-- di-backfill dari Job.moldId SEBELUM kolom itu dibuang, jadi data lama tetap utuh.

-- 1. Mold.jobId: cetakan menunjuk booking-nya.
ALTER TABLE "Mold" ADD COLUMN "jobId" TEXT;
UPDATE "Mold" SET "jobId" = "Job"."id" FROM "Job" WHERE "Job"."moldId" = "Mold"."id";

-- 2. LogProduksi.moldId: nullable dulu, backfill, baru dijadikan wajib.
ALTER TABLE "LogProduksi" ADD COLUMN "moldId" TEXT;
UPDATE "LogProduksi" SET "moldId" = "Job"."moldId" FROM "Job" WHERE "Job"."id" = "LogProduksi"."jobId";
-- Log tanpa job yang masih ada tidak mungkin lolos FK; hapus agar constraint bisa dipasang.
DELETE FROM "LogProduksi" WHERE "moldId" IS NULL;
ALTER TABLE "LogProduksi" ALTER COLUMN "moldId" SET NOT NULL;

-- 3. Sisa material diganti material terpakai: semantiknya berbeda, jadi kolom baru.
ALTER TABLE "LogProduksi" DROP COLUMN "materialRemainingKg";
ALTER TABLE "LogProduksi" ADD COLUMN "materialUsedKg" DOUBLE PRECISION;

-- 4. Log Pengiriman dan Penerimaan: moldId hanya relevan untuk item MOLD.
ALTER TABLE "LogPengiriman" ADD COLUMN "moldId" TEXT;
UPDATE "LogPengiriman" SET "moldId" = "Job"."moldId"
  FROM "Job" WHERE "Job"."id" = "LogPengiriman"."jobId" AND "LogPengiriman"."item" = 'MOLD';

ALTER TABLE "LogPenerimaan" ADD COLUMN "moldId" TEXT;
UPDATE "LogPenerimaan" SET "moldId" = "Job"."moldId"
  FROM "Job" WHERE "Job"."id" = "LogPenerimaan"."jobId" AND "LogPenerimaan"."item" = 'MOLD';

-- 5. Job dipangkas: moldId pindah ke Mold, plan dibaca dari Mold, lokasi tujuan
-- dibuang (single-provider), catatan booking ditambahkan.
ALTER TABLE "Job" DROP CONSTRAINT "Job_moldId_fkey";
DROP INDEX "Job_moldId_key";
ALTER TABLE "Job" DROP COLUMN "moldId",
  DROP COLUMN "destinationLocation",
  DROP COLUMN "planMaterialUtama",
  DROP COLUMN "estimasiMaterialKg",
  DROP COLUMN "materialTambahan",
  DROP COLUMN "targetOutput",
  ADD COLUMN "catatan" TEXT;

-- 6. standardRatio dibuang: tidak dipakai perhitungan apa pun.
ALTER TABLE "Machine" DROP COLUMN "standardRatio";

-- 7. Index dan foreign key.
CREATE INDEX "Mold_jobId_idx" ON "Mold"("jobId");
CREATE INDEX "LogProduksi_moldId_eventType_idx" ON "LogProduksi"("moldId", "eventType");

ALTER TABLE "Mold" ADD CONSTRAINT "Mold_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LogProduksi" ADD CONSTRAINT "LogProduksi_moldId_fkey" FOREIGN KEY ("moldId") REFERENCES "Mold"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LogPengiriman" ADD CONSTRAINT "LogPengiriman_moldId_fkey" FOREIGN KEY ("moldId") REFERENCES "Mold"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LogPenerimaan" ADD CONSTRAINT "LogPenerimaan_moldId_fkey" FOREIGN KEY ("moldId") REFERENCES "Mold"("id") ON DELETE SET NULL ON UPDATE CASCADE;
