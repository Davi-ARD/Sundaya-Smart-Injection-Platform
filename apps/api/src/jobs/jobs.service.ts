import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { $Enums, Prisma, User as PrismaUser } from '@prisma/client';
import {
  ExtensionRequestRow,
  ExtensionStatus,
  Job,
  JobLifecycle,
  MachineStatus,
  MoldTrackingStatus,
  Role,
} from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import { machineWalk } from '../machines/machine-state';
import { nextJobLifecycle } from './job-state';
import { remainingDays } from './job-status';
import { buildJobNumber } from './job-number';
import { toJob, toRentalExtension } from './job.mapper';
import {
  AssignJobDto,
  CreateExtensionDto,
  CreateJobDto,
  DecideExtensionDto,
  RejectJobDto,
  ReplaceMachineDto,
} from './dto';

// ponytail: enum shared dan Prisma nominal berbeda, cast di batang DB saja.
const asLifecycle = (s: JobLifecycle) => s as unknown as $Enums.JobLifecycle;
const asMachineStatus = (s: MachineStatus) => s as unknown as $Enums.MachineStatus;
const asExtensionStatus = (s: ExtensionStatus) => s as unknown as $Enums.ExtensionStatus;
const asMoldTracking = (s: MoldTrackingStatus) => s as unknown as $Enums.MoldTrackingStatus;

const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (d: Date, days: number) => new Date(d.getTime() + days * DAY_MS);

const STAF_SUNDAYA: Role[] = [Role.SUPER_ADMIN, Role.ADMIN_SUNDAYA, Role.TEKNISI_SUNDAYA];

const machineSelect = {
  select: { id: true, machineNumber: true, tonaseTon: true, status: true },
  orderBy: { machineNumber: 'asc' as const },
} as const;

const withDetails = {
  include: {
    molds: { orderBy: { kodeMold: 'asc' as const } },
    machines: machineSelect,
    manager: { select: { companyName: true } },
    extensions: { orderBy: { requestedAt: 'desc' as const } },
  },
} as const;

type JobWithDetails = Prisma.JobGetPayload<typeof withDetails>;

// Lifecycle yang masih boleh menerima atau melepas mesin: selama booking belum
// berjalan. Begitu cetakan tiba dan job AKTIF, susunan mesinnya dianggap final.
const BOLEH_UBAH_MESIN: JobLifecycle[] = [JobLifecycle.DIAJUKAN, JobLifecycle.DIKONFIRMASI];

const detailJob = (j: JobWithDetails) => toJob(j, j.molds, j.machines, j.extensions);

@Injectable()
export class JobsService {
  constructor(private prisma: PrismaService) {}

