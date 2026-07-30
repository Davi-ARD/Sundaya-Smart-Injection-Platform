// Tipe dan DTO bersama untuk apps/api (NestJS) dan apps/web (React).
// Sumber kebenaran tunggal. Jangan menduplikasi tipe ini di app mana pun.
// Enum di sini harus konsisten dengan schema Prisma di apps/api.
// Lihat docs/ssip-spec.md untuk konteks domain SSIP.

// =====================================================================
// ENUM
// =====================================================================

export enum Role {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN_SUNDAYA = "ADMIN_SUNDAYA",
  TEKNISI_SUNDAYA = "TEKNISI_SUNDAYA",
  MANAGER_PENYEWA = "MANAGER_PENYEWA",
  ADMIN_PENYEWA = "ADMIN_PENYEWA",
}

// Sumbu ketersediaan/rental mesin.
export enum MachineStatus {
  TERSEDIA = "TERSEDIA",
  DIAJUKAN = "DIAJUKAN",
  DIKONFIRMASI = "DIKONFIRMASI",
  DIKIRIM = "DIKIRIM",
  AKTIF = "AKTIF",
  SELESAI_SEWA = "SELESAI_SEWA",
  DIKEMBALIKAN = "DIKEMBALIKAN",
  PENGECEKAN = "PENGECEKAN",
  MAINTENANCE = "MAINTENANCE",
}

// Sumbu operasional realtime mesin (Layer 1). Teknisi hanya menginput SETUP dan
// RUNNING (lihat TEKNISI_INPUT_STATUS). STANDBY hanya status awal mesin baru,
// MAINTENANCE disetel otomatis oleh modul Maintenance.
export enum MachineOperationalStatus {
  STANDBY = "STANDBY",
  SETUP = "SETUP",
  RUNNING = "RUNNING",
  MAINTENANCE = "MAINTENANCE",
}

// Status yang boleh diinput Teknisi lewat POST /machines/:id/operational.
export const TEKNISI_INPUT_STATUS: MachineOperationalStatus[] = [
  MachineOperationalStatus.SETUP,
  MachineOperationalStatus.RUNNING,
];

export enum WarrantyStatus {
  AKTIF = "AKTIF",
  HABIS = "HABIS",
}

// Lifecycle booking/job (dulu RentalStatus).
export enum JobLifecycle {
  DIAJUKAN = "DIAJUKAN",
  DITOLAK = "DITOLAK",
  DIKONFIRMASI = "DIKONFIRMASI",
  DIKIRIM = "DIKIRIM",
  AKTIF = "AKTIF",
  SELESAI_SEWA = "SELESAI_SEWA",
  DIKEMBALIKAN = "DIKEMBALIKAN",
  SELESAI = "SELESAI",
}

// Status job untuk dashboard Sundaya (dihitung).
export enum JobStatus {
  ON_SCHEDULE = "ON_SCHEDULE",
  WARNING = "WARNING",
  CRITICAL = "CRITICAL",
  COMPLETED = "COMPLETED",
}

export enum ExtensionStatus {
  DIAJUKAN = "DIAJUKAN",
  DITERIMA = "DITERIMA",
  DITOLAK = "DITOLAK",
}

// Tracking fisik mold (6-state linear). Empat transisi pertama otomatis dari
// event domain, dua terakhir manual lewat tombol Admin Sundaya.
export enum MoldTrackingStatus {
  PLANNING = "PLANNING",
  DELIVERY = "DELIVERY",
  RECEIVED = "RECEIVED",
  PRODUCTION = "PRODUCTION",
  SEND_BACK = "SEND_BACK",
  COMPLETED = "COMPLETED",
}

// Jenis barang di Log Pengiriman (Manager) dan Log Penerimaan (Admin Sundaya).
export enum ItemPengiriman {
  MOLD = "MOLD",
  MATERIAL = "MATERIAL",
}

// Progress molding (Layer 2).
export enum ProgressMolding {
  PLANNING = "PLANNING",
  ONGOING = "ONGOING",
  SUDAH_DIPRODUKSI = "SUDAH_DIPRODUKSI",
}

// Jenis event Log Produksi (Layer 2 timeline).
export enum LogProduksiEventType {
  MATERIAL_DATANG = "MATERIAL_DATANG",
  PRODUKSI_HARIAN = "PRODUKSI_HARIAN",
  PROGRESS_MOLDING = "PROGRESS_MOLDING",
}

