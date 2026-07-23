import { DeliveryStatus, MoldTrackingStatus, Role } from '@mold-tracker/shared';
import { User as PrismaUser } from '@prisma/client';
import { PengirimanService } from './pengiriman.service';
import { PrismaService } from '../prisma/prisma.service';

function prismaMock() {
  return { job: { findMany: jest.fn() } };
}
function svc(prisma: ReturnType<typeof prismaMock>) {
  return new PengirimanService(prisma as unknown as PrismaService);
}

const manager = { id: 'mgr-1', role: Role.MANAGER_PENYEWA } as unknown as PrismaUser;
const now = new Date('2026-08-15');

// Job dengan sumber rencana + aktual seperti hasil include jobWithSources.
const jobRow = (over: Record<string, unknown> = {}) => ({
  id: 'job-1',
  jobNumber: 'SSIP-0001',
  rencanaKirimMold: new Date('2026-08-10'),
  planMaterialUtama: 'PP Resin',
  mold: {
    kodeMold: 'MLD-001',
    namaProduk: 'Tutup',
    trackingStatus: MoldTrackingStatus.RECEIVED,
    trackingEvents: [{ at: new Date('2026-08-09') }],
  },
  logProduksi: [{ occurredAt: new Date('2026-08-12'), materialName: 'PP Resin' }],
  ...over,
});

describe('PengirimanService.list', () => {
  it('scope Manager: filter managerId dirinya', async () => {
    const prisma = prismaMock();
    prisma.job.findMany.mockResolvedValue([]);
    await svc(prisma).list(manager, undefined, now);
    expect(prisma.job.findMany.mock.calls[0][0].where.managerId).toBe('mgr-1');
  });

  it('mold on-time + material terlambat: 2 baris dengan status benar', async () => {
    const prisma = prismaMock();
    prisma.job.findMany.mockResolvedValue([jobRow()]);
    const rows = await svc(prisma).list(manager, undefined, now);

    expect(rows).toHaveLength(2);
    const mold = rows.find((r) => r.item.startsWith('Mold'))!;
    const material = rows.find((r) => r.item.startsWith('Material'))!;
    // mold tiba 2026-08-09 vs rencana 08-10 -> on-time (-1)
    expect(mold.status).toBe(DeliveryStatus.TIBA_ONTIME);
    expect(mold.selisihHari).toBe(-1);
    // material tiba 08-12 vs 08-10 -> terlambat (+2)
    expect(material.status).toBe(DeliveryStatus.TIBA_TERLAMBAT);
    expect(material.selisihHari).toBe(2);
  });

  it('mold sedang dikirim (DELIVERY, belum RECEIVED) -> DIKIRIM', async () => {
    const prisma = prismaMock();
    prisma.job.findMany.mockResolvedValue([
      jobRow({
        planMaterialUtama: null,
        logProduksi: [],
        mold: {
          kodeMold: 'MLD-001',
          namaProduk: 'Tutup',
          trackingStatus: MoldTrackingStatus.DELIVERY,
          trackingEvents: [],
        },
      }),
    ]);
    const rows = await svc(prisma).list(manager, undefined, now);
    expect(rows).toHaveLength(1); // tanpa baris material
    expect(rows[0].status).toBe(DeliveryStatus.DIKIRIM);
  });

  it('belum tiba, rencana lewat, tidak in-transit -> BELUM_TIBA', async () => {
    const prisma = prismaMock();
    prisma.job.findMany.mockResolvedValue([
      jobRow({
        planMaterialUtama: null,
        logProduksi: [],
        mold: {
          kodeMold: 'MLD-001',
          namaProduk: 'Tutup',
          trackingStatus: MoldTrackingStatus.PLANNING,
          trackingEvents: [],
        },
      }),
    ]);
    const rows = await svc(prisma).list(manager, undefined, now);
    expect(rows[0].status).toBe(DeliveryStatus.BELUM_TIBA);
  });
});
