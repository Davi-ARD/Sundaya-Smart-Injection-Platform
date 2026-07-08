-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'PENYEDIA', 'PENYEWA', 'OPERATOR');

-- CreateEnum
CREATE TYPE "MachineStatus" AS ENUM ('TERSEDIA', 'DIAJUKAN', 'DIKONFIRMASI', 'DIKIRIM', 'AKTIF', 'SELESAI_SEWA', 'DIKEMBALIKAN', 'PENGECEKAN', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "WarrantyStatus" AS ENUM ('AKTIF', 'HABIS');

-- CreateEnum
CREATE TYPE "RentalStatus" AS ENUM ('DIAJUKAN', 'DITOLAK', 'DIKONFIRMASI', 'DIKIRIM', 'AKTIF', 'SELESAI_SEWA', 'DIKEMBALIKAN', 'SELESAI');

-- CreateEnum
CREATE TYPE "ExtensionStatus" AS ENUM ('DIAJUKAN', 'DITERIMA', 'DITOLAK');

-- CreateEnum
CREATE TYPE "CauseCategory" AS ENUM ('SETTING_OPERATOR', 'KUALITAS_MATERIAL', 'KONDISI_MESIN', 'LAIN');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ConditionResult" AS ENUM ('BAIK', 'BUTUH_MAINTENANCE', 'RUSAK');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "machineNumber" TEXT NOT NULL,
    "spesifikasi" TEXT NOT NULL,
    "standardRatio" DOUBLE PRECISION NOT NULL,
    "status" "MachineStatus" NOT NULL DEFAULT 'TERSEDIA',
    "ownerId" TEXT NOT NULL,
    "warrantyStart" TIMESTAMP(3) NOT NULL,
    "warrantyDurationMonths" INTEGER NOT NULL,
    "warrantyEnd" TIMESTAMP(3) NOT NULL,
    "warrantyStatus" "WarrantyStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rental" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "penyewaId" TEXT NOT NULL,
    "penyediaId" TEXT NOT NULL,
    "status" "RentalStatus" NOT NULL DEFAULT 'DIAJUKAN',
    "requestedDurationDays" INTEGER NOT NULL,
    "destinationLocation" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rental_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalExtension" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "additionalDays" INTEGER NOT NULL,
    "status" "ExtensionStatus" NOT NULL DEFAULT 'DIAJUKAN',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "RentalExtension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionBatch" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "materialInputKg" DOUBLE PRECISION NOT NULL,
    "targetOutput" DOUBLE PRECISION NOT NULL,
    "actualOutput" DOUBLE PRECISION NOT NULL,
    "rejectCount" INTEGER NOT NULL,
    "causeCategory" "CauseCategory",
    "efficiency" DOUBLE PRECISION NOT NULL,
    "flaggedMachineIssue" BOOLEAN NOT NULL DEFAULT false,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConditionCheck" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "checkedById" TEXT NOT NULL,
    "result" "ConditionResult" NOT NULL,
    "notes" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConditionCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Machine_machineNumber_key" ON "Machine"("machineNumber");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_penyewaId_fkey" FOREIGN KEY ("penyewaId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rental" ADD CONSTRAINT "Rental_penyediaId_fkey" FOREIGN KEY ("penyediaId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalExtension" ADD CONSTRAINT "RentalExtension_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionBatch" ADD CONSTRAINT "ProductionBatch_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConditionCheck" ADD CONSTRAINT "ConditionCheck_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConditionCheck" ADD CONSTRAINT "ConditionCheck_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "Rental"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConditionCheck" ADD CONSTRAINT "ConditionCheck_checkedById_fkey" FOREIGN KEY ("checkedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
