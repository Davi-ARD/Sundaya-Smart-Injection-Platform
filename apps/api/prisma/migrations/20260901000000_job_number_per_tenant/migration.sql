-- Nomor job jadi unik per perusahaan penyewa, bukan global. Tiap tenant punya
-- antrean sekuensnya sendiri sehingga jumlah booking tenant lain tidak terbaca
-- dari nomor job sendiri.
DROP INDEX "Job_jobNumber_key";

CREATE UNIQUE INDEX "Job_managerId_jobNumber_key" ON "Job"("managerId", "jobNumber");
