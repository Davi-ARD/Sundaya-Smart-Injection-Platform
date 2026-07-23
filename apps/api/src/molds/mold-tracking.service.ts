import { Injectable, NotFoundException } from '@nestjs/common';
import { $Enums, User as PrismaUser } from '@prisma/client';
import { Mold, MoldTrackingStatus, Role } from '@mold-tracker/shared';
import { PrismaService } from '../prisma/prisma.service';
import { toMold } from './mold.mapper';
import { assertMoldTransition, assertRoleMayTransition } from './mold-tracking-state';
import { UpdateMoldTrackingDto } from './mold-tracking.dto';

// ponytail: enum shared dan Prisma nominal berbeda, cast di batang DB saja.
const asTracking = (s: MoldTrackingStatus) => s as unknown as $Enums.MoldTrackingStatus;

@Injectable()
export class MoldTrackingService {
  constructor(private prisma: PrismaService) {}

  // Transisi tracking mold (ADMIN_SUNDAYA / TEKNISI setup). Dalam satu transaksi:
  // update Mold.trackingStatus + append MoldTrackingEvent (histori, byId, at).
  // Event RECEIVED yang tersimpan dipakai Log Pengiriman (B4) sebagai aktual-tiba mold.
  async transition(user: PrismaUser, moldId: string, dto: UpdateMoldTrackingDto): Promise<Mold> {
    const mold = await this.prisma.mold.findUnique({ where: { id: moldId } });
    if (!mold) throw new NotFoundException('Cetakan tidak ditemukan');

    const from = mold.trackingStatus as unknown as MoldTrackingStatus;
    assertMoldTransition(from, dto.status);
    assertRoleMayTransition(user.role as Role, from, dto.status);

    const [updated] = await this.prisma.$transaction([
      this.prisma.mold.update({
        where: { id: moldId },
        data: { trackingStatus: asTracking(dto.status) },
      }),
      this.prisma.moldTrackingEvent.create({
        data: { moldId, status: asTracking(dto.status), byId: user.id },
      }),
    ]);
    return toMold(updated);
  }
}
