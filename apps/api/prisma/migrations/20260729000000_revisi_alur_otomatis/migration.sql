-- CreateEnum
CREATE TYPE "ItemPengiriman" AS ENUM ('MOLD', 'MATERIAL');

-- AlterEnum
BEGIN;
CREATE TYPE "MachineOperationalStatus_new" AS ENUM ('STANDBY', 'SETUP', 'RUNNING', 'MAINTENANCE');
ALTER TABLE "public"."Machine" ALTER COLUMN "operationalStatus" DROP DEFAULT;
ALTER TABLE "Machine" ALTER COLUMN "operationalStatus" TYPE "MachineOperationalStatus_new" USING ("operationalStatus"::text::"MachineOperationalStatus_new");
ALTER TABLE "OperationalData" ALTER COLUMN "status" TYPE "MachineOperationalStatus_new" USING ("status"::text::"MachineOperationalStatus_new");
ALTER TYPE "MachineOperationalStatus" RENAME TO "MachineOperationalStatus_old";
ALTER TYPE "MachineOperationalStatus_new" RENAME TO "MachineOperationalStatus";
DROP TYPE "public"."MachineOperationalStatus_old";
ALTER TABLE "Machine" ALTER COLUMN "operationalStatus" SET DEFAULT 'STANDBY';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "MoldTrackingStatus_new" AS ENUM ('PLANNING', 'DELIVERY', 'RECEIVED', 'PRODUCTION', 'SEND_BACK', 'COMPLETED');
ALTER TABLE "public"."Mold" ALTER COLUMN "trackingStatus" DROP DEFAULT;
ALTER TABLE "Mold" ALTER COLUMN "trackingStatus" TYPE "MoldTrackingStatus_new" USING ("trackingStatus"::text::"MoldTrackingStatus_new");
ALTER TABLE "MoldTrackingEvent" ALTER COLUMN "status" TYPE "MoldTrackingStatus_new" USING ("status"::text::"MoldTrackingStatus_new");
ALTER TYPE "MoldTrackingStatus" RENAME TO "MoldTrackingStatus_old";
ALTER TYPE "MoldTrackingStatus_new" RENAME TO "MoldTrackingStatus";
DROP TYPE "public"."MoldTrackingStatus_old";
ALTER TABLE "Mold" ALTER COLUMN "trackingStatus" SET DEFAULT 'PLANNING';
COMMIT;

-- AlterTable
ALTER TABLE "Job" DROP COLUMN "rencanaKirimMold";

-- AlterTable
ALTER TABLE "Machine" ADD COLUMN     "statusBeforeMaintenance" "MachineOperationalStatus";

-- AlterTable
ALTER TABLE "OperationalData" DROP COLUMN "downtimeReason";

-- DropEnum
DROP TYPE "DowntimeReason";

-- CreateTable
CREATE TABLE "LogPengiriman" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "item" "ItemPengiriman" NOT NULL,
    "rencanaKirim" TIMESTAMP(3) NOT NULL,
    "materialName" TEXT,
    "jumlahKg" DOUBLE PRECISION,
    "noSuratJalan" TEXT,
    "catatan" TEXT,
    "byId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogPengiriman_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogPenerimaan" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "item" "ItemPengiriman" NOT NULL,
    "diterimaAt" TIMESTAMP(3) NOT NULL,
    "materialName" TEXT,
    "jumlahKg" DOUBLE PRECISION,
    "noSuratJalan" TEXT,
    "kondisi" TEXT,
    "catatan" TEXT,
    "byId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogPenerimaan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LogPengiriman_jobId_rencanaKirim_idx" ON "LogPengiriman"("jobId", "rencanaKirim");

-- CreateIndex
CREATE INDEX "LogPenerimaan_jobId_diterimaAt_idx" ON "LogPenerimaan"("jobId", "diterimaAt");

-- AddForeignKey
ALTER TABLE "LogPengiriman" ADD CONSTRAINT "LogPengiriman_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogPengiriman" ADD CONSTRAINT "LogPengiriman_byId_fkey" FOREIGN KEY ("byId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogPenerimaan" ADD CONSTRAINT "LogPenerimaan_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogPenerimaan" ADD CONSTRAINT "LogPenerimaan_byId_fkey" FOREIGN KEY ("byId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

