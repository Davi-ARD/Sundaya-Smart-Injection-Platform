-- Riwayat pemakaian cetakan per booking. Mulai sekarang Mold.jobId hanya berisi
-- booking yang sedang berjalan dan dilepas saat booking tutup, supaya cetakan
-- bisa dibooking lagi. Tabel ini menjaga pemakaian lamanya tetap terbaca.
CREATE TABLE "MoldJobUsage" (
    "id" TEXT NOT NULL,
    "moldId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoldJobUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MoldJobUsage_moldId_jobId_key" ON "MoldJobUsage"("moldId", "jobId");
CREATE INDEX "MoldJobUsage_moldId_at_idx" ON "MoldJobUsage"("moldId", "at");

ALTER TABLE "MoldJobUsage" ADD CONSTRAINT "MoldJobUsage_moldId_fkey"
    FOREIGN KEY ("moldId") REFERENCES "Mold"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MoldJobUsage" ADD CONSTRAINT "MoldJobUsage_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill dari keterikatan yang masih tercatat sekarang, supaya cetakan yang
-- sudah dipakai tidak kehilangan riwayatnya saat jobId-nya dilepas di bawah.
INSERT INTO "MoldJobUsage" ("id", "moldId", "jobId", "at")
SELECT md5(random()::text || m.id || m."jobId"), m.id, m."jobId", m."createdAt"
FROM "Mold" m
WHERE m."jobId" IS NOT NULL;

-- Cetakan yang masih menempel pada booking selesai dilepas sekarang juga:
-- sebelumnya cetakan itu terkunci permanen dan tidak bisa dibooking lagi.
UPDATE "Mold" SET "jobId" = NULL, "trackingStatus" = NULL
WHERE "jobId" IN (SELECT id FROM "Job" WHERE lifecycle = 'SELESAI');
