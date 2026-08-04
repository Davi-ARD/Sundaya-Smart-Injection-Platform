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
  Role,
} from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import { machineWalk } from '../machines/machine-state';
import { nextJobLifecycle } from './job-state';
import { remainingDays } from './job-status';
import { toJob, toRentalExtension } from './job.mapper';
import {
  AssignJobDto,
  CreateExtensionDto,
  CreateJobDto,
  DecideExtensionDto,
  RejectJobDto,
} from './dto';

// ponytail: enum shared dan Prisma nominal berbeda, cast di batang DB saja.
const asLifecycle = (s: JobLifecycle) => s as unknown as $Enums.JobLifecycle;
const asMachineStatus = (s: MachineStatus) => s as unknown as $Enums.MachineStatus;
const asExtensionStatus = (s: ExtensionStatus) => s as unknown as $Enums.ExtensionStatus;

const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (d: Date, days: number) => new Date(d.getTime() + days * DAY_MS);

const STAF_SUNDAYA: Role[] = [Role.SUPER_ADMIN, Role.ADMIN_SUNDAYA, Role.TEKNISI_SUNDAYA];

const withDetails = {
  include: {
    machine: { select: { machineNumber: true, status: true } },
    manager: { select: { companyName: true } },
    extensions: { orderBy: { requestedAt: 'desc' as const } },
    // Staf Sundaya tidak punya akses GET /molds; ini sumber info mold mereka.
    mold: { select: { id: true, kodeMold: true, namaProduk: true, trackingStatus: true, tonaseTon: true } },
  },
} as const;

type JobWithDetails = Prisma.JobGetPayload<typeof withDetails>;

@Injectable()
export class JobsService {
  constructor(private prisma: PrismaService) {}