  // Booking (MANAGER_PENYEWA): pilih satu atau lebih cetakan miliknya, jumlah mesin
  // yang ingin dipinjam, plus rencana waktu. Plan material dan target output tidak
  // diminta lagi: sudah tersimpan di masing-masing cetakan. Lifecycle mulai DIAJUKAN
  // (default schema); mesin dipinjamkan Admin Sundaya bertahap sesudahnya.
  //
  // Satu cetakan hanya boleh ikut satu booking: cetakan yang jobId-nya sudah terisi
  // ditolak 409. Job dan penautan cetakan ditulis dalam satu transaksi.
  async create(user: PrismaUser, dto: CreateJobDto): Promise<Job> {
    const molds = await this.prisma.mold.findMany({
      where: { id: { in: dto.moldIds }, managerId: user.id },
      select: { id: true, kodeMold: true, jobId: true },
    });
    // Cetakan tenant lain atau tidak ada sama-sama 404: jangan bocorkan keberadaannya.
    if (molds.length !== dto.moldIds.length) {
      throw new NotFoundException('Sebagian cetakan tidak ditemukan');
    }
    const sudahDibooking = molds.filter((m) => m.jobId !== null);
    if (sudahDibooking.length) {
      throw new ConflictException(
        `Cetakan sudah dibooking: ${sudahDibooking.map((m) => m.kodeMold).join(', ')}`,
      );
    }

    // Nomor job menyebut kode cetakannya supaya penyewa tahu job itu tugas untuk apa.
    // Sekuens diambil di dalam transaksi agar dua booking berbarengan tidak bernomor sama.
    const kodeMolds = molds.map((m) => m.kodeMold).sort();
    const job = await this.prisma.$transaction(async (tx) => {
      const created = await tx.job.create({
        data: {
          jobNumber: buildJobNumber(kodeMolds, (await tx.job.count()) + 1),
          managerId: user.id,
          requestedMachineCount: dto.requestedMachineCount,
          requestedDurationDays: dto.requestedDurationDays,
          // Masa sewa mengikuti jadwal yang diinput penyewa dan sudah pasti sejak
          // booking dibuat; kedatangan cetakan tidak lagi menggesernya.
          startDate: new Date(dto.startDate),
          endDate: addDays(new Date(dto.startDate), dto.requestedDurationDays),
          catatan: dto.catatan,
        },
      });
      await tx.mold.updateMany({
        where: { id: { in: dto.moldIds } },
        data: { jobId: created.id },
      });
      return tx.job.findUniqueOrThrow({ where: { id: created.id }, ...withDetails });
    });
    return detailJob(job);
  }

  // Scoping tenant di service: staf Sundaya lihat semua; Manager lihat miliknya;
  // Admin Penyewa lihat tenant induknya (lewat parentId). Single-provider.
  async findAll(user: PrismaUser, lifecycle?: JobLifecycle): Promise<Job[]> {
    const scope = this.tenantScope(user);
    const jobs = await this.prisma.job.findMany({
      where: { ...scope, lifecycle: lifecycle ? asLifecycle(lifecycle) : undefined },
      orderBy: { createdAt: 'desc' },
      ...withDetails,
    });
    return jobs.map(detailJob);
  }

  async findOne(user: PrismaUser, id: string): Promise<Job> {
    const j = await this.prisma.job.findUnique({ where: { id }, ...withDetails });
    if (!j) throw new NotFoundException('Job tidak ditemukan');
    this.assertParty(user, j);
    return detailJob(j);
  }

