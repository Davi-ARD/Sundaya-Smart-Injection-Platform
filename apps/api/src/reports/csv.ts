// Util CSV kecil sesuai RFC 4180: kutip sel yang mengandung koma, kutip, atau newline.
// ponytail: cukup satu fungsi, tak perlu library CSV.
export function buildCsv(headers: string[], rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    const s = String(v ?? '');
    return /["\n\r,]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}
