// Seed database SSIP untuk development.
// Jalankan: pnpm --filter @mold-tracker/api seed
// Semua user seed berpassword "password123" (bcryptjs, dipakai ulang modul Auth).

import {
  PrismaClient,
  Role,
  MachineStatus,
  MachineOperationalStatus,
  WarrantyStatus,
  JobLifecycle,
  JobStatus,
  MoldTrackingStatus,
  ProgressMolding,
  LogProduksiEventType,
  DowntimeReason,
  MaintenanceType,
  MaintenanceStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Bersihkan urut child ke parent supaya seed bisa diulang.
  await prisma.maintenance.deleteMany();
  await prisma.operationalData.deleteMany();
  await prisma.logProduksi.deleteMany();
  await prisma.moldTrackingEvent.deleteMany();
  await prisma.rentalExtension.deleteMany();
  await prisma.job.deleteMany();
  await prisma.mold.deleteMany();
  await prisma.machine.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);

  // Staf Sundaya (single-provider). Akses via route internal.
  const superAdmin = await prisma.user.create({
    data: { nama: 'Super Admin', email: 'superadmin@sundaya.test', passwordHash, role: Role.SUPER_ADMIN },
  });
  const adminSundaya = await prisma.user.create({
    data: { nama: 'Admin Sundaya', email: 'admin@sundaya.test', passwordHash, role: Role.ADMIN_SUNDAYA },
  });
  const teknisi = await prisma.user.create({
    data: { nama: 'Teknisi Satu', email: 'teknisi@sundaya.test', passwordHash, role: Role.TEKNISI_SUNDAYA },
  });

  // Penyewa: Manager (tenant root) dan Admin Penyewa (child).
  const manager = await prisma.user.create({
    data: {
      nama: 'Manager Nusantara',
      email: 'manager@nusantara.test',
      passwordHash,
      role: Role.MANAGER_PENYEWA,
      companyName: 'PT Nusantara',
    },
  });
  const adminPenyewa = await prisma.user.create({
    data: {
      nama: 'Admin Nusantara',
      email: 'adminpenyewa@nusantara.test',
      passwordHash,
      role: Role.ADMIN_PENYEWA,
      parentId: manager.id,
    },
  });

  // Mesin milik Sundaya (owner = staf Sundaya, single-provider).
  const warrantyStart = new Date('2025-01-01');
  const warrantyDurationMonths = 24;
  const warrantyEnd = new Date(warrantyStart);
  warrantyEnd.setMonth(warrantyEnd.getMonth() + warrantyDurationMonths);
  const warrantyStatus = warrantyEnd > new Date() ? WarrantyStatus.AKTIF : WarrantyStatus.HABIS;

  const mesinAktif = await prisma.machine.create({
    data: {
      machineNumber: 'IM-03',
      spesifikasi: 'Injection molding 150 ton',
      tonaseTon: 150,
      standardRatio: 10,
      status: MachineStatus.AKTIF,
      operationalStatus: MachineOperationalStatus.RUNNING,
      ownerId: adminSundaya.id,
      warrantyStart,
      warrantyDurationMonths,
      warrantyEnd,
      warrantyStatus,
    },
  });
  await prisma.machine.create({
    data: {
      machineNumber: 'IM-02',
      spesifikasi: 'Injection molding 150 ton',
      tonaseTon: 150,
      standardRatio: 8,
      status: MachineStatus.TERSEDIA,
      operationalStatus: MachineOperationalStatus.STANDBY,
      ownerId: adminSundaya.id,
      warrantyStart,
      warrantyDurationMonths,
      warrantyEnd,
      warrantyStatus,
    },
  });

  // Cetakan milik Manager.
  const mold = await prisma.mold.create({
    data: {
      kodeMold: 'MD-112',
      namaProduk: 'Housing cover',
      cavity: 4,
      tonaseTon: 150,
      deskripsi: 'Mold 2-plate, runner cold',
      managerId: manager.id,
      trackingStatus: MoldTrackingStatus.ON_MACHINE,
      planMaterialUtama: 'ABS Resin ABS-750',
      estimasiKg: 1000,
      targetOutput: 10000,
    },
  });

  // Histori tracking mold (RECEIVED dipakai sebagai aktual-tiba di Log Pengiriman).
  for (const [status, at] of [
    [MoldTrackingStatus.RECEIVED, new Date('2026-07-18T10:15:00Z')],
    [MoldTrackingStatus.WAITING_PRODUCTION, new Date('2026-07-18T12:00:00Z')],
    [MoldTrackingStatus.ON_MACHINE, new Date('2026-07-19T08:00:00Z')],
  ] as const) {
    await prisma.moldTrackingEvent.create({
      data: { moldId: mold.id, status, at, byId: teknisi.id },
    });
  }

  // Job aktif (mesin sudah di-assign Admin Sundaya).
  const job = await prisma.job.create({
    data: {
      jobNumber: 'SSIP-0231',
      moldId: mold.id,
      managerId: manager.id,
      machineId: mesinAktif.id,
      assignedById: adminSundaya.id,
      lifecycle: JobLifecycle.AKTIF,
      jobStatus: JobStatus.ON_SCHEDULE,
      requestedDurationDays: 14,
      destinationLocation: 'Sundaya, Bandung',
      startDate: new Date('2026-07-18'),
      endDate: new Date('2026-08-01'),
      planMaterialUtama: 'ABS Resin ABS-750',
      estimasiMaterialKg: 1000,
      materialTambahan: 'Masterbatch hitam MB-01 200 kg',
      targetOutput: 10000,
      rencanaKirimMold: new Date('2026-07-18'),
      confirmedAt: new Date('2026-07-16'),
      shippedAt: new Date('2026-07-17'),
      receivedAt: new Date('2026-07-18'),
    },
  });

  // Log Produksi (Layer 2, diinput Admin Penyewa). Timeline event append-only.
  await prisma.logProduksi.create({
    data: {
      jobId: job.id,
      eventType: LogProduksiEventType.MATERIAL_DATANG,
      occurredAt: new Date('2026-07-20T09:30:00Z'),
      byId: adminPenyewa.id,
      materialName: 'ABS Resin ABS-750',
      jumlahKg: 500,
      noSuratJalan: 'SJ-8841',
    },
  });
  await prisma.logProduksi.create({
    data: {
      jobId: job.id,
      eventType: LogProduksiEventType.PRODUKSI_HARIAN,
      occurredAt: new Date('2026-07-19T16:00:00Z'),
      byId: adminPenyewa.id,
      goodProduct: 1150,
      rejectCount: 30,
      materialRemainingKg: 520,
      catatan: 'Material agak lembab',
    },
  });
  await prisma.logProduksi.create({
    data: {
      jobId: job.id,
      eventType: LogProduksiEventType.PROGRESS_MOLDING,
      occurredAt: new Date('2026-07-19T08:00:00Z'),
      byId: adminPenyewa.id,
      progressMolding: ProgressMolding.ONGOING,
      keteranganProgress: 'Cavity 1-4 running, target hari ini 1.200 pcs',
    },
  });

  // Operational Data (Layer 1, diinput Teknisi). Sumber hitung OEE/MTBF/MTTR.
  await prisma.operationalData.create({
    data: {
      machineId: mesinAktif.id,
      status: MachineOperationalStatus.RUNNING,
      cycleTimeSec: 32,
      occurredAt: new Date('2026-07-19T08:00:00Z'),
      byId: teknisi.id,
    },
  });
  await prisma.operationalData.create({
    data: {
      machineId: mesinAktif.id,
      status: MachineOperationalStatus.BREAKDOWN,
      downtimeReason: DowntimeReason.BREAKDOWN,
      occurredAt: new Date('2026-07-19T14:00:00Z'),
      byId: teknisi.id,
      catatan: 'Heater band cavity 2 mati',
    },
  });

  await prisma.maintenance.create({
    data: {
      machineId: mesinAktif.id,
      type: MaintenanceType.CORRECTIVE,
      status: MaintenanceStatus.BERLANGSUNG,
      scheduledAt: new Date('2026-07-20'),
      notes: 'Ganti heater band cavity 2',
      byId: teknisi.id,
    },
  });

  console.log(
    `Seed selesai: 5 user (super/${superAdmin.email} dkk), 2 mesin, 1 mold, 1 job (${job.jobNumber}), 3 log produksi, 2 operational data, 1 maintenance.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
