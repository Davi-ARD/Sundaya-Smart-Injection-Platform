import { CauseCategory } from '@mold-tracker/shared';

// Inti nilai sistem: hitung targetOutput, efficiency, dan penanda masalah mesin.
// Fungsi murni supaya mudah diuji terpisah dari DB.

export interface BatchMetricsInput {
  materialInputKg: number;
  standardRatio: number;
  targetOutput?: number; // bila diisi, dipakai apa adanya; bila tidak, dihitung
  actualOutput: number;
  causeCategory?: CauseCategory | null;
}

export interface BatchMetrics {
  targetOutput: number;
  efficiency: number; // persen
  flaggedMachineIssue: boolean;
}

export function computeBatchMetrics(input: BatchMetricsInput, threshold: number): BatchMetrics {
  const targetOutput = input.targetOutput ?? input.materialInputKg * input.standardRatio;
  // ponytail: targetOutput 0 hanya mungkin dari input manual 0; hindari bagi nol, anggap 0 persen.
  const efficiency = targetOutput === 0 ? 0 : (input.actualOutput / targetOutput) * 100;
  // Di bawah ambang (bukan tepat di ambang) DAN penyebab dinyatakan kondisi mesin.
  const flaggedMachineIssue =
    efficiency < threshold && input.causeCategory === CauseCategory.KONDISI_MESIN;
  return { targetOutput, efficiency, flaggedMachineIssue };
}
