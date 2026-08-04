-- Booking meminjamkan beberapa mesin, bukan satu. Job.machineId (satu mesin) diganti
-- relasi banyak-ke-banyak _JobToMachine, dan Log Produksi mulai menyebut mesin mana
-- yang menjalankan cetakan pada tiap event.
--
-- Urutan penting: tabel relasi dan kolom LogProduksi.machineId diisi dari
-- Job.machineId lebih dulu, kolom itu baru dibuang di akhir supaya data lama utuh.

-- CreateTable
CREATE TABLE "_JobToMachine" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_JobToMachine_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_JobToMachine_B_index" ON "_JobToMachine"("B");

-- AddForeignKey
ALTER TABLE "_JobToMachine" ADD CONSTRAINT "_JobToMachine_A_fkey" FOREIGN KEY ("A") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_JobToMachine" ADD CONSTRAINT "_JobToMachine_B_fkey" FOREIGN KEY ("B") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: satu mesin lama menjadi satu baris relasi.
INSERT INTO "_JobToMachine" ("A", "B")
SELECT "id", "machineId" FROM "Job" WHERE "machineId" IS NOT NULL;

-- AlterTable: kolom baru, lalu isi dari mesin job yang lama.
ALTER TABLE "LogProduksi" ADD COLUMN "machineId" TEXT;

UPDATE "LogProduksi" SET "machineId" = "Job"."machineId"
FROM "Job" WHERE "Job"."id" = "LogProduksi"."jobId" AND "Job"."machineId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "LogProduksi_machineId_idx" ON "LogProduksi"("machineId");

-- AddForeignKey
ALTER TABLE "LogProduksi" ADD CONSTRAINT "LogProduksi_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Jumlah mesin yang diminta; booking lama selalu satu mesin.
ALTER TABLE "Job" ADD COLUMN "requestedMachineCount" INTEGER NOT NULL DEFAULT 1;

-- DropForeignKey
ALTER TABLE "Job" DROP CONSTRAINT "Job_machineId_fkey";

-- AlterTable
ALTER TABLE "Job" DROP COLUMN "machineId";
