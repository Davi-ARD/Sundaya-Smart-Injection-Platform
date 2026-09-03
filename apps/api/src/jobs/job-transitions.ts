import { $Enums, Prisma, PrismaClient } from '@prisma/client';
import { JobLifecycle, MachineStatus } from '@mold-tracker/shared';
import { machineWalk } from '../machines/machine-state';

// Dua perpindahan lifecycle job yang tidak ditekan tombol melainkan menyusul
// kenyataan fisik, sejajar dengan cara status cetakan bergerak:
//
//   DIKONFIRMASI -> AKTIF   produksi harian pertama dicatat (bukti job berjalan)
//   AKTIF        -> SELESAI masa sewa yang dibooking penyewa sudah habis
//
// Keduanya dipanggil dari dalam transaksi service pemicunya (Log Penerimaan dan
// Mold Tracking) supaya job, mesin, dan cetakan tidak pernah tercatat setengah
// jalan. Keduanya idempoten: lifecycle yang bukan prasyarat langsung diabaikan.
// Kedua sisi ini terdaftar di JOB_LIFECYCLE_FLOW (job-state.ts) dan diuji di sana.
//
// ponytail: fungsi lepas bertx, bukan service ber-DI. Pemanggilnya sudah punya
// transaksi sendiri, jadi menyuntikkan JobsService cuma menambah wiring modul.

const asLifecycle = (s: JobLifecycle) => s as unknown as $Enums.JobLifecycle;
const asMachineStatus = (s: MachineStatus) => s as unknown as $Enums.MachineStatus;

type Tx = Prisma.TransactionClient;

// Produksi harian pertama dicatat: itu bukti booking benar-benar berjalan, jadi
// lifecycle naik ke AKTIF dan seluruh mesin pinjamannya ikut AKTIF. Masa sewa
// tidak disentuh di sini: startDate dan endDate sudah ditetapkan dari jadwal yang
// diinput penyewa saat booking dibuat.
//
// Booking yang belum dikonfirmasi (mesin belum dipinjamkan) sengaja dibiarkan.
// Booking DIKONFIRMASI selalu punya minimal satu mesin: assign-lah yang menyetel
// status itu, dan mesin terakhir tidak bisa ditarik.
export async function activateJobOnProduksi(tx: Tx, jobId: string): Promise<void> {
  const job = await tx.job.findUnique({
    where: { id: jobId },
    select: {
      lifecycle: true,
      machines: { select: { id: true, status: true } },
    },
  });
  if (!job || job.lifecycle !== asLifecycle(JobLifecycle.DIKONFIRMASI)) return;

  // Tiap mesin divalidasi dari statusnya sendiri sebelum ada tulisan ke DB.
  const mesinBaru = job.machines.map((m) => ({
    id: m.id,
    status: asMachineStatus(machineWalk(m.status as unknown as MachineStatus, MachineStatus.AKTIF)),
  }));

  for (const m of mesinBaru) {
    await tx.machine.update({ where: { id: m.id }, data: { status: m.status } });
  }
  await tx.job.update({
    where: { id: jobId },
    data: { lifecycle: asLifecycle(JobLifecycle.AKTIF) },
  });
}

// Booking ditutup mengikuti MASA SEWA, bukan selesainya produksi. Selama sewa
// masih berjalan penyewa tetap memegang mesinnya: boleh mengirim cetakan baru,
// atau memakai lagi cetakan lama yang sudah Completed dengan menaikkan target
// output lalu mengirim material lagi. Begitu endDate lewat, booking ditutup dan
// mesin masuk PENGECEKAN lalu TERSEDIA untuk booking berikutnya.
//
// Cetakan yang masih ada di Sundaya tidak menahan penutupan: pengembaliannya
// dicatat terpisah lewat konfirmasi cetakan diterima oleh Manager.
//
// Idempoten dan aman dipanggil sesering apa pun: hanya menyentuh job AKTIF yang
// endDate-nya benar-benar sudah lewat.
export async function closeExpiredJobs(prisma: PrismaLike, now: Date = new Date()): Promise<number> {
  const kedaluwarsa = await prisma.job.findMany({
    where: { lifecycle: asLifecycle(JobLifecycle.AKTIF), endDate: { lt: now } },
    select: { id: true, machines: { select: { id: true, status: true } } },
  });

  for (const job of kedaluwarsa) {
    await prisma.$transaction((tx) => tutupBooking(tx, job.id, job.machines));
  }

  return kedaluwarsa.length;
}

// Menutup satu booking: mesinnya dikembalikan ke kolam Sundaya lalu lifecycle-nya
// jadi SELESAI. Dipakai bersama oleh penutupan otomatis saat masa sewa habis dan
// tombol "akhiri sewa" milik Manager, supaya kedua jalan itu tidak pernah berbeda
// perlakuan terhadap mesin.
export async function tutupBooking(
  tx: Tx,
  jobId: string,
  machines: { id: string; status: string }[],
): Promise<void> {
  // Status mesin divalidasi lewat machineWalk dulu supaya mesin yang sedang
  // maintenance tidak dipaksa balik ke TERSEDIA.
  for (const m of machines) {
    const status = machineWalk(
      m.status as unknown as MachineStatus,
      MachineStatus.PENGECEKAN,
      MachineStatus.TERSEDIA,
    );
    await tx.machine.update({ where: { id: m.id }, data: { status: asMachineStatus(status) } });
  }
  await tx.job.update({
    where: { id: jobId },
    data: { lifecycle: asLifecycle(JobLifecycle.SELESAI) },
  });
}

// Cukup bagian PrismaClient yang dipakai fungsi di atas, supaya PrismaService
// diterima apa adanya tanpa menyeret seluruh permukaan client.
type PrismaLike = Pick<PrismaClient, 'job' | '$transaction'>;
