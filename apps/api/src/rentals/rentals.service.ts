import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { $Enums, Prisma, User as PrismaUser } from '@prisma/client';
import {
  ConditionCheck,
  ConditionResult,
  ExtensionStatus,
  MachineStatus,
  Rental,
  RentalExtension,
  RentalStatus,
  Role,
} from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateConditionCheckDto,
  CreateExtensionDto,
  CreateRentalDto,
  DecideExtensionDto,
  RejectRentalDto,
} from './dto';
import { toConditionCheck, toRental, toRentalExtension } from './rental.mapper';
import { machineWalk } from './rental-state';

// ponytail: enum shared dan Prisma nominal berbeda meski nilainya sama, cast di batang DB saja.
const asMachineStatus = (s: MachineStatus) => s as unknown as $Enums.MachineStatus;
const asRentalStatus = (s: RentalStatus) => s as unknown as $Enums.RentalStatus;
const asExtensionStatus = (s: ExtensionStatus) => s as unknown as $Enums.ExtensionStatus;

const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (d: Date, days: number) => new Date(d.getTime() + days * DAY_MS);

const withMachineNumber = { include: { machine: { select: { machineNumber: true } } } } as const;

@Injectable()
export class RentalsService {
  constructor(private prisma: PrismaService) {}

  // PENYEWA: sewa miliknya. PENYEDIA: sewa mesin miliknya. OPERATOR: sewa induk (PENYEWA-nya).
  // ADMIN: semua. Penyaringan kepemilikan di service, bukan controller.
  async findAll(user: PrismaUser, status?: RentalStatus): Promise<Rental[]> {
    const statusFilter = status ? asRentalStatus(status) : undefined;
    const scope =
      user.role === Role.ADMIN
        ? {}
        : user.role === Role.PENYEDIA
          ? { penyediaId: user.id }
          : user.role === Role.OPERATOR
            ? { penyewaId: user.parentId ?? '__none__' }
            : { penyewaId: user.id };

    const rentals = await this.prisma.rental.findMany({
      where: { ...scope, status: statusFilter },
      orderBy: { createdAt: 'desc' },
      ...withMachineNumber,
    });
    return rentals.map((r) => toRental(r, r.machine.machineNumber));
  }

  async findOne(user: PrismaUser, id: string): Promise<Rental> {
    const r = await this.prisma.rental.findUnique({ where: { id }, ...withMachineNumber });
    if (!r) throw new NotFoundException('Sewa tidak ditemukan');
    this.assertParty(user, r);
    return toRental(r, r.machine.machineNumber);
  }

  // PENYEWA mengajukan sewa. Mesin harus TERSEDIA -> DIAJUKAN.
  async create(user: PrismaUser, dto: CreateRentalDto): Promise<Rental> {
    const machine = await this.prisma.machine.findUnique({ where: { id: dto.machineId } });
    if (!machine) throw new NotFoundException('Mesin tidak ditemukan');
    if (machine.status !== asMachineStatus(MachineStatus.TERSEDIA)) {
      throw new ConflictException('Mesin sedang tidak tersedia');
    }

    const startDate = new Date(dto.startDate);
    const endDate = addDays(startDate, dto.requestedDurationDays);
    const nextMachine = machineWalk(MachineStatus.TERSEDIA, MachineStatus.DIAJUKAN);

    const [rental] = await this.prisma.$transaction([
      this.prisma.rental.create({
        data: {
          machineId: machine.id,
          penyewaId: user.id,
          penyediaId: machine.ownerId,
          status: asRentalStatus(RentalStatus.DIAJUKAN),
          requestedDurationDays: dto.requestedDurationDays,
          destinationLocation: dto.destinationLocation,
          startDate,
          endDate,
        },
      }),
      this.setMachineStatus(machine.id, nextMachine),
    ]);
    return toRental(rental, machine.machineNumber);
  }

  // PENYEDIA menerima: DIAJUKAN -> DIKONFIRMASI.
  confirm(user: PrismaUser, id: string): Promise<Rental> {
    return this.advance(user, id, {
      party: 'penyedia',
      fromRental: RentalStatus.DIAJUKAN,
      toRental: RentalStatus.DIKONFIRMASI,
      machinePath: [MachineStatus.DIKONFIRMASI],
      data: { confirmedAt: new Date() },
    });
  }

