-- Hapus MachineStatus.DIAJUKAN: status ini tidak pernah tersimpan sendirian.
--
-- Satu-satunya jalur yang menulis status mesin dari TERSEDIA adalah assign job,
-- dan itu selalu memanggil machineWalk(TERSEDIA, DIAJUKAN, DIKONFIRMASI) dalam
-- satu langkah, yang hanya menulis hasil akhirnya (DIKONFIRMASI) ke database.
-- DIAJUKAN cuma singgah di dalam validasi rangkaian transisi, tidak pernah jadi
-- baris yang benar-benar dibaca balik. Keputusan Admin menyetujui booking dan
-- mengunci mesin terjadi dalam satu aksi, jadi tidak ada jeda status terpisah
-- untuk mesin seperti pada JobLifecycle.DIAJUKAN (yang memang berhenti nyata).

-- Jaga-jaga saja: tidak ada baris yang seharusnya berstatus ini, tapi bila ada
-- (mis. data manual), petakan ke DIKONFIRMASI sebelum nilai enumnya dibuang.
UPDATE "Machine" SET "status" = 'DIKONFIRMASI' WHERE "status" = 'DIAJUKAN';

CREATE TYPE "MachineStatus_new" AS ENUM ('TERSEDIA', 'DIKONFIRMASI', 'AKTIF', 'PENGECEKAN', 'MAINTENANCE');
ALTER TABLE "Machine" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Machine"
  ALTER COLUMN "status" TYPE "MachineStatus_new"
  USING ("status"::text::"MachineStatus_new");
DROP TYPE "MachineStatus";
ALTER TYPE "MachineStatus_new" RENAME TO "MachineStatus";
ALTER TABLE "Machine" ALTER COLUMN "status" SET DEFAULT 'TERSEDIA';