  // ADMIN_SUNDAYA meminjamkan satu mesin ke booking. Konsepnya meminjamkan, bukan
  // memasangkan: mesin masuk ke booking tanpa ditautkan ke cetakan tertentu, dan
  // penyewa bebas menjalankan cetakan mana pun di mesin mana pun. Pasangan yang
  // benar-benar dipakai baru tercatat di Log Produksi.
  //
  // Mesin pertama sekaligus menyetujui booking (DIAJUKAN -> DIKONFIRMASI); mesin
  // berikutnya ditambahkan lewat endpoint yang sama sampai jumlah permintaan terpenuhi.
  // Mesin ikut berjalan TERSEDIA -> DIKONFIRMASI.
  async assign(user: PrismaUser, id: string, dto: AssignJobDto): Promise<Job> {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        molds: { select: { id: true, kodeMold: true, tonaseTon: true } },
        machines: { select: { id: true } },
      },
    });
    if (!job) throw new NotFoundException('Job tidak ditemukan');
    if (!BOLEH_UBAH_MESIN.includes(job.lifecycle as unknown as JobLifecycle)) {
      throw new ConflictException(
        `Mesin hanya bisa ditambah selama booking belum berjalan (status sekarang ${job.lifecycle})`,
      );
    }
    if (!job.molds.length) throw new ConflictException('Booking belum memuat cetakan');

    // Admin Sundaya boleh memilih beberapa mesin sekaligus. Duplikat dalam satu
    // permintaan dirapikan dulu supaya pesan galat tidak membingungkan.
    const diminta = [...new Set(dto.machineIds)];
    if (!diminta.length) throw new BadRequestException('Pilih minimal satu mesin');
    const sudahAda = diminta.filter((mid) => job.machines.some((m) => m.id === mid));
    if (sudahAda.length) {
      throw new ConflictException('Sebagian mesin sudah dipinjamkan ke booking ini');
    }

    const machines = await this.prisma.machine.findMany({ where: { id: { in: diminta } } });
    if (machines.length !== diminta.length) throw new NotFoundException('Mesin tidak ditemukan');
    const terpakai = machines.filter((m) => m.status !== asMachineStatus(MachineStatus.TERSEDIA));
    if (terpakai.length) {
      throw new ConflictException(
        `Mesin ${terpakai.map((m) => m.machineNumber).join(', ')} sedang tidak tersedia`,
      );
    }
    // Tonase mesin adalah batas atas. Karena cetakan tidak dipasangkan ke mesin, syarat
    // di sini hanya tiap mesin sanggup menjalankan setidaknya satu cetakan booking;
    // kecocokan per pasangan ditegakkan saat Log Produksi dicatat.
    const terkecil = job.molds.reduce((a, b) => (b.tonaseTon < a.tonaseTon ? b : a));
    const kurang = machines.find((m) => m.tonaseTon < terkecil.tonaseTon);
    if (kurang) {
      throw new BadRequestException(
        `Mesin ${kurang.machineNumber} (${kurang.tonaseTon} ton) tidak sanggup menjalankan cetakan mana pun di booking ini; yang terkecil ${terkecil.kodeMold} butuh ${terkecil.tonaseTon} ton`,
      );
    }

    const konfirmasiPertama = job.lifecycle === asLifecycle(JobLifecycle.DIAJUKAN);
    if (konfirmasiPertama) nextJobLifecycle(JobLifecycle.DIAJUKAN, JobLifecycle.DIKONFIRMASI);
    const nextMachine = machineWalk(MachineStatus.TERSEDIA, MachineStatus.DIKONFIRMASI);

    // Status mesin disetel lebih dulu supaya job.update yang memuat relasi mesin
    // membaca status yang sudah baru (operasi array $transaction berjalan berurutan).
    // Booking yang baru disetujui menempatkan seluruh cetakannya ke PLANNING:
    // sebelum disetujui cetakan sengaja belum punya status sama sekali.
    const [, updated] = await this.prisma.$transaction([
      this.prisma.machine.updateMany({
        where: { id: { in: diminta } },
        data: { status: asMachineStatus(nextMachine) },
      }),
      this.prisma.job.update({
        where: { id: job.id },
        data: {
          machines: { connect: diminta.map((mid) => ({ id: mid })) },
          ...(konfirmasiPertama
            ? {
                assignedById: user.id,
                confirmedAt: new Date(),
                lifecycle: asLifecycle(JobLifecycle.DIKONFIRMASI),
                molds: {
                  updateMany: {
                    where: {},
                    data: { trackingStatus: asMoldTracking(MoldTrackingStatus.PLANNING) },
                  },
                },
              }
            : {}),
        },
        ...withDetails,
      }),
    ]);
    return detailJob(updated as JobWithDetails);
  }

  // ADMIN_SUNDAYA menarik satu mesin dari booking yang belum berjalan, mis. salah pilih
  // atau menukar dengan mesin lain. Mesin kembali TERSEDIA. Mesin terakhir tidak boleh
  // dilepas: booking tanpa mesin sama dengan booking yang tidak disetujui, dan jalur
  // untuk itu adalah reject. Menukar mesin tunggal dilakukan dengan menambah dulu, baru
  // melepas yang lama.
  async releaseMachine(id: string, machineId: string): Promise<Job> {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: { machines: { select: { id: true, status: true } } },
    });
    if (!job) throw new NotFoundException('Job tidak ditemukan');
    if (!BOLEH_UBAH_MESIN.includes(job.lifecycle as unknown as JobLifecycle)) {
      throw new ConflictException(
        `Mesin hanya bisa dilepas selama booking belum berjalan (status sekarang ${job.lifecycle})`,
      );
    }
    const machine = job.machines.find((m) => m.id === machineId);
    if (!machine) throw new NotFoundException('Mesin tidak ada di booking ini');
    if (job.machines.length === 1) {
      throw new ConflictException(
        'Mesin terakhir tidak bisa dilepas; tambahkan mesin pengganti dulu atau tolak booking',
      );
    }

    const [, updated] = await this.prisma.$transaction([
      this.prisma.machine.update({
        where: { id: machineId },
        data: {
          status: asMachineStatus(
            machineWalk(machine.status as unknown as MachineStatus, MachineStatus.TERSEDIA),
          ),
        },
      }),
      this.prisma.job.update({
        where: { id: job.id },
        data: { machines: { disconnect: { id: machineId } } },
        ...withDetails,
      }),
    ]);
    return detailJob(updated as JobWithDetails);
  }

  // ADMIN_SUNDAYA menukar satu mesin booking dengan mesin lain. Berbeda dari
  // releaseMachine, ini boleh dilakukan saat booking sudah berjalan: mesin yang
  // masuk maintenance ditarik dan digantikan supaya produksi tidak berhenti.
  // Kontrak sewa dihitung per hari dan tidak diperpanjang karena pergantian ini,
  // jadi tidak ada kolom tanggal yang disentuh di sini.
  async replaceMachine(id: string, machineId: string, dto: ReplaceMachineDto): Promise<Job> {
    if (machineId === dto.replacementId) {
      throw new BadRequestException('Mesin pengganti harus berbeda dari mesin yang ditukar');
    }
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        molds: { select: { kodeMold: true, tonaseTon: true } },
        machines: { select: { id: true, status: true } },
      },
    });
    if (!job) throw new NotFoundException('Job tidak ditemukan');
    const berjalan = [JobLifecycle.DIKONFIRMASI, JobLifecycle.AKTIF];
    if (!berjalan.includes(job.lifecycle as unknown as JobLifecycle)) {
      throw new ConflictException(
        `Mesin hanya bisa ditukar pada booking yang sudah disetujui (status sekarang ${job.lifecycle})`,
      );
    }
    const lama = job.machines.find((m) => m.id === machineId);
    if (!lama) throw new NotFoundException('Mesin tidak ada di booking ini');
    if (job.machines.some((m) => m.id === dto.replacementId)) {
      throw new ConflictException('Mesin pengganti sudah dipinjamkan ke booking ini');
    }

    const pengganti = await this.prisma.machine.findUnique({ where: { id: dto.replacementId } });
    if (!pengganti) throw new NotFoundException('Mesin pengganti tidak ditemukan');
    if (pengganti.status !== asMachineStatus(MachineStatus.TERSEDIA)) {
      throw new ConflictException('Mesin pengganti sedang tidak tersedia');
    }
    const terkecil = job.molds.reduce((a, b) => (b.tonaseTon < a.tonaseTon ? b : a));
    if (pengganti.tonaseTon < terkecil.tonaseTon) {
      throw new BadRequestException(
        `Mesin ${pengganti.machineNumber} (${pengganti.tonaseTon} ton) tidak sanggup menjalankan cetakan mana pun di booking ini; yang terkecil ${terkecil.kodeMold} butuh ${terkecil.tonaseTon} ton`,
      );
    }

    // Mesin lama dibebaskan lewat jalur sah sumbu ketersediaan: yang sudah AKTIF
    // mampir ke PENGECEKAN dulu, yang baru DIKONFIRMASI langsung TERSEDIA.
    const statusLama = lama.status as unknown as MachineStatus;
    const bebas =
      statusLama === MachineStatus.AKTIF
        ? machineWalk(statusLama, MachineStatus.PENGECEKAN, MachineStatus.TERSEDIA)
        : machineWalk(statusLama, MachineStatus.TERSEDIA);
    // Mesin pengganti mengikuti posisi booking saat ini.
    const statusBaru =
      job.lifecycle === asLifecycle(JobLifecycle.AKTIF)
        ? machineWalk(MachineStatus.TERSEDIA, MachineStatus.DIKONFIRMASI, MachineStatus.AKTIF)
        : machineWalk(MachineStatus.TERSEDIA, MachineStatus.DIKONFIRMASI);

    const [, , updated] = await this.prisma.$transaction([
      this.prisma.machine.update({
        where: { id: machineId },
        data: { status: asMachineStatus(bebas) },
      }),
      this.prisma.machine.update({
        where: { id: dto.replacementId },
        data: { status: asMachineStatus(statusBaru) },
      }),
      this.prisma.job.update({
        where: { id: job.id },
        data: {
          machines: { disconnect: { id: machineId }, connect: { id: dto.replacementId } },
        },
        ...withDetails,
      }),
    ]);
    return detailJob(updated as JobWithDetails);
  }

  // ADMIN_SUNDAYA menolak: DIAJUKAN -> DITOLAK. Belum ada mesin ter-assign di DIAJUKAN.
  async reject(user: PrismaUser, id: string, dto: RejectJobDto): Promise<Job> {
    const job = await this.prisma.job.findUnique({ where: { id }, ...withDetails });
    if (!job) throw new NotFoundException('Job tidak ditemukan');
    this.assertLifecycle(job.lifecycle, JobLifecycle.DIAJUKAN);
    nextJobLifecycle(JobLifecycle.DIAJUKAN, JobLifecycle.DITOLAK);

    // Booking ditolak berarti cetakannya bebas lagi: lepaskan jobId supaya Manager
    // bisa membookingnya ulang. Daftar cetakan booking ini tetap terbaca dari log
    // dan dari salinan sebelum update.
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.job.update({
        where: { id: job.id },
        data: { lifecycle: asLifecycle(JobLifecycle.DITOLAK), rejectionReason: dto.reason },
        ...withDetails,
      });
      await tx.mold.updateMany({ where: { jobId: job.id }, data: { jobId: null } });
      return result;
    });
    return detailJob(updated);
  }

  // Tidak ada tombol lifecycle lain di modul ini. Setelah booking dikonfirmasi,
  // job berjalan mengikuti kenyataan fisik: AKTIF saat cetakan pertama diterima
  // Sundaya (Log Penerimaan), SELESAI saat seluruh cetakan sudah kembali ke
  // penyewa (Mold Tracking). Keduanya di jobs/job-transitions.ts.

  // MANAGER_PENYEWA mengajukan perpanjangan sewa. Hanya job yang mesinnya sedang
  // dipakai (AKTIF) yang relevan, dan satu pengajuan terbuka pada satu waktu agar
  // antrean di tab Booking Sundaya tidak ambigu.
  async requestExtension(user: PrismaUser, jobId: string, dto: CreateExtensionDto) {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job tidak ditemukan');
    this.assertParty(user, job);
    this.assertLifecycle(job.lifecycle, JobLifecycle.AKTIF);

    const pending = await this.prisma.rentalExtension.count({
      where: { jobId, status: asExtensionStatus(ExtensionStatus.DIAJUKAN) },
    });
    if (pending > 0) {
      throw new ConflictException('Masih ada pengajuan perpanjangan yang menunggu keputusan');
    }

    const created = await this.prisma.rentalExtension.create({
      data: { jobId, additionalDays: dto.additionalDays },
    });
    return toRentalExtension(created);
  }

  // ADMIN_SUNDAYA memutuskan perpanjangan. DITERIMA menambah durasi dan endDate
  // job dalam satu transaksi supaya sisa masa sewa langsung ikut bergeser.
  async decideExtension(extensionId: string, dto: DecideExtensionDto) {
    const extension = await this.prisma.rentalExtension.findUnique({
      where: { id: extensionId },
      include: { job: { select: { id: true, endDate: true, requestedDurationDays: true } } },
    });
    if (!extension) throw new NotFoundException('Pengajuan perpanjangan tidak ditemukan');
    if (extension.status !== asExtensionStatus(ExtensionStatus.DIAJUKAN)) {
      throw new ConflictException('Pengajuan perpanjangan sudah diputuskan');
    }

    const decided = this.prisma.rentalExtension.update({
      where: { id: extensionId },
      data: { status: asExtensionStatus(dto.decision), decidedAt: new Date() },
    });
    if (dto.decision === ExtensionStatus.DITOLAK) return toRentalExtension(await decided);

    const [updated] = await this.prisma.$transaction([
      decided,
      this.prisma.job.update({
        where: { id: extension.jobId },
        data: {
          requestedDurationDays:
            extension.job.requestedDurationDays + extension.additionalDays,
          // endDate baru dihitung dari endDate berjalan; job AKTIF selalu punya endDate.
          endDate: extension.job.endDate
            ? addDays(extension.job.endDate, extension.additionalDays)
            : undefined,
        },
      }),
    ]);
    return toRentalExtension(updated);
  }

  // Antrean perpanjangan untuk tab Booking Sundaya. Semua status disertakan agar
  // Admin bisa melihat riwayat keputusan, bukan hanya yang menunggu.
  async listExtensions(): Promise<ExtensionRequestRow[]> {
    const rows = await this.prisma.rentalExtension.findMany({
      orderBy: [{ status: 'asc' }, { requestedAt: 'desc' }],
      include: {
        job: {
          select: {
            id: true,
            jobNumber: true,
            endDate: true,
            manager: { select: { companyName: true } },
            molds: { select: { kodeMold: true }, orderBy: { kodeMold: 'asc' } },
            machines: { select: { machineNumber: true }, orderBy: { machineNumber: 'asc' } },
          },
        },
      },
    });
    const now = new Date();
    return rows.map((e) => ({
      extensionId: e.id,
      jobId: e.jobId,
      jobNumber: e.job.jobNumber,
      companyName: e.job.manager.companyName,
      // Booking bisa memuat beberapa cetakan dan beberapa mesin; ringkas jadi satu kolom.
      moldKode: e.job.molds.map((m) => m.kodeMold).join(', ') || null,
      machineNumber: e.job.machines.map((m) => m.machineNumber).join(', ') || null,
      additionalDays: e.additionalDays,
      status: e.status as unknown as ExtensionStatus,
      requestedAt: e.requestedAt.toISOString(),
      endDate: e.job.endDate?.toISOString() ?? null,
      sisaHariSewa: remainingDays(e.job.endDate, now),
    }));
  }

  private tenantScope(user: PrismaUser): Prisma.JobWhereInput {
    if (STAF_SUNDAYA.includes(user.role as Role)) return {};
    if (user.role === Role.MANAGER_PENYEWA) return { managerId: user.id };
    if (user.role === Role.ADMIN_PENYEWA) return { managerId: user.parentId ?? '__none__' };
    return { id: '__none__' };
  }

  private assertParty(user: PrismaUser, job: { managerId: string }) {
    if (STAF_SUNDAYA.includes(user.role as Role)) return;
    const tenantId = user.role === Role.ADMIN_PENYEWA ? user.parentId : user.id;
    if (job.managerId !== tenantId) throw new ForbiddenException('Bukan job perusahaan Anda');
  }

  private assertLifecycle(current: string, expected: JobLifecycle) {
    if (current !== asLifecycle(expected)) {
      throw new ConflictException(
        `Lifecycle job ${current} tidak bisa diproses (butuh ${expected})`,
      );
    }
  }
}