export enum MaintenanceType {
  PREVENTIVE = "PREVENTIVE",
  CORRECTIVE = "CORRECTIVE",
}

export enum MaintenanceStatus {
  TERJADWAL = "TERJADWAL",
  BERLANGSUNG = "BERLANGSUNG",
  SELESAI = "SELESAI",
}

// Tanggal dikirim sebagai ISO 8601 string di JSON.
export type ISODateString = string;

// =====================================================================
// ENTITAS (bentuk response)
// =====================================================================

export interface User {
  id: string;
  nama: string;
  email: string;
  role: Role;
  parentId: string | null; // ADMIN_PENYEWA: id MANAGER_PENYEWA induk
  companyName: string | null; // untuk MANAGER_PENYEWA
  isActive: boolean;
  avatarUrl: string | null;
  createdAt: ISODateString;
}

export interface Machine {
  id: string;
  machineNumber: string;
  spesifikasi: string;
  tonaseTon: number;
  status: MachineStatus; // sumbu ketersediaan
  operationalStatus: MachineOperationalStatus; // sumbu realtime Layer 1
  // Status sebelum maintenance, dipakai memulihkan mesin saat maintenance selesai.
  statusBeforeMaintenance: MachineOperationalStatus | null;
  ownerId: string; // user sistem Sundaya
  warrantyStart: ISODateString;
  warrantyDurationMonths: number;
  warrantyEnd: ISODateString;
  warrantyStatus: WarrantyStatus;
  isArchived: boolean;
  createdAt: ISODateString;
}

export interface Mold {
  id: string;
  kodeMold: string;
  namaProduk: string;
  cavity: number;
  tonaseTon: number;
  deskripsi: string | null;
  managerId: string;
  jobId: string | null; // null berarti belum dibooking
  trackingStatus: MoldTrackingStatus;
  planMaterialUtama: string | null;
  estimasiKg: number | null;
  targetOutput: number | null;
  createdAt: ISODateString;
}

export interface MoldTrackingEvent {
  id: string;
  moldId: string;
  status: MoldTrackingStatus;
  at: ISODateString;
  byId: string;
}

// Ringkasan satu cetakan di dalam booking. Plan dan tonase dibaca dari Mold, tidak
// diduplikasi di Job, supaya tidak ada dua sumber angka rencana.
export interface JobMold {
  moldId: string;
  kodeMold: string;
  namaProduk: string;
  cavity: number;
  tonaseTon: number;
  trackingStatus: MoldTrackingStatus;
  planMaterialUtama: string | null;
  estimasiKg: number | null;
  targetOutput: number | null;
}

// Mesin yang dipinjamkan ke satu booking. Mesin tidak dipasangkan ke cetakan
// tertentu: penyewa bebas menjalankan cetakan mana pun di mesin mana pun selama
// tonasenya cukup. Pasangan cetakan-mesin yang benar-benar dipakai dicatat per
// event di Log Produksi.
export interface JobMachine {
  machineId: string;
  machineNumber: string;
  tonaseTon: number;
  status: MachineStatus;
}

export interface Job {
  id: string;
  jobNumber: string;
  // Satu booking memuat satu atau lebih cetakan dan beberapa mesin sekaligus.
  molds: JobMold[];
  machines: JobMachine[];
  // Jumlah mesin yang diminta penyewa; Admin Sundaya memenuhinya bertahap.
  requestedMachineCount: number;
  managerId: string;
  companyName?: string | null; // perusahaan penyewa, untuk tampilan staf Sundaya
  assignedById: string | null;
  lifecycle: JobLifecycle;
  jobStatus: JobStatus;
  requestedDurationDays: number;
  startDate: ISODateString | null;
  endDate: ISODateString | null;
  catatan: string | null;
  confirmedAt: ISODateString | null;
  shippedAt: ISODateString | null;
  receivedAt: ISODateString | null;
  returnedAt: ISODateString | null;
  rejectionReason: string | null;
  createdAt: ISODateString;
  extensions: RentalExtension[];
}

export interface RentalExtension {
  id: string;
  jobId: string;
  additionalDays: number;
  status: ExtensionStatus;
  requestedAt: ISODateString;
  decidedAt: ISODateString | null;
}

