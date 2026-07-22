-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN_SUNDAYA', 'TEKNISI_SUNDAYA', 'MANAGER_PENYEWA', 'ADMIN_PENYEWA');

-- CreateEnum
CREATE TYPE "MachineStatus" AS ENUM ('TERSEDIA', 'DIAJUKAN', 'DIKONFIRMASI', 'DIKIRIM', 'AKTIF', 'SELESAI_SEWA', 'DIKEMBALIKAN', 'PENGECEKAN', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "MachineOperationalStatus" AS ENUM ('RUNNING', 'SETUP', 'STANDBY', 'BREAKDOWN', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "WarrantyStatus" AS ENUM ('AKTIF', 'HABIS');

-- CreateEnum
CREATE TYPE "JobLifecycle" AS ENUM ('DIAJUKAN', 'DITOLAK', 'DIKONFIRMASI', 'DIKIRIM', 'AKTIF', 'SELESAI_SEWA', 'DIKEMBALIKAN', 'SELESAI');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('ON_SCHEDULE', 'WARNING', 'CRITICAL', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ExtensionStatus" AS ENUM ('DIAJUKAN', 'DITERIMA', 'DITOLAK');

-- CreateEnum
CREATE TYPE "MoldTrackingStatus" AS ENUM ('PLANNING', 'READY_DELIVERY', 'DELIVERY', 'RECEIVED', 'WAITING_PRODUCTION', 'ON_MACHINE', 'PRODUCTION', 'REPAIR', 'SEND_BACK', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ProgressMolding" AS ENUM ('PLANNING', 'ONGOING', 'SUDAH_DIPRODUKSI');

-- CreateEnum
CREATE TYPE "LogProduksiEventType" AS ENUM ('MATERIAL_DATANG', 'PRODUKSI_HARIAN', 'PROGRESS_MOLDING');

-- CreateEnum
CREATE TYPE "DowntimeReason" AS ENUM ('BREAKDOWN', 'SETUP_ADJUSTMENT', 'MINOR_STOP', 'REDUCED_SPEED', 'STARTUP_REJECT', 'PRODUCTION_REJECT');

-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM ('PREVENTIVE', 'CORRECTIVE');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('TERJADWAL', 'BERLANGSUNG', 'SELESAI');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "parentId" TEXT,
    "companyName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL,
    "machineNumber" TEXT NOT NULL,
    "spesifikasi" TEXT NOT NULL,
    "tonaseTon" INTEGER NOT NULL,
    "standardRatio" DOUBLE PRECISION NOT NULL,
    "status" "MachineStatus" NOT NULL DEFAULT 'TERSEDIA',
    "operationalStatus" "MachineOperationalStatus" NOT NULL DEFAULT 'STANDBY',
    "ownerId" TEXT NOT NULL,
    "warrantyStart" TIMESTAMP(3) NOT NULL,
    "warrantyDurationMonths" INTEGER NOT NULL,
    "warrantyEnd" TIMESTAMP(3) NOT NULL,
    "warrantyStatus" "WarrantyStatus" NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mold" (
    "id" TEXT NOT NULL,
    "kodeMold" TEXT NOT NULL,
    "namaProduk" TEXT NOT NULL,
    "cavity" INTEGER NOT NULL,
    "tonaseTon" INTEGER NOT NULL,
    "deskripsi" TEXT,
    "managerId" TEXT NOT NULL,
    "trackingStatus" "MoldTrackingStatus" NOT NULL DEFAULT 'PLANNING',
    "planMaterialUtama" TEXT,
    "estimasiKg" DOUBLE PRECISION,
    "targetOutput" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoldTrackingEvent" (
    "id" TEXT NOT NULL,
    "moldId" TEXT NOT NULL,
    "status" "MoldTrackingStatus" NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "byId" TEXT NOT NULL,

    CONSTRAINT "MoldTrackingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "jobNumber" TEXT NOT NULL,
    "moldId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "machineId" TEXT,
    "assignedById" TEXT,
    "lifecycle" "JobLifecycle" NOT NULL DEFAULT 'DIAJUKAN',
    "jobStatus" "JobStatus" NOT NULL DEFAULT 'ON_SCHEDULE',
    "requestedDurationDays" INTEGER NOT NULL,
    "destinationLocation" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "planMaterialUtama" TEXT,
    "estimasiMaterialKg" DOUBLE PRECISION,
    "materialTambahan" TEXT,
    "targetOutput" DOUBLE PRECISION,
    "rencanaKirimMold" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalExtension" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "additionalDays" INTEGER NOT NULL,
    "status" "ExtensionStatus" NOT NULL DEFAULT 'DIAJUKAN',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "RentalExtension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogProduksi" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "eventType" "LogProduksiEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "byId" TEXT NOT NULL,
    "catatan" TEXT,
    "materialName" TEXT,
    "jumlahKg" DOUBLE PRECISION,
    "noSuratJalan" TEXT,
    "goodProduct" INTEGER,
    "rejectCount" INTEGER,
    "materialRemainingKg" DOUBLE PRECISION,
    "progressMolding" "ProgressMolding",
    "keteranganProgress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogProduksi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalData" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "status" "MachineOperationalStatus" NOT NULL,
    "downtimeReason" "DowntimeReason",
    "cycleTimeSec" DOUBLE PRECISION,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "byId" TEXT NOT NULL,
    "catatan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationalData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Maintenance" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "type" "MaintenanceType" NOT NULL,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'TERJADWAL',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "byId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "Machine_machineNumber_key" ON "Machine"("machineNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Mold_kodeMold_key" ON "Mold"("kodeMold");

-- CreateIndex
CREATE INDEX "MoldTrackingEvent_moldId_idx" ON "MoldTrackingEvent"("moldId");

-- CreateIndex
CREATE UNIQUE INDEX "Job_jobNumber_key" ON "Job"("jobNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Job_moldId_key" ON "Job"("moldId");

-- CreateIndex
CREATE INDEX "LogProduksi_jobId_occurredAt_idx" ON "LogProduksi"("jobId", "occurredAt");

-- CreateIndex
CREATE INDEX "OperationalData_machineId_occurredAt_idx" ON "OperationalData"("machineId", "occurredAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mold" ADD CONSTRAINT "Mold_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoldTrackingEvent" ADD CONSTRAINT "MoldTrackingEvent_moldId_fkey" FOREIGN KEY ("moldId") REFERENCES "Mold"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoldTrackingEvent" ADD CONSTRAINT "MoldTrackingEvent_byId_fkey" FOREIGN KEY ("byId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_moldId_fkey" FOREIGN KEY ("moldId") REFERENCES "Mold"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalExtension" ADD CONSTRAINT "RentalExtension_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogProduksi" ADD CONSTRAINT "LogProduksi_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LogProduksi" ADD CONSTRAINT "LogProduksi_byId_fkey" FOREIGN KEY ("byId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalData" ADD CONSTRAINT "OperationalData_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalData" ADD CONSTRAINT "OperationalData_byId_fkey" FOREIGN KEY ("byId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maintenance" ADD CONSTRAINT "Maintenance_byId_fkey" FOREIGN KEY ("byId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
