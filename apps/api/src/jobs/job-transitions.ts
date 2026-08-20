import { $Enums, Prisma } from '@prisma/client';
import { JobLifecycle, MachineStatus, MoldTrackingStatus } from '@mold-tracker/shared';
import { machineWalk } from '../machines/machine-state';

// Dua perpindahan lifecycle job yang tidak ditekan tombol melainkan menyusul
// kenyataan fisik, sejajar dengan cara status cetakan bergerak:
//
//   DIKONFIRMASI -> AKTIF   produksi harian pertama dicatat (bukti job berjalan)
//   AKTIF        -> SELESAI seluruh cetakan booking sudah selesai diproduksi
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

// Cetakan terakhir booking sudah selesai diproduksi: booking ditutup dan mesinnya
// masuk PENGECEKAN lalu TERSEDIA untuk booking berikutnya. Selama masih ada satu
// cetakan yang belum selesai, booking tetap AKTIF.
export async function completeJobIfAllMoldsReturned(tx: Tx, jobId: string): Promise<void> {
  const job = await tx.job.findUnique({
    where: { id: jobId },
    select: {
      lifecycle: true,
      molds: { select: { trackingStatus: true } },
      machines: { select: { id: true, status: true } },
    },
  });
  if (!job || job.lifecycle !== asLifecycle(JobLifecycle.AKTIF)) return;

  const semuaKembali = job.molds.every(
    (m) => m.trackingStatus === (MoldTrackingStatus.COMPLETED as unknown as $Enums.MoldTrackingStatus),
  );
  if (!job.molds.length || !semuaKembali) return;

  const mesinBaru = job.machines.map((m) => ({
    id: m.id,
    status: asMachineStatus(
      machineWalk(
        m.status as unknown as MachineStatus,
        MachineStatus.PENGECEKAN,
        MachineStatus.TERSEDIA,
      ),
    ),
  }));

  for (const m of mesinBaru) {
    await tx.machine.update({ where: { id: m.id }, data: { status: m.status } });
  }
  // Waktu penutupan sudah terekam sebagai MoldTrackingEvent COMPLETED cetakan
  // terakhir, jadi tidak disalin lagi ke kolom Job.
  await tx.job.update({
    where: { id: jobId },
    data: { lifecycle: asLifecycle(JobLifecycle.SELESAI) },
  });
}