export interface LogProduksi {
  id: string;
  jobId: string;
  // Cetakan yang dicatat: batas output dan material ditetapkan per cetakan.
  moldId: string;
  kodeMold?: string;
  // Mesin yang dipakai cetakan itu pada event ini. Wajib untuk PRODUKSI_HARIAN dan
  // PROGRESS_MOLDING; null pada MATERIAL_DATANG yang tidak menyentuh mesin.
  machineId: string | null;
  machineNumber?: string | null;
  eventType: LogProduksiEventType;
  occurredAt: ISODateString;
  byId: string;
  catatan: string | null;
  // MATERIAL_DATANG
  materialName: string | null;
  jumlahKg: number | null;
  noSuratJalan: string | null;
  // PRODUKSI_HARIAN. materialUsedKg = material yang dipakai hari itu; sisa kuota
  // dihitung sistem dari Mold.estimasiKg minus akumulasi terpakai.
  goodProduct: number | null;
  rejectCount: number | null;
  materialUsedKg: number | null;
  // PROGRESS_MOLDING
  progressMolding: ProgressMolding | null;
  keteranganProgress: string | null;
  createdAt: ISODateString;
}

export interface OperationalData {
  id: string;
  machineId: string;
  status: MachineOperationalStatus;
  // Durasi satu siklus molding penuh, kanonik dalam detik. Form memakai
  // hmsToSeconds untuk merakitnya dari input jam + menit + detik.
  cycleTimeSec: number | null;
  occurredAt: ISODateString;
  byId: string;
  catatan: string | null;
  createdAt: ISODateString;
}

export interface Maintenance {
  id: string;
  machineId: string;
  type: MaintenanceType;
  status: MaintenanceStatus;
  scheduledAt: ISODateString;
  // Diisi saat transisi status. Durasi pada maintenance CORRECTIVE jadi sumber
  // MTBF dan MTTR di dashboard Sundaya.
  startedAt: ISODateString | null;
  completedAt: ISODateString | null;
  notes: string | null;
  byId: string;
  createdAt: ISODateString;
}

// Log Pengiriman (Manager Penyewa): kapan mold atau material akan dikirim ke
// Sundaya. Log informasi, bukan pembanding rencana vs aktual.
export interface LogPengiriman {
  id: string;
  jobId: string;
  jobNumber?: string;
  // Wajib untuk item MOLD: booking bisa memuat beberapa cetakan.
  moldId: string | null;
  kodeMold?: string;
  item: ItemPengiriman;
  rencanaKirim: ISODateString;
  // Khusus item MATERIAL.
  materialName: string | null;
  jumlahKg: number | null;
  noSuratJalan: string | null;
  catatan: string | null;
  byId: string;
  createdAt: ISODateString;
}

// Log Penerimaan (Admin Sundaya): konfirmasi mold atau material tiba di Sundaya.
export interface LogPenerimaan {
  id: string;
  jobId: string;
  jobNumber?: string;
  // Wajib untuk item MOLD: booking bisa memuat beberapa cetakan.
  moldId: string | null;
  kodeMold?: string;
  item: ItemPengiriman;
  diterimaAt: ISODateString;
  // Khusus item MATERIAL.
  materialName: string | null;
  jumlahKg: number | null;
  noSuratJalan: string | null;
  kondisi: string | null;
  catatan: string | null;
  byId: string;
  createdAt: ISODateString;
}

// =====================================================================
// DTO REQUEST
// =====================================================================

// Auth. Register publik hanya untuk MANAGER_PENYEWA (tenant root).
export interface RegisterRequest {
  nama: string;
  email: string;
  password: string;
  companyName: string;
}

export interface LoginRequest {
  identifier: string; // email
  password: string;
}

// User / hierarki tenant
export interface CreateStaffRequest {
  nama: string;
  email: string;
  password: string;
  role: Role.SUPER_ADMIN | Role.ADMIN_SUNDAYA | Role.TEKNISI_SUNDAYA;
}

// Admin Penyewa dibuat oleh Manager (child). parentId diisi dari user Manager.
export interface CreatePenyewaAdminRequest {
  nama: string;
  email: string;
  password: string;
}

export interface UpdateUserRequest {
  nama?: string;
  email?: string;
  isActive?: boolean;
}

export interface UpdateProfileRequest {
  nama?: string;
  email?: string;
  companyName?: string;
  currentPassword?: string;
  newPassword?: string;
}

// Mesin
// machineNumber digenerate server (pola IM-001 berurutan), tidak diinput.
export interface CreateMachineRequest {
  spesifikasi: string;
  tonaseTon: number;
  warrantyStart: ISODateString;
  warrantyDurationMonths: number;
}

