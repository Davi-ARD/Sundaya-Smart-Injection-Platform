import { buildJobNumber } from './job-number';

describe('buildJobNumber', () => {
  it('menyebut kode cetakan tunggal plus sekuens', () => {
    expect(buildJobNumber(['MD-A1'], 1)).toBe('JOB-MDA1-001');
  });

  it('menyebut dua cetakan sekaligus', () => {
    expect(buildJobNumber(['MD-A1', 'MD-A2'], 12)).toBe('JOB-MDA1-MDA2-012');
  });

  it('meringkas cetakan ketiga dan seterusnya dengan DLL', () => {
    expect(buildJobNumber(['MD-A1', 'MD-A2', 'MD-A3', 'MD-A4'], 345)).toBe(
      'JOB-MDA1-MDA2-DLL-345',
    );
  });

  it('membuang karakter non-alfanumerik dari kode cetakan', () => {
    expect(buildJobNumber(['md/b 7'], 8)).toBe('JOB-MDB7-008');
  });
});
