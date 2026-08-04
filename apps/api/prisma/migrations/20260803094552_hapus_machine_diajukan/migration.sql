-- DropForeignKey
ALTER TABLE "LogProduksi" DROP CONSTRAINT "LogProduksi_machineId_fkey";

-- AddForeignKey
ALTER TABLE "LogProduksi" ADD CONSTRAINT "LogProduksi_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