export interface UpdateMachineRequest {
  spesifikasi?: string;
  tonaseTon?: number;
  warrantyStart?: ISODateString;
  warrantyDurationMonths?: number;
}

// Operational Data (Layer 1, Teknisi). Append event, bukan update mesin langsung.
// status hanya SETUP atau RUNNING (TEKNISI_INPUT_STATUS); MAINTENANCE lewat modul
// Maintenance. cycleTimeSec dikirim dalam detik (UI merakitnya dari jam+menit+detik).
export interface CreateOperationalDataRequest {
  status: MachineOperationalStatus;
  cycleTimeSec?: number;
  occurredAt: ISODateString;
  catatan?: string;
}

// Maintenance
export interface CreateMaintenanceRequest {
  machineId: string;
  type: MaintenanceType;
  scheduledAt: ISODateString;
  notes?: string;
}

export interface UpdateMaintenanceStatusRequest {
  status: MaintenanceStatus;
  notes?: string;
}

// Cetakan (Mold)
export interface CreateMoldRequest {
  kodeMold: string;
  namaProduk: string;
  cavity: number;
  tonaseTon: number;
  deskripsi?: string;
  planMaterialUtama?: string;
  estimasiKg?: number;
  targetOutput?: number;
}

export interface UpdateMoldRequest {
  namaProduk?: string;
  cavity?: number;
  tonaseTon?: number;
  deskripsi?: string;
  planMaterialUtama?: string;
  estimasiKg?: number;
  targetOutput?: number;
}

// Transisi tracking mold (service-guarded, hanya state berikutnya yang sah).
export interface UpdateMoldTrackingRequest {
  status: MoldTrackingStatus;
}

// Booking / Job. Manager memilih satu atau lebih cetakan plus jumlah mesin yang
// ingin dipinjam, tanpa menentukan mesin mana. Plan material dan target output tidak
// ditanyakan lagi: sudah diisi saat merancang cetakan. Rencana kirim dicatat terpisah
// lewat Log Pengiriman.
export interface CreateJobRequest {
  moldIds: string[];
  requestedMachineCount: number;
  requestedDurationDays: number;
  startDate: ISODateString;
  catatan?: string;
}

// Admin Sundaya menambah satu mesin ke booking. Mesin pertama sekaligus menyetujui
// booking; mesin berikutnya ditambahkan lewat endpoint yang sama.
export interface AssignJobRequest {
  machineId: string;
}

export interface RejectJobRequest {
  reason: string;
}

export interface CreateExtensionRequest {
  additionalDays: number;
}

export interface DecideExtensionRequest {
  decision: ExtensionStatus.DITERIMA | ExtensionStatus.DITOLAK;
}

// Log Produksi (Layer 2, Admin Penyewa). Append-only.
export interface CreateLogProduksiRequest {
  moldId: string;
  // Wajib untuk PRODUKSI_HARIAN dan PROGRESS_MOLDING: log harus menyebut cetakan itu
  // dipakai di mesin mana. Mesin harus salah satu mesin booking dan tonasenya cukup.
  machineId?: string;
  eventType: LogProduksiEventType;
  occurredAt: ISODateString;
  catatan?: string;
  // MATERIAL_DATANG
  materialName?: string;
  jumlahKg?: number;
  noSuratJalan?: string;
  // PRODUKSI_HARIAN
  goodProduct?: number;
  rejectCount?: number;
  materialUsedKg?: number;
  // PROGRESS_MOLDING
  progressMolding?: ProgressMolding;
  keteranganProgress?: string;
}

// Log Pengiriman (Manager Penyewa). Item MOLD memindahkan tracking ke DELIVERY.
// Field material hanya untuk item MATERIAL.
export interface CreateLogPengirimanRequest {
  jobId: string;
  moldId?: string; // wajib untuk item MOLD
  item: ItemPengiriman;
  rencanaKirim: ISODateString;
  materialName?: string;
  jumlahKg?: number;
  noSuratJalan?: string;
  catatan?: string;
}

// Log Penerimaan (Admin Sundaya). Item MOLD memindahkan tracking ke RECEIVED.
export interface CreateLogPenerimaanRequest {
  jobId: string;
  moldId?: string; // wajib untuk item MOLD
  item: ItemPengiriman;
  diterimaAt: ISODateString;
  materialName?: string;
  jumlahKg?: number;
  noSuratJalan?: string;
  kondisi?: string;
  catatan?: string;
}

