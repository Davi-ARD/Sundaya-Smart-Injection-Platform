import {
  IDEAL_CYCLE_TIME_SEC,
  MachineMetrics,
  MachineOperationalStatus,
} from '@mold-tracker/shared';

const HOUR_MS = 60 * 60 * 1000;
const round = (n: number, d = 1) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};
const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

export interface OperationalEvent {
  status: MachineOperationalStatus;
  cycleTimeSec: number | null;
  occurredAt: Date;
}

// Maintenance korektif (tidak terencana) per mesin: sumber MTBF/MTTR menggantikan
// status BREAKDOWN yang sudah dihapus dari input Teknisi.
export interface CorrectiveWindow {
  startedAt: Date;
  endedAt: Date | null;
}

// Kualitas dari Layer 2 (Log Produksi Admin Penyewa), bukan reason code Layer 1.
export interface QualityTally {
  goodProduct: number;
  rejectCount: number;
}

export type MetricValues = Omit<MachineMetrics, 'machineId' | 'machineNumber'>;

// OEE tiga dimensi yang sumbernya dipisah per layer, sesuai aturan dual-layer:
//
//   Availability : Layer 1. PPT = total waktu terpantau minus maintenance
//                  terencana (PREVENTIVE). Loss = durasi SETUP + maintenance
//                  korektif (padanan breakdown).
//   Performance  : Layer 1. Rasio cycle time ideal terhadap rata-rata aktual yang
//                  dilaporkan Teknisi. Aktual lebih lambat berarti performance turun.
//   Quality      : Layer 2. good / (good + reject) dari Log Produksi.
//
// OEE = Availability x Performance x Quality. Utilization = porsi waktu RUNNING.
// Tidak ada angka di sini yang diinput manual: semuanya turunan event.
export function computeMachineMetrics(
  events: OperationalEvent[],
  corrective: CorrectiveWindow[] = [],
  quality: QualityTally = { goodProduct: 0, rejectCount: 0 },
  now: Date = new Date(),
): MetricValues {
  const sorted = [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  let totalMs = 0;
  let runningMs = 0;
  let setupMs = 0;
  let plannedMaintenanceMs = 0;
  let cycleSum = 0;
  let cycleCount = 0;

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i];
    const end = i < sorted.length - 1 ? sorted[i + 1].occurredAt.getTime() : now.getTime();
    const dur = Math.max(end - ev.occurredAt.getTime(), 0);
    totalMs += dur;

    if (ev.status === MachineOperationalStatus.RUNNING) runningMs += dur;
    else if (ev.status === MachineOperationalStatus.SETUP) setupMs += dur;
    else if (ev.status === MachineOperationalStatus.MAINTENANCE) plannedMaintenanceMs += dur;

    if (ev.cycleTimeSec != null && ev.cycleTimeSec > 0) {
      cycleSum += ev.cycleTimeSec;
      cycleCount += 1;
    }
  }

  const correctiveMs = corrective.reduce(
    (sum, w) => sum + Math.max((w.endedAt?.getTime() ?? now.getTime()) - w.startedAt.getTime(), 0),
    0,
  );

  const ppt = Math.max(totalMs - plannedMaintenanceMs, 0);
  const availLoss = setupMs + correctiveMs;
  const operating = Math.max(ppt - availLoss, 0);

  const availability = ppt > 0 ? clamp01(operating / ppt) : 0;

  // Tanpa laporan cycle time, performance belum terukur; pakai 1 agar OEE tidak
  // dihukum karena data yang belum masuk (bukan karena mesinnya lambat).
  const avgCycle = cycleCount > 0 ? cycleSum / cycleCount : 0;
  const performance = avgCycle > 0 ? clamp01(IDEAL_CYCLE_TIME_SEC / avgCycle) : 1;

  const producedTotal = quality.goodProduct + quality.rejectCount;
  const qualityRate = producedTotal > 0 ? clamp01(quality.goodProduct / producedTotal) : 1;

  const oee = availability * performance * qualityRate;
  const utilization = totalMs > 0 ? clamp01(runningMs / totalMs) : 0;

  // MTBF: waktu operasi per kejadian korektif. MTTR: rata-rata durasi perbaikan.
  const operatingHours = operating / HOUR_MS;
  const mtbfHours = corrective.length > 0 ? operatingHours / corrective.length : operatingHours;
  const mttrHours = corrective.length > 0 ? correctiveMs / HOUR_MS / corrective.length : 0;
  const totalDowntimeHours = (availLoss + plannedMaintenanceMs) / HOUR_MS;

  return {
    availability: round(availability * 100),
    performance: round(performance * 100),
    quality: round(qualityRate * 100),
    oee: round(oee * 100),
    utilization: round(utilization * 100),
    mtbfHours: round(mtbfHours, 2),
    mttrHours: round(mttrHours, 2),
    totalDowntimeHours: round(totalDowntimeHours, 2),
  };
}
