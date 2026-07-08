// Seed database untuk development.
// Jalankan: pnpm --filter @mold-tracker/api seed
// Semua user seed berpassword "password123" (bcryptjs, dipakai ulang modul Auth).

import {
  PrismaClient,
  Role,
  MachineStatus,
  WarrantyStatus,
  RentalStatus,
  CauseCategory,
  ReviewStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Ambang efisiensi untuk flagging masalah mesin (persen). Sama dengan default backend.
const THRESHOLD = 85;

async function main() {
  // Bersihkan urut child ke parent supaya seed bisa diulang.
  await prisma.conditionCheck.deleteMany();
  await prisma.productionBatch.deleteMany();
  await prisma.rentalExtension.deleteMany();
  await prisma.rental.deleteMany();
  await prisma.machine.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.create({
    data: { nama: 'Admin', email: 'admin@mold.test', passwordHash, role: Role.ADMIN },
  });
  const penyedia = await prisma.user.create({
    data: { nama: 'Penyedia Satu', email: 'penyedia@mold.test', passwordHash, role: Role.PENYEDIA },
  });
  const penyewa = await prisma.user.create({
    data: { nama: 'Penyewa Satu', email: 'penyewa@mold.test', passwordHash, role: Role.PENYEWA },
  });
  const operator = await prisma.user.create({
    data: {
      nama: 'Operator Satu',
      email: 'operator@mold.test',
      passwordHash,
      role: Role.OPERATOR,
      parentId: penyewa.id,
    },
  });

  const warrantyStart = new Date('2025-01-01');
  const warrantyDurationMonths = 24;
  const warrantyEnd = new Date(warrantyStart);
  warrantyEnd.setMonth(warrantyEnd.getMonth() + warrantyDurationMonths);
  const warrantyStatus = warrantyEnd > new Date() ? WarrantyStatus.AKTIF : WarrantyStatus.HABIS;

  const mesinAktif = await prisma.machine.create({
    data: {
      machineNumber: 'M-001',
      spesifikasi: 'Mesin molding 150 ton',
      standardRatio: 10,
      status: MachineStatus.AKTIF,
      ownerId: penyedia.id,
      warrantyStart,
      warrantyDurationMonths,
      warrantyEnd,
      warrantyStatus,
    },
  });

  await prisma.machine.create({
    data: {
      machineNumber: 'M-002',
      spesifikasi: 'Mesin molding 100 ton',
      standardRatio: 8,
      status: MachineStatus.TERSEDIA,
      ownerId: penyedia.id,
      warrantyStart,
      warrantyDurationMonths,
      warrantyEnd,
      warrantyStatus,
    },
  });

  const rental = await prisma.rental.create({
    data: {
      machineId: mesinAktif.id,
      penyewaId: penyewa.id,
      penyediaId: penyedia.id,
      status: RentalStatus.AKTIF,
      requestedDurationDays: 30,
      destinationLocation: 'Pabrik Penyewa, Bekasi',
      startDate: new Date('2026-06-01'),
      endDate: new Date('2026-07-01'),
      confirmedAt: new Date('2026-05-30'),
      shippedAt: new Date('2026-05-31'),
      receivedAt: new Date('2026-06-01'),
    },
  });

  // Batch contoh: efisien, di bawah ambang karena mesin (di-flag), di bawah ambang karena operator.
  const batches = [
    { actualOutput: 950, rejectCount: 10, causeCategory: null as CauseCategory | null },
    { actualOutput: 700, rejectCount: 50, causeCategory: CauseCategory.KONDISI_MESIN },
    { actualOutput: 780, rejectCount: 30, causeCategory: CauseCategory.SETTING_OPERATOR },
  ];
  const materialInputKg = 100;

  for (const [i, b] of batches.entries()) {
    const targetOutput = materialInputKg * mesinAktif.standardRatio;
    const efficiency = (b.actualOutput / targetOutput) * 100;
    const flaggedMachineIssue =
      efficiency < THRESHOLD && b.causeCategory === CauseCategory.KONDISI_MESIN;
    await prisma.productionBatch.create({
      data: {
        rentalId: rental.id,
        machineId: mesinAktif.id,
        operatorId: operator.id,
        startAt: new Date(`2026-06-0${i + 2}T08:00:00Z`),
        endAt: new Date(`2026-06-0${i + 2}T16:00:00Z`),
        materialInputKg,
        targetOutput,
        actualOutput: b.actualOutput,
        rejectCount: b.rejectCount,
        causeCategory: b.causeCategory,
        efficiency,
        flaggedMachineIssue,
        reviewStatus: flaggedMachineIssue ? ReviewStatus.PENDING : ReviewStatus.APPROVED,
      },
    });
  }

  console.log(`Seed selesai: 4 user (${admin.email} dkk), 2 mesin, 1 rental aktif, ${batches.length} batch.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
