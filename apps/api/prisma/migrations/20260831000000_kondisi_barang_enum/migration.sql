-- Kondisi barang jadi pilihan tetap tiga tingkat. Sebelumnya teks bebas, jadi
-- nilai lama dipetakan dulu sebelum kolomnya diubah tipe.
CREATE TYPE "KondisiBarang" AS ENUM ('BAIK', 'CUKUP_BAIK', 'TIDAK_BAIK');

-- Pemetaan nilai lama. Semua teks yang tersimpan sejauh ini bermakna barang
-- dalam keadaan baik ('baik', 'Baik', 'tidak ada kerusakan'), jadi dipetakan ke
-- BAIK. Teks yang menandakan masalah dipetakan ke tingkat yang sesuai supaya
-- riwayat tidak berubah makna; sisanya dikosongkan agar tidak menebak.
ALTER TABLE "LogPenerimaan" ADD COLUMN "kondisi_baru" "KondisiBarang";

UPDATE "LogPenerimaan"
SET "kondisi_baru" = CASE
  WHEN "kondisi" IS NULL THEN NULL
  WHEN lower("kondisi") LIKE '%tidak baik%'
    OR lower("kondisi") LIKE '%reject%'
    OR lower("kondisi") LIKE '%rusak berat%' THEN 'TIDAK_BAIK'::"KondisiBarang"
  WHEN lower("kondisi") LIKE '%cukup baik%'
    OR lower("kondisi") LIKE '%rusak ringan%'
    OR lower("kondisi") LIKE '%cacat%' THEN 'CUKUP_BAIK'::"KondisiBarang"
  WHEN lower("kondisi") LIKE '%baik%'
    OR lower("kondisi") LIKE '%tidak ada kerusakan%' THEN 'BAIK'::"KondisiBarang"
  ELSE NULL
END;

ALTER TABLE "LogPenerimaan" DROP COLUMN "kondisi";
ALTER TABLE "LogPenerimaan" RENAME COLUMN "kondisi_baru" TO "kondisi";
