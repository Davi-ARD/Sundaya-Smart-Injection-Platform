import { IDEAL_CYCLE_TIME_SEC, MachineOperationalStatus } from '@mold-tracker/shared';
import {
  computeMachineMetrics,
  CorrectiveWindow,
  OperationalEvent,
  QualityTally,
} from './metrics';

const base = new Date('2026-07-23T00:00:00.000Z');
const at = (h: number) => new Date(base.getTime() + h * 60 * 60 * 1000);

function ev(
  h: number,
  status: MachineOperationalStatus,
  cycleTimeSec: number | null = null,
): OperationalEvent {
  return { status, cycleTimeSec, occurredAt: at(h) };
}

const noQuality: QualityTally = { goodProduct: 0, rejectCount: 0 };

describe('computeMachineMetrics: Availability (Layer 1)', () => {
  it('SETUP memotong availability, MAINTENANCE keluar dari PPT', () => {
    // 10h RUNNING, 2h SETUP, 2h RUNNING, 2h MAINTENANCE; now = 16h
    const events = [
      ev(0, MachineOperationalStatus.RUNNING),
      ev(10, MachineOperationalStatus.SETUP),
      ev(12, MachineOperationalStatus.RUNNING),
      ev(14, MachineOperationalStatus.MAINTENANCE),
    ];
    const m = computeMachineMetrics(events, [], noQuality, at(16));

    // total=16h, maintenance=2h -> PPT=14h; setup=2h -> operating=12h
    expect(m.availability).toBe(85.7); // 12/14
    expect(m.utilization).toBe(75); // running 12h / total 16h
    expect(m.totalDowntimeHours).toBe(4); // setup 2h + maintenance 2h
  });

  it('maintenance korektif ikut memotong availability', () => {
    const events = [ev(0, MachineOperationalStatus.RUNNING)];
    const corrective: CorrectiveWindow[] = [{ startedAt: at(6), endedAt: at(8) }];
    const m = computeMachineMetrics(events, corrective, noQuality, at(10));

    expect(m.availability).toBe(80); // (10-2)/10
  });
});

describe('computeMachineMetrics: Performance (cycle time Layer 1)', () => {
  it('cycle time sama dengan ideal berarti performance 100', () => {
    const events = [ev(0, MachineOperationalStatus.RUNNING, IDEAL_CYCLE_TIME_SEC)];
    const m = computeMachineMetrics(events, [], noQuality, at(5));
    expect(m.performance).toBe(100);
  });

  it('cycle time dua kali ideal berarti performance 50', () => {
    const events = [ev(0, MachineOperationalStatus.RUNNING, IDEAL_CYCLE_TIME_SEC * 2)];
    const m = computeMachineMetrics(events, [], noQuality, at(5));
    expect(m.performance).toBe(50);
  });

  it('cycle time lebih cepat dari ideal dibatasi 100, bukan lebih', () => {
    const events = [ev(0, MachineOperationalStatus.RUNNING, IDEAL_CYCLE_TIME_SEC / 2)];
    const m = computeMachineMetrics(events, [], noQuality, at(5));
    expect(m.performance).toBe(100);
  });

  it('tanpa laporan cycle time, performance 100 (data belum masuk, bukan mesin lambat)', () => {
    const events = [ev(0, MachineOperationalStatus.RUNNING)];
    const m = computeMachineMetrics(events, [], noQuality, at(5));
    expect(m.performance).toBe(100);
  });
});

describe('computeMachineMetrics: Quality (Layer 2)', () => {
  it('quality dari good vs reject Log Produksi', () => {
    const events = [ev(0, MachineOperationalStatus.RUNNING)];
    const m = computeMachineMetrics(events, [], { goodProduct: 800, rejectCount: 200 }, at(10));
    expect(m.quality).toBe(80);
  });

  it('tanpa produksi tercatat, quality 100', () => {
    const events = [ev(0, MachineOperationalStatus.RUNNING)];
    const m = computeMachineMetrics(events, [], noQuality, at(10));
    expect(m.quality).toBe(100);
  });
});

describe('computeMachineMetrics: OEE, MTBF, MTTR', () => {
  it('OEE hasil kali tiga dimensi lintas layer', () => {
    // Availability 80 (2h setup dari 10h), Performance 50 (cycle 2x ideal), Quality 80
    const events = [
      ev(0, MachineOperationalStatus.RUNNING, IDEAL_CYCLE_TIME_SEC * 2),
      ev(8, MachineOperationalStatus.SETUP),
    ];
    const m = computeMachineMetrics(
      events,
      [],
      { goodProduct: 800, rejectCount: 200 },
      at(10),
    );

    expect(m.availability).toBe(80);
    expect(m.performance).toBe(50);
    expect(m.quality).toBe(80);
    expect(m.oee).toBe(32); // 0.8 * 0.5 * 0.8
  });

  it('MTBF dan MTTR dari maintenance korektif', () => {
    const events = [ev(0, MachineOperationalStatus.RUNNING)];
    const corrective: CorrectiveWindow[] = [
      { startedAt: at(4), endedAt: at(5) },
      { startedAt: at(8), endedAt: at(9) },
    ];
    const m = computeMachineMetrics(events, corrective, noQuality, at(10));

    // operating = 10h - 2h korektif = 8h, dua kejadian
    expect(m.mtbfHours).toBe(4);
    expect(m.mttrHours).toBe(1);
  });

  it('maintenance korektif yang belum selesai dihitung sampai sekarang', () => {
    const events = [ev(0, MachineOperationalStatus.RUNNING)];
    const corrective: CorrectiveWindow[] = [{ startedAt: at(8), endedAt: null }];
    const m = computeMachineMetrics(events, corrective, noQuality, at(10));

    expect(m.mttrHours).toBe(2); // 8h sampai now (10h)
  });

  it('tanpa korektif, MTBF sama dengan seluruh operating time dan MTTR nol', () => {
    const events = [ev(0, MachineOperationalStatus.RUNNING)];
    const m = computeMachineMetrics(events, [], noQuality, at(5));
    expect(m.mtbfHours).toBe(5);
    expect(m.mttrHours).toBe(0);
  });

  it('mengembalikan nol saat tidak ada event', () => {
    const m = computeMachineMetrics([], [], noQuality, at(5));
    expect(m.oee).toBe(0);
    expect(m.availability).toBe(0);
    expect(m.utilization).toBe(0);
    expect(m.mtbfHours).toBe(0);
  });
});
