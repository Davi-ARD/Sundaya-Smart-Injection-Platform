// Nomor job dibentuk dari kode cetakan yang dibooking supaya penyewa langsung tahu
// job itu tugas untuk cetakan mana, plus sekuens supaya tetap unik saat cetakan yang
// sama dibooking ulang setelah siklus lama selesai.
//
// JOB-MDA1-001            satu cetakan
// JOB-MDA1-MDA2-002       dua cetakan
// JOB-MDA1-MDA2-DLL-003   tiga cetakan atau lebih
export function buildJobNumber(kodeMolds: string[], seq: number): string {
  const bagian = kodeMolds.slice(0, 2).map((k) => k.replace(/[^A-Za-z0-9]/g, '').toUpperCase());
  if (kodeMolds.length > 2) bagian.push('DLL');
  return `JOB-${bagian.join('-')}-${String(seq).padStart(3, '0')}`;
}