  // Booking (MANAGER_PENYEWA): pilih mold miliknya + plan waktu/material, tanpa
  // memilih mesin. Lifecycle mulai DIAJUKAN (default schema); mesin di-assign
  // Admin Sundaya belakangan. Satu mold hanya boleh satu job (moldId @unique).
  async create(user: PrismaUser, dto: CreateJobDto): Promise<Job> {
    const mold = await this.prisma.mold.findUnique({ where: { id: dto.moldId } });
    if (!mold || mold.managerId !== user.id) {
      throw new NotFoundException('Cetakan tidak ditemukan');
    }
    // ponytail: jobNumber base36 timestamp, unik cukup untuk laju booking manusia;
    // naikkan ke sekuens rapi SSIP-0001 bila butuh nomor berurutan.
    const jobNumber = `SSIP-${Date.now().toString(36).toUpperCase()}`;
    try {
      const job = await this.prisma.job.create({
        data: {
          jobNumber,
          moldId: dto.moldId,
          managerId: user.id,
          requestedDurationDays: dto.requestedDurationDays,
          destinationLocation: dto.destinationLocation,
          startDate: new Date(dto.startDate),
          planMaterialUtama: dto.planMaterialUtama,
          estimasiMaterialKg: dto.estimasiMaterialKg,
          materialTambahan: dto.materialTambahan,
          targetOutput: dto.targetOutput,
          rencanaKirimMold: dto.rencanaKirimMold ? new Date(dto.rencanaKirimMold) : undefined,
        },
        ...withDetails,
      });
      return toJob(job, job.machine?.machineNumber, job.extensions, job.mold);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Cetakan ini sudah dibooking');
      }
      throw error;
    }
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
    return jobs.map((j) => toJob(j, j.machine?.machineNumber, j.extensions, j.mold));
  }

  async findOne(user: PrismaUser, id: string): Promise<Job> {
    const j = await this.prisma.job.findUnique({ where: { id }, ...withDetails });
    if (!j) throw new NotFoundException('Job tidak ditemukan');
    this.assertParty(user, j);
    return toJob(j, j.machine?.machineNumber, j.extensions, j.mold);
  }

  // ADMIN_SUNDAYA menyetujui + assign mesin: DIAJUKAN -> DIKONFIRMASI. Mesin harus
  // TERSEDIA dan tonasenya cocok mold. Mesin ikut berjalan TERSEDIA -> DIKONFIRMASI.
  async assign(user: PrismaUser, id: string, dto: AssignJobDto): Promise<Job> {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: { mold: { select: { tonaseTon: true } } },
    });
    if (!job) throw new NotFoundException('Job tidak ditemukan');
    this.assertLifecycle(job.lifecycle, JobLifecycle.DIAJUKAN);

    const machine = await this.prisma.machine.findUnique({ where: { id: dto.machineId } });
    if (!machine) throw new NotFoundException('Mesin tidak ditemukan');
    if (machine.status !== asMachineStatus(MachineStatus.TERSEDIA)) {
      throw new ConflictException('Mesin sedang tidak tersedia');
    }
    if (machine.tonaseTon !== job.mold.tonaseTon) {
      throw new BadRequestException('Tonase mesin tidak cocok dengan mold');
    }

    nextJobLifecycle(JobLifecycle.DIAJUKAN, JobLifecycle.DIKONFIRMASI);
    const nextMachine = machineWalk(
      MachineStatus.TERSEDIA,
      MachineStatus.DIAJUKAN,
      MachineStatus.DIKONFIRMASI,
    );

    const [updated] = await this.prisma.$transaction([
      this.prisma.job.update({
        where: { id: job.id },
        data: {
          machineId: machine.id,
          assignedById: user.id,
          confirmedAt: new Date(),
          lifecycle: asLifecycle(JobLifecycle.DIKONFIRMASI),
        },
        ...withDetails,
      }),
      this.prisma.machine.update({
        where: { id: machine.id },
        data: { status: asMachineStatus(nextMachine) },
      }),
    ]);
    return toJob(
      updated as JobWithDetails,
      machine.machineNumber,
      (updated as JobWithDetails).extensions,
      (updated as JobWithDetails).mold,
    );
  }

  // ADMIN_SUNDAYA menolak: DIAJUKAN -> DITOLAK. Belum ada mesin ter-assign di DIAJUKAN.
  async reject(user: PrismaUser, id: string, dto: RejectJobDto): Promise<Job> {
    const job = await this.prisma.job.findUnique({ where: { id }, ...withDetails });
    if (!job) throw new NotFoundException('Job tidak ditemukan');
    this.assertLifecycle(job.lifecycle, JobLifecycle.DIAJUKAN);
    nextJobLifecycle(JobLifecycle.DIAJUKAN, JobLifecycle.DITOLAK);

    const updated = await this.prisma.job.update({
      where: { id: job.id },
      data: { lifecycle: asLifecycle(JobLifecycle.DITOLAK), rejectionReason: dto.reason },
      ...withDetails,
    });
    return toJob(updated, updated.machine?.machineNumber, updated.extensions, updated.mold);
  }

  // Transisi pasca-assign (ADMIN_SUNDAYA). Mesin sudah ter-assign, berjalan lockstep.
  ship(_user: PrismaUser, id: string): Promise<Job> {
    return this.advance(id, {
      from: JobLifecycle.DIKONFIRMASI,
      to: JobLifecycle.DIKIRIM,
      machinePath: [MachineStatus.DIKIRIM],
      data: { shippedAt: new Date() },
    });
  }

  activate(_user: PrismaUser, id: string): Promise<Job> {
    return this.advance(id, {
      from: JobLifecycle.DIKIRIM,
      to: JobLifecycle.AKTIF,
      machinePath: [MachineStatus.AKTIF],
      // Durasi sewa penuh dimulai saat mesin benar-benar aktif, bukan dari startDate rencana.
      data: (job) => {
        const now = new Date();
        return { receivedAt: now, startDate: now, endDate: addDays(now, job.requestedDurationDays) };
      },
    });
  }

  return(_user: PrismaUser, id: string): Promise<Job> {
    return this.advance(id, {
      from: JobLifecycle.AKTIF,
      to: JobLifecycle.SELESAI_SEWA,
      machinePath: [MachineStatus.SELESAI_SEWA],
      data: { returnedAt: new Date() },
    });
  }

  collect(_user: PrismaUser, id: string): Promise<Job> {
    return this.advance(id, {
      from: JobLifecycle.SELESAI_SEWA,
      to: JobLifecycle.DIKEMBALIKAN,
      machinePath: [MachineStatus.DIKEMBALIKAN],
    });
  }

  // Selesai: mesin lewat PENGECEKAN kembali ke TERSEDIA (jalur maintenance ditangani modul Maintenance).
  complete(_user: PrismaUser, id: string): Promise<Job> {
    return this.advance(id, {
      from: JobLifecycle.DIKEMBALIKAN,
      to: JobLifecycle.SELESAI,
      machinePath: [MachineStatus.PENGECEKAN, MachineStatus.TERSEDIA],
    });
  }

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
            mold: { select: { kodeMold: true } },
            machine: { select: { machineNumber: true } },
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
      moldKode: e.job.mold.kodeMold,
      machineNumber: e.job.machine?.machineNumber ?? null,
      additionalDays: e.additionalDays,
      status: e.status as unknown as ExtensionStatus,
      requestedAt: e.requestedAt.toISOString(),
      endDate: e.job.endDate?.toISOString() ?? null,
      sisaHariSewa: remainingDays(e.job.endDate, now),
    }));
  }

  // Jalur bersama transisi lifecycle + mesin dalam satu transaksi. data boleh fungsi
  // bila butuh field job yang baru termuat (mis. requestedDurationDays).
  private async advance(
    id: string,
    step: {
      from: JobLifecycle;
      to: JobLifecycle;
      machinePath: MachineStatus[];
      data?:
        | Prisma.JobUpdateInput
        | ((job: { requestedDurationDays: number }) => Prisma.JobUpdateInput);
    },
  ): Promise<Job> {
    const job = await this.prisma.job.findUnique({ where: { id }, ...withDetails });
    if (!job) throw new NotFoundException('Job tidak ditemukan');
    this.assertLifecycle(job.lifecycle, step.from);
    if (!job.machineId || !job.machine) {
      throw new ConflictException('Job belum memiliki mesin ter-assign');
    }
    nextJobLifecycle(step.from, step.to);
    const nextMachine = machineWalk(
      job.machine.status as unknown as MachineStatus,
      ...step.machinePath,
    );
    const data = typeof step.data === 'function' ? step.data(job) : (step.data ?? {});

    const [updated] = await this.prisma.$transaction([
      this.prisma.job.update({
        where: { id: job.id },
        data: { ...data, lifecycle: asLifecycle(step.to) },
        ...withDetails,
      }),
      this.prisma.machine.update({
        where: { id: job.machineId },
        data: { status: asMachineStatus(nextMachine) },
      }),
    ]);
    return toJob(
      updated as JobWithDetails,
      job.machine.machineNumber,
      (updated as JobWithDetails).extensions,
      (updated as JobWithDetails).mold,
    );
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