// =====================================================================
// DTO RESPONSE (auth, agregasi, laporan)
// =====================================================================

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface MachineStatusCount {
  status: MachineOperationalStatus;
  count: number;
}

// Metrik pemantauan mesin (dihitung dari OperationalData Layer 1).
export interface MachineMetrics {
  machineId: string;
  machineNumber: string;
  availability: number; // persen
  performance: number; // persen
  quality: number; // persen
  oee: number; // persen
  utilization: number; // persen
  mtbfHours: number;
  mttrHours: number;
  totalDowntimeHours: number;
}

// Pemantauan sewa berjalan (Layer 1, dashboard Sundaya). Dipakai Admin Sundaya
// untuk mengecek berkala apakah ada penyewa yang minta perpanjangan sewa.
export interface RentalMonitoring {
  shortestRemainingDays: number | null; // sisa sewa terpendek dari job aktif
  pendingExtensions: number; // pengajuan perpanjangan berstatus DIAJUKAN
  overdueJobs: number; // job aktif yang endDate-nya sudah lewat
}

export interface SundayaDashboard {
  runningMachines: number;
  totalMachines: number;
  avgOee: number;
  utilization: number;
  activeBookings: number;
  operationalStatusCounts: MachineStatusCount[];
  rentalMonitoring: RentalMonitoring;
}

// Baris antrean perpanjangan untuk tab Booking Sundaya. Extension digabung
// konteks job/penyewa supaya Admin bisa memutuskan tanpa membuka job satu-satu.
export interface ExtensionRequestRow {
  extensionId: string;
  jobId: string;
  jobNumber: string;
  companyName: string | null;
  moldKode: string | null;
  // Gabungan nomor mesin booking ini (bisa lebih dari satu), sama gaya dengan moldKode.
  machineNumber: string | null;
  additionalDays: number;
  status: ExtensionStatus;
  requestedAt: ISODateString;
  endDate: ISODateString | null;
  sisaHariSewa: number | null;
}

export interface ManagerDashboard {
  moldsAtSundaya: number;
  ongoing: number;
  totalGoodProduct: number;
  avgAchievement: number;
}

// Dashboard job di lokasi (Admin Penyewa). Satu baris per cetakan pada booking aktif.
// Mesin ditampilkan sebagai daftar: cetakan mana pun boleh dijalankan di mesin mana
// pun dalam booking itu, jadi tidak ada satu mesin milik satu cetakan.
export interface JobDashboard {
  jobId: string;
  jobNumber: string;
  lifecycle: JobLifecycle;
  machineNumbers: string[];
  moldId: string;
  moldKode: string;
  moldProduk: string;
  moldCavity: number;
  moldTonaseTon: number;
  progressMolding: ProgressMolding | null; // progress molding terakhir
  targetOutput: number | null;
  achievement: number; // persen good product terhadap target
  totalGoodProduct: number;
  totalReject: number;
  // Kuota material: plan dari cetakan, terpakai dari akumulasi Log Produksi.
  planMaterialKg: number | null;
  materialUsedKg: number;
  materialRemainingKg: number | null; // plan minus terpakai
  endDate: ISODateString | null;
  sisaHariSewa: number | null; // sisa masa sewa mesin, negatif berarti lewat
  latestLogAt: ISODateString | null;
}

// Log utama Admin Penyewa: seluruh event dari semua job tenant dalam satu
// timeline (LogProduksi apa adanya plus konteks job dan cetakannya).
export interface JobLogEntry extends LogProduksi {
  jobNumber: string;
  moldKode: string;
  // Pasangan cetakan-mesin pada event ini, supaya timeline bisa menyebut
  // "cetakan X di mesin Y" secara spesifik.
  machineNumber: string | null;
}

