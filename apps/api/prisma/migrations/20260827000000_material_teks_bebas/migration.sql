-- Nama material jadi teks bebas supaya pengguna bisa memasukkan material di luar
-- daftar kurasi lewat opsi "Lainnya". Daftar kurasi tetap ada di packages/shared
-- sebagai saran di UI, bukan lagi batasan di database.
--
-- Cast enum ke teks mempertahankan nilai lama apa adanya (PP tetap 'PP').
ALTER TABLE "Mold" ALTER COLUMN "planMaterialUtama" TYPE TEXT USING "planMaterialUtama"::text;
ALTER TABLE "LogPengiriman" ALTER COLUMN "materialName" TYPE TEXT USING "materialName"::text;
ALTER TABLE "LogPenerimaan" ALTER COLUMN "materialName" TYPE TEXT USING "materialName"::text;

DROP TYPE "MaterialType";
