-- Sesi produksi cetakan: cetakan yang sudah selesai boleh dipakai lagi selama masa
-- sewa berjalan dengan target output baru. Barisnya append-only sehingga sekaligus
-- menjadi riwayat target output cetakan.
CREATE TABLE "MoldProductionRun" (
    "id" TEXT NOT NULL,
    "moldId" TEXT NOT NULL,
    "jobId" TEXT,
    "targetOutput" DOUBLE PRECISION NOT NULL,
    "estimasiKg" DOUBLE PRECISION,
    "goodAwal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "materialAwal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "byId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoldProductionRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MoldProductionRun_moldId_at_idx" ON "MoldProductionRun"("moldId", "at");

ALTER TABLE "MoldProductionRun" ADD CONSTRAINT "MoldProductionRun_moldId_fkey"
    FOREIGN KEY ("moldId") REFERENCES "Mold"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: cetakan yang sudah punya target output dianggap sedang menjalani sesi
-- pertamanya, dimulai dari nol. Tanpa ini cetakan lama tidak punya sesi berjalan
-- dan validasi target output kehilangan acuan.
INSERT INTO "MoldProductionRun" ("id", "moldId", "jobId", "targetOutput", "estimasiKg", "goodAwal", "materialAwal", "byId", "at")
SELECT
    md5(random()::text || m.id),
    m.id,
    m."jobId",
    m."targetOutput",
    m."estimasiKg",
    0,
    0,
    m."managerId",
    m."createdAt"
FROM "Mold" m
WHERE m."targetOutput" IS NOT NULL;
