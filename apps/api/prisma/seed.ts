// Seed database SSIP: akun per role saja.
// Jalankan: pnpm --filter @mold-tracker/api seed
// Semua user seed berpassword "password123" (bcryptjs, dipakai ulang modul Auth).
// Data operasional (mesin, cetakan, job, log) tidak di-seed: diisi lewat aplikasi
// supaya alur input dan transisi status ikut teruji seperti pemakaian sebenarnya.

import { PrismaClient, Role } from '@prisma/client';
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
  await prisma.user.create({
    data: { nama: 'Super Admin', email: 'superadmin@sundaya.test', passwordHash, role: Role.SUPER_ADMIN },
  });
  await prisma.user.create({
    data: { nama: 'Admin Sundaya', email: 'admin@sundaya.test', passwordHash, role: Role.ADMIN_SUNDAYA },
  });
  await prisma.user.create({
    data: { nama: 'Teknisi Satu', email: 'teknisi@sundaya.test', passwordHash, role: Role.TEKNISI_SUNDAYA },
  });

  // Penyewa: Manager (tenant root) dan Admin Penyewa (child lewat parentId).
  const manager = await prisma.user.create({
    data: {
      nama: 'Manager Nusantara',
      email: 'manager@nusantara.test',
      passwordHash,
      role: Role.MANAGER_PENYEWA,
      companyName: 'PT Nusantara',
    },
  });
  await prisma.user.create({
    data: {
      nama: 'Admin Nusantara',
      email: 'adminpenyewa@nusantara.test',
      passwordHash,
      role: Role.ADMIN_PENYEWA,
      parentId: manager.id,
    },
  });

  console.log('Seed selesai: 5 akun (satu per role), tanpa data operasional.');
  console.log('Password semua akun: password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
