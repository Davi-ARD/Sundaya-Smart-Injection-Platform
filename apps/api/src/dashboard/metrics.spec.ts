import { DowntimeReason, MachineOperationalStatus } from '@mold-tracker/shared';
import { computeMachineMetrics, OperationalEvent } from './metrics';

const base = new Date('2026-07-23T00:00:00.000Z');
const at = (h: number) => new Date(base.getTime() + h * 60 * 60 * 1000);

function ev(
  h: number,
  status: MachineOperationalStatus,
  downtimeReason: DowntimeReason | null = null,
): OperationalEvent {
  return { status, downtimeReason, occurredAt: at(h) };
}

describe('computeMachineMetrics', () => {
  it('menghitung A/P/Q/OEE/util/MTBF/MTTR dari timeline six big losses', () => {
    // 10h RUNNING, 1h BREAKDOWN, 2h RUNNING, 1h MINOR_STOP (STANDBY), 2h MAINTENANCE; now=16h
    const events: OperationalEvent[] = [
      ev(0, MachineOperationalStatus.RUNNING),
      ev(10, MachineOperationalStatus.BREAKDOWN, DowntimeReason.BREAKDOWN),
      ev(11, MachineOperationalStatus.RUNNING),
      ev(13, MachineOperationalStatus.STANDBY, DowntimeReason.MINOR_STOP),
      ev(14, MachineOperationalStatus.MAINTENANCE),
    ];
    const m = computeMachineMetrics(events, at(16));

    // total=16h, maintenance=2h -> PPT=14h; running=12h; availLoss=1h; perfLoss=1h
    expect(m.availability).toBe(92.9); // operating(13)/ppt(14)
    expect(m.performance).toBe(92.3); // netOp(12)/operating(13)
    expect(m.quality).toBe(100); // tanpa reject
    expect(m.oee).toBe(85.7); // running(12)/ppt(14)
    expect(m.utilization).toBe(75); // running(12)/total(16)
    expect(m.mtbfHours).toBe(13); // operating(13h)/1 breakdown
    expect(m.mttrHours).toBe(1); // 1h breakdown / 1
    expect(m.totalDowntimeHours).toBe(3); // availLoss(1) + maintenance(2)
  });

  it('Quality turun karena reject (STARTUP/PRODUCTION_REJECT)', () => {
    // 8h RUNNING, 2h PRODUCTION_REJECT (STANDBY); now=10h
    const events: OperationalEvent[] = [
      ev(0, MachineOperationalStatus.RUNNING),
      ev(8, MachineOperationalStatus.STANDBY, DowntimeReason.PRODUCTION_REJECT),
    ];
    const m = computeMachineMetrics(events, at(10));
    // ppt=10, availLoss=0, perfLoss=0, operating=10, netOp=10, qualLoss=2
    expect(m.availability).toBe(100);
    expect(m.performance).toBe(100);
    expect(m.quality).toBe(80); // (10-2)/10
    expect(m.oee).toBe(80);
  });

  it('mengembalikan nol saat tidak ada event', () => {
    const m = computeMachineMetrics([], at(5));
    expect(m.oee).toBe(0);
    expect(m.availability).toBe(0);
    expect(m.mtbfHours).toBe(0);
  });

  it('tanpa breakdown, MTBF = seluruh operating time dan MTTR = 0', () => {
    const events: OperationalEvent[] = [ev(0, MachineOperationalStatus.RUNNING)];
    const m = computeMachineMetrics(events, at(5));
    expect(m.mttrHours).toBe(0);
    expect(m.mtbfHours).toBe(5);
  });
});
