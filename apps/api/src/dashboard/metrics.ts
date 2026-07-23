import {
  DowntimeReason,
  MachineMetrics,
  MachineOperationalStatus,
} from '@mold-tracker/shared';

const HOUR_MS = 60 * 60 * 1000;
const round = (n: number, d = 1) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

export interface OperationalEvent {
  status: MachineOperationalStatus;
  downtimeReason: DowntimeReason | null;
  occurredAt: Date;
}

export type MetricValues = Omit<MachineMetrics, 'machineId' | 'machineNumber'>;

// OEE berbasis six big losses, murni dari OperationalData Layer 1. Durasi tiap
// event = selisih ke event berikutnya (event terakhir -> now). Status RUNNING
// adalah waktu produktif. MAINTENANCE adalah downtime terencana: dikeluarkan dari
// Planned Production Time (PPT), bukan loss availability. Status non-produktif lain
// membawa downtimeReason yang dipetakan ke sumbu Availability/Performance/Quality:
//   Availability loss: BREAKDOWN, SETUP_ADJUSTMENT
//   Performance loss : MINOR_STOP, REDUCED_SPEED
//   Quality loss     : STARTUP_REJECT, PRODUCTION_REJECT
// OEE = Availability x Performance x Quality. MTBF/MTTR dari kejadian BREAKDOWN.
export function computeMachineMetrics(
  events: OperationalEvent[],
  now: Date = new Date(),
): MetricValues {
  const sorted = [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());

  let totalMs = 0;
  let runningMs = 0;
  let maintenanceMs = 0;
  let breakdownCount = 0;
  const reason: Record<DowntimeReason, number> = {
    [DowntimeReason.BREAKDOWN]: 0,
    [DowntimeReason.SETUP_ADJUSTMENT]: 0,
    [DowntimeReason.MINOR_STOP]: 0,
    [DowntimeReason.REDUCED_SPEED]: 0,
    [DowntimeReason.STARTUP_REJECT]: 0,
    [DowntimeReason.PRODUCTION_REJECT]: 0,
  };

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i];
    const end = i < sorted.length - 1 ? sorted[i + 1].occurredAt.getTime() : now.getTime();
    const dur = Math.max(end - ev.occurredAt.getTime(), 0);
    totalMs += dur;

    if (ev.status === MachineOperationalStatus.RUNNING) {
      runningMs += dur;
    } else if (ev.status === MachineOperationalStatus.MAINTENANCE) {
      maintenanceMs += dur; // terencana, di luar PPT
    } else if (ev.downtimeReason) {
      reason[ev.downtimeReason] += dur;
      if (ev.downtimeReason === DowntimeReason.BREAKDOWN) breakdownCount += 1;
    }
  }

  const availLoss = reason[DowntimeReason.BREAKDOWN] + reason[DowntimeReason.SETUP_ADJUSTMENT];
  const perfLoss = reason[DowntimeReason.MINOR_STOP] + reason[DowntimeReason.REDUCED_SPEED];
  const qualLoss = reason[DowntimeReason.STARTUP_REJECT] + reason[DowntimeReason.PRODUCTION_REJECT];

  const ppt = Math.max(totalMs - maintenanceMs, 0);
  const operating = Math.max(ppt - availLoss, 0);
  const netOp = Math.max(operating - perfLoss, 0);

  const availability = ppt > 0 ? operating / ppt : 0;
  const performance = operating > 0 ? netOp / operating : 0;
  const quality = netOp > 0 ? (netOp - qualLoss) / netOp : 0;
  const oee = availability * performance * quality;
  const utilization = totalMs > 0 ? runningMs / totalMs : 0;

  const operatingHours = operating / HOUR_MS;
  const mtbfHours = breakdownCount > 0 ? operatingHours / breakdownCount : operatingHours;
  const mttrHours = breakdownCount > 0 ? reason[DowntimeReason.BREAKDOWN] / HOUR_MS / breakdownCount : 0;
  const totalDowntimeHours = (availLoss + maintenanceMs) / HOUR_MS;

  return {
    availability: round(availability * 100),
    performance: round(performance * 100),
    quality: round(quality * 100),
    oee: round(oee * 100),
    utilization: round(utilization * 100),
    mtbfHours: round(mtbfHours, 2),
    mttrHours: round(mttrHours, 2),
    totalDowntimeHours: round(totalDowntimeHours, 2),
  };
}
