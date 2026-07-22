import { CauseCategory } from '@mold-tracker/shared';
import { computeBatchMetrics } from './efficiency';

const THRESHOLD = 85;

describe('computeBatchMetrics', () => {
  it('targetOutput dihitung dari materialInputKg x standardRatio bila tidak diisi', () => {
    const m = computeBatchMetrics(
      { materialInputKg: 10, standardRatio: 5, actualOutput: 50 },
      THRESHOLD,
    );
    expect(m.targetOutput).toBe(50);
    expect(m.efficiency).toBe(100);
  });

  it('targetOutput manual dipakai apa adanya', () => {
    const m = computeBatchMetrics(
      { materialInputKg: 10, standardRatio: 5, targetOutput: 40, actualOutput: 20 },
      THRESHOLD,
    );
    expect(m.targetOutput).toBe(40);
    expect(m.efficiency).toBe(50);
  });

  it('flag saat efficiency di bawah ambang DAN penyebab KONDISI_MESIN', () => {
    const m = computeBatchMetrics(
      { materialInputKg: 10, standardRatio: 5, actualOutput: 40, causeCategory: CauseCategory.KONDISI_MESIN },
      THRESHOLD,
    );
    expect(m.efficiency).toBe(80);
    expect(m.flaggedMachineIssue).toBe(true);
  });

  it('tepat di ambang (85 persen) tidak di-flag', () => {
    const m = computeBatchMetrics(
      { materialInputKg: 100, standardRatio: 1, actualOutput: 85, causeCategory: CauseCategory.KONDISI_MESIN },
      THRESHOLD,
    );
    expect(m.efficiency).toBe(85);
    expect(m.flaggedMachineIssue).toBe(false);
  });

  it('di bawah ambang tapi penyebab bukan KONDISI_MESIN tidak di-flag', () => {
    const m = computeBatchMetrics(
      { materialInputKg: 10, standardRatio: 5, actualOutput: 40, causeCategory: CauseCategory.SETTING_OPERATOR },
      THRESHOLD,
    );
    expect(m.efficiency).toBe(80);
    expect(m.flaggedMachineIssue).toBe(false);
  });
});