// Perkembangan plan mold (Manager Penyewa). Satu baris per cetakan, menggabung
// tracking fisik, job/mesin, capaian produksi, dan realisasi material. Dipakai
// tabel dashboard Manager, panel detail cepat, dan detail cetakan.
export interface MoldPlanRow {
  moldId: string;
  kodeMold: string;
  namaProduk: string;
  cavity: number;
  tonaseTon: number;
  trackingStatus: MoldTrackingStatus;
  jobId: string | null;
  jobNumber: string | null;
  lifecycle: JobLifecycle | null;
  machineNumbers: string[]; // mesin booking cetakan ini, kosong bila belum ada
  progressMolding: ProgressMolding | null;
  targetOutput: number | null;
  totalGoodProduct: number;
  totalReject: number;
  achievement: number; // persen
  rejectRate: number; // persen dari total output
  sisaHariSewa: number | null;
  etaHari: number | null; // perkiraan hari sampai target tercapai
  planMaterialUtama: string | null;
  // Kuota material: plan (estimasiKg) adalah batas keras, terpakai adalah akumulasi
  // materialUsedKg dari Log Produksi, sisa adalah selisihnya.
  estimasiKg: number | null;
  materialUsedKg: number;
  materialRemainingKg: number | null;
  materialUsagePercent: number | null; // terpakai terhadap plan
  endDate: ISODateString | null;
}

// Cycle production per cetakan (Manager Penyewa): capaian produksi terhadap target
// dan pemakaian material terhadap kuota, plus rekap harian. Semua turunan Log Produksi.
export interface MoldCycleProduction {
  moldId: string;
  kodeMold: string;
  namaProduk: string;
  targetOutput: number | null;
  totalGoodProduct: number;
  totalReject: number;
  totalOutput: number; // good + reject
  achievement: number; // persen good terhadap target
  rejectRate: number; // persen reject terhadap total output
  remainingTarget: number | null; // target minus good
  planMaterialUtama: string | null;
  planMaterialKg: number | null;
  materialUsedKg: number;
  materialRemainingKg: number | null;
  materialUsagePercent: number | null;
  harian: DailyCycleEntry[]; // terbaru dulu
}

export interface DailyCycleEntry {
  occurredAt: ISODateString;
  goodProduct: number;
  rejectCount: number;
  materialUsedKg: number | null;
  catatan: string | null;
}

// Cycle production dikelompokkan per booking, satu blok per job di dashboard Manager.
export interface JobCycleProduction {
  jobId: string;
  jobNumber: string;
  lifecycle: JobLifecycle;
  machineNumbers: string[];
  requestedMachineCount: number;
  sisaHariSewa: number | null;
  molds: MoldCycleProduction[];
}

// =====================================================================
// NOTIFIKASI
// =====================================================================

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: ISODateString;
}

// =====================================================================
// KONSTANTA
// =====================================================================

// Warning jika sisa sewa <= 3 hari, Critical jika <= 1 hari (aturan rental SSIP).
export const RENTAL_WARNING_DAYS = 3;
export const RENTAL_CRITICAL_DAYS = 1;

// Peta transisi tracking fisik mold (6-state linear). Sumber kebenaran tunggal
// dipakai apps/api (validasi) dan apps/web (tombol yang tampil).
export const MOLD_TRACKING_FLOW: Record<MoldTrackingStatus, MoldTrackingStatus[]> = {
  [MoldTrackingStatus.PLANNING]: [MoldTrackingStatus.DELIVERY],
  [MoldTrackingStatus.DELIVERY]: [MoldTrackingStatus.RECEIVED],
  [MoldTrackingStatus.RECEIVED]: [MoldTrackingStatus.PRODUCTION],
  [MoldTrackingStatus.PRODUCTION]: [MoldTrackingStatus.SEND_BACK],
  [MoldTrackingStatus.SEND_BACK]: [MoldTrackingStatus.COMPLETED],
  [MoldTrackingStatus.COMPLETED]: [],
};

// Status mold yang tidak digerakkan event domain melainkan tombol Admin Sundaya
// di tab Mold Tracking. Sisanya otomatis (lihat PROJECT_CONTEXT.md bagian 5a).
export const MOLD_MANUAL_TRANSITIONS: MoldTrackingStatus[] = [
  MoldTrackingStatus.SEND_BACK,
  MoldTrackingStatus.COMPLETED,
];

// Cycle time disimpan kanonik dalam detik tapi diinput sebagai jam + menit + detik.
export function hmsToSeconds(jam: number, menit: number, detik: number): number {
  return jam * 3600 + menit * 60 + detik;
}

// Cycle time ideal per mesin belum jadi master data; Performance dihitung dari
// rasio cycle time ideal terhadap rata-rata aktual. ponytail: satu konstanta env
// belum perlu, angka ini cuma dipakai satu tempat (metrics OEE).
export const IDEAL_CYCLE_TIME_SEC = 30;