  // PENYEDIA menolak: DIAJUKAN -> DITOLAK, mesin kembali TERSEDIA.
  reject(user: PrismaUser, id: string, dto: RejectRentalDto): Promise<Rental> {
    return this.advance(user, id, {
      party: 'penyedia',
      fromRental: RentalStatus.DIAJUKAN,
      toRental: RentalStatus.DITOLAK,
      machinePath: [MachineStatus.TERSEDIA],
      data: { rejectionReason: dto.reason },
    });
  }

  // PENYEDIA menandai dikirim: DIKONFIRMASI -> DIKIRIM.
  ship(user: PrismaUser, id: string): Promise<Rental> {
    return this.advance(user, id, {
      party: 'penyedia',
      fromRental: RentalStatus.DIKONFIRMASI,
      toRental: RentalStatus.DIKIRIM,
      machinePath: [MachineStatus.DIKIRIM],
      data: { shippedAt: new Date() },
    });
  }

  // PENYEWA konfirmasi terima: DIKIRIM -> AKTIF.
  receive(user: PrismaUser, id: string): Promise<Rental> {
    return this.advance(user, id, {
      party: 'penyewa',
      fromRental: RentalStatus.DIKIRIM,
      toRental: RentalStatus.AKTIF,
      machinePath: [MachineStatus.AKTIF],
      data: { receivedAt: new Date() },
    });
  }

  // PENYEWA mengajukan pengembalian: AKTIF -> SELESAI_SEWA; mesin SELESAI_SEWA lalu DIKEMBALIKAN.
  return(user: PrismaUser, id: string): Promise<Rental> {
    return this.advance(user, id, {
      party: 'penyewa',
      fromRental: RentalStatus.AKTIF,
      toRental: RentalStatus.SELESAI_SEWA,
      machinePath: [MachineStatus.SELESAI_SEWA, MachineStatus.DIKEMBALIKAN],
      data: { returnedAt: new Date() },
    });
  }

  // PENYEDIA mencatat pengecekan: rental SELESAI; mesin PENGECEKAN lalu TERSEDIA/MAINTENANCE.
  async conditionCheck(
    user: PrismaUser,
    id: string,
    dto: CreateConditionCheckDto,
  ): Promise<ConditionCheck> {
    const rental = await this.loadOwned(user, id, 'penyedia');
    this.assertRental(rental.status, RentalStatus.SELESAI_SEWA);

    const finalMachine =
      dto.result === ConditionResult.BAIK ? MachineStatus.TERSEDIA : MachineStatus.MAINTENANCE;
    machineWalk(rental.machine.status as unknown as MachineStatus, MachineStatus.PENGECEKAN, finalMachine);

    const [check] = await this.prisma.$transaction([
      this.prisma.conditionCheck.create({
        data: {
          machineId: rental.machineId,
          rentalId: rental.id,
          checkedById: user.id,
          result: dto.result as unknown as $Enums.ConditionResult,
          notes: dto.notes ?? null,
        },
      }),
      this.prisma.rental.update({
        where: { id: rental.id },
        data: { status: asRentalStatus(RentalStatus.SELESAI) },
      }),
      this.prisma.machine.update({
        where: { id: rental.machineId },
        data: { status: asMachineStatus(finalMachine) },
      }),
    ]);
    return toConditionCheck(check);
  }

  // PENYEWA mengajukan perpanjangan pada sewa AKTIF.
  async requestExtension(
    user: PrismaUser,
    id: string,
    dto: CreateExtensionDto,
  ): Promise<RentalExtension> {
    const rental = await this.loadOwned(user, id, 'penyewa');
    this.assertRental(rental.status, RentalStatus.AKTIF);
    const ext = await this.prisma.rentalExtension.create({
      data: {
        rentalId: rental.id,
        additionalDays: dto.additionalDays,
        status: asExtensionStatus(ExtensionStatus.DIAJUKAN),
      },
    });
    return toRentalExtension(ext);
  }

  // PENYEDIA memutuskan perpanjangan; DITERIMA memperpanjang endDate sewa.
  async decideExtension(
    user: PrismaUser,
    extensionId: string,
    dto: DecideExtensionDto,
  ): Promise<RentalExtension> {
    const ext = await this.prisma.rentalExtension.findUnique({
      where: { id: extensionId },
      include: { rental: true },
    });
    if (!ext) throw new NotFoundException('Perpanjangan tidak ditemukan');
    if (user.role !== Role.ADMIN && ext.rental.penyediaId !== user.id) {
      throw new ForbiddenException('Bukan sewa milik Anda');
    }
    if (ext.status !== asExtensionStatus(ExtensionStatus.DIAJUKAN)) {
      throw new ConflictException('Perpanjangan sudah diputuskan');
    }

    const ops: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.rentalExtension.update({
        where: { id: ext.id },
        data: { status: asExtensionStatus(dto.decision), decidedAt: new Date() },
      }),
    ];
    if (dto.decision === ExtensionStatus.DITERIMA && ext.rental.endDate) {
      ops.push(
        this.prisma.rental.update({
          where: { id: ext.rentalId },
          data: { endDate: addDays(ext.rental.endDate, ext.additionalDays) },
        }),
      );
    }
    const [updated] = await this.prisma.$transaction(ops);
    return toRentalExtension(updated as Parameters<typeof toRentalExtension>[0]);
  }

  // Jalur bersama untuk transisi satu-langkah rental + mesin dalam satu transaksi.
  private async advance(
    user: PrismaUser,
    id: string,
    step: {
      party: 'penyewa' | 'penyedia';
      fromRental: RentalStatus;
      toRental: RentalStatus;
      machinePath: MachineStatus[];
      data: Prisma.RentalUpdateInput;
    },
  ): Promise<Rental> {
    const rental = await this.loadOwned(user, id, step.party);
    this.assertRental(rental.status, step.fromRental);
    const nextMachine = machineWalk(
      rental.machine.status as unknown as MachineStatus,
      ...step.machinePath,
    );

    const [updated] = await this.prisma.$transaction([
      this.prisma.rental.update({
        where: { id: rental.id },
        data: { ...step.data, status: asRentalStatus(step.toRental) },
        ...withMachineNumber,
      }),
      this.setMachineStatus(rental.machineId, nextMachine),
    ]);
    return toRental(updated, rental.machine.machineNumber);
  }

  // machineWalk sudah memvalidasi transisi dari status termuat; ini hanya menuliskan status akhir.
  // ponytail: tanpa row lock, ada celah TOCTOU singkat antara load dan update; cukup untuk beban
  // rendah, naikkan ke SELECT ... FOR UPDATE kalau kelak butuh konkurensi tinggi.
  private setMachineStatus(machineId: string, to: MachineStatus) {
    return this.prisma.machine.update({
      where: { id: machineId },
      data: { status: asMachineStatus(to) },
    });
  }

  private assertRental(current: string, expected: RentalStatus) {
    if (current !== asRentalStatus(expected)) {
      throw new ConflictException(`Status sewa ${current} tidak bisa diproses (butuh ${expected})`);
    }
  }

  // Muat sewa + status mesin, pastikan user adalah pihak yang berwenang atas transisi ini.
  private async loadOwned(user: PrismaUser, id: string, party: 'penyewa' | 'penyedia') {
    const r = await this.prisma.rental.findUnique({
      where: { id },
      include: { machine: { select: { status: true, machineNumber: true } } },
    });
    if (!r) throw new NotFoundException('Sewa tidak ditemukan');
    const ownerId = party === 'penyewa' ? r.penyewaId : r.penyediaId;
    if (user.role !== Role.ADMIN && ownerId !== user.id) {
      throw new ForbiddenException('Bukan sewa milik Anda');
    }
    return r;
  }

  private assertParty(user: PrismaUser, r: { penyewaId: string; penyediaId: string }) {
    if (
      user.role !== Role.ADMIN &&
      r.penyewaId !== user.id &&
      r.penyediaId !== user.id
    ) {
      throw new ForbiddenException('Bukan sewa milik Anda');
    }
  }
}
