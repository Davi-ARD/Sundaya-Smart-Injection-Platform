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

// Sumbu operasional realtime mesin (Layer 1).
export enum MachineOperationalStatus {
  RUNNING = "RUNNING",
  SETUP = "SETUP",
  STANDBY = "STANDBY",
  BREAKDOWN = "BREAKDOWN",
  MAINTENANCE = "MAINTENANCE",
}

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

// Tracking fisik mold (10-state linear).
export enum MoldTrackingStatus {
  PLANNING = "PLANNING",
  READY_DELIVERY = "READY_DELIVERY",
  DELIVERY = "DELIVERY",
  RECEIVED = "RECEIVED",
  WAITING_PRODUCTION = "WAITING_PRODUCTION",
  ON_MACHINE = "ON_MACHINE",
  PRODUCTION = "PRODUCTION",
  REPAIR = "REPAIR",
  SEND_BACK = "SEND_BACK",
  COMPLETED = "COMPLETED",
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

// Reason code downtime (six big losses).
export enum DowntimeReason {
  BREAKDOWN = "BREAKDOWN",
  SETUP_ADJUSTMENT = "SETUP_ADJUSTMENT",
  MINOR_STOP = "MINOR_STOP",
  REDUCED_SPEED = "REDUCED_SPEED",
  STARTUP_REJECT = "STARTUP_REJECT",
  PRODUCTION_REJECT = "PRODUCTION_REJECT",
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

// Status pengiriman (dihitung di view Log Pengiriman, tidak disimpan di DB).
export enum DeliveryStatus {
  DIRENCANAKAN = "DIRENCANAKAN",
  DIKIRIM = "DIKIRIM",
  TIBA_ONTIME = "TIBA_ONTIME",
  TIBA_TERLAMBAT = "TIBA_TERLAMBAT",
  BELUM_TIBA = "BELUM_TIBA",
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
  standardRatio: number; // output standar per kg material
  status: MachineStatus; // sumbu ketersediaan
  operationalStatus: MachineOperationalStatus; // sumbu realtime Layer 1
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

export interface Job {
  id: string;
  jobNumber: string;
  moldId: string;
  managerId: string;
  machineId: string | null; // null sebelum di-assign Admin Sundaya
  machineNumber?: string;
  assignedById: string | null;
  lifecycle: JobLifecycle;
  jobStatus: JobStatus;
  requestedDurationDays: number;
  destinationLocation: string;
  startDate: ISODateString | null;
  endDate: ISODateString | null;
  planMaterialUtama: string | null;
  estimasiMaterialKg: number | null;
  materialTambahan: string | null;
  targetOutput: number | null;
  rencanaKirimMold: ISODateString | null;
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
  eventType: LogProduksiEventType;
  occurredAt: ISODateString;
  byId: string;
  catatan: string | null;
  // MATERIAL_DATANG
  materialName: string | null;
  jumlahKg: number | null;
  noSuratJalan: string | null;
  // PRODUKSI_HARIAN
  goodProduct: number | null;
  rejectCount: number | null;
  materialRemainingKg: number | null;
  // PROGRESS_MOLDING
  progressMolding: ProgressMolding | null;
  keteranganProgress: string | null;
  createdAt: ISODateString;
}

export interface OperationalData {
  id: string;
  machineId: string;
  status: MachineOperationalStatus;
  downtimeReason: DowntimeReason | null;
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
  notes: string | null;
  byId: string;
  createdAt: ISODateString;
}

// Baris Log Pengiriman (dihitung, tanpa tabel). Rencana dari Job, aktual dari
// LogProduksi (MATERIAL_DATANG) dan MoldTrackingEvent (RECEIVED).
export interface DeliveryRow {
  jobId: string;
  jobNumber: string;
  item: string;
  sumberRencana: string; // mis. "Booking BK-1042"
  rencanaTiba: ISODateString | null;
  aktualTiba: ISODateString | null;
  selisihHari: number | null;
  status: DeliveryStatus;
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
export interface CreateMachineRequest {
  machineNumber: string;
  spesifikasi: string;
  tonaseTon: number;
  standardRatio: number;
  warrantyStart: ISODateString;
  warrantyDurationMonths: number;
}

export interface UpdateMachineRequest {
  spesifikasi?: string;
  tonaseTon?: number;
  standardRatio?: number;
  warrantyStart?: ISODateString;
  warrantyDurationMonths?: number;
}

// Operational Data (Layer 1, Teknisi). Append event, bukan update mesin langsung.
export interface CreateOperationalDataRequest {
  status: MachineOperationalStatus;
  downtimeReason?: DowntimeReason;
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

// Booking / Job. Manager mengajukan tanpa memilih mesin.
export interface CreateJobRequest {
  moldId: string;
  requestedDurationDays: number;
  destinationLocation: string;
  startDate: ISODateString;
  planMaterialUtama?: string;
  estimasiMaterialKg?: number;
  materialTambahan?: string;
  targetOutput?: number;
  rencanaKirimMold?: ISODateString;
}

// Admin Sundaya approve dan assign mesin sekaligus.
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
  materialRemainingKg?: number;
  // PROGRESS_MOLDING
  progressMolding?: ProgressMolding;
  keteranganProgress?: string;
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

export interface SundayaDashboard {
  runningMachines: number;
  totalMachines: number;
  avgOee: number;
  utilization: number;
  activeBookings: number;
  operationalStatusCounts: MachineStatusCount[];
}

export interface ManagerDashboard {
  moldsAtSundaya: number;
  ongoing: number;
  totalGoodProduct: number;
  avgAchievement: number;
  onTimeDeliveryRate: number; // persen, dari Log Pengiriman
}

// Dashboard job di lokasi (Admin Penyewa). Ringkasan per job aktif tenant.
export interface JobDashboard {
  jobId: string;
  jobNumber: string;
  lifecycle: JobLifecycle;
  machineNumber: string | null;
  progressMolding: ProgressMolding | null; // progress molding terakhir
  totalGoodProduct: number;
  totalReject: number;
  materialRemainingKg: number | null; // sisa material terakhir dilaporkan
  latestLogAt: ISODateString | null;
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

// Peta transisi tracking fisik mold (10-state linear, cabang REPAIR). Sumber
// kebenaran tunggal dipakai apps/api (validasi + guard) dan apps/web (tombol
// transisi yang tampil). Transisi hanya lewat sisi terdaftar di sini.
export const MOLD_TRACKING_FLOW: Record<MoldTrackingStatus, MoldTrackingStatus[]> = {
  [MoldTrackingStatus.PLANNING]: [MoldTrackingStatus.READY_DELIVERY],
  [MoldTrackingStatus.READY_DELIVERY]: [MoldTrackingStatus.DELIVERY],
  [MoldTrackingStatus.DELIVERY]: [MoldTrackingStatus.RECEIVED],
  [MoldTrackingStatus.RECEIVED]: [MoldTrackingStatus.WAITING_PRODUCTION],
  [MoldTrackingStatus.WAITING_PRODUCTION]: [MoldTrackingStatus.ON_MACHINE],
  [MoldTrackingStatus.ON_MACHINE]: [MoldTrackingStatus.PRODUCTION],
  [MoldTrackingStatus.PRODUCTION]: [MoldTrackingStatus.REPAIR, MoldTrackingStatus.SEND_BACK],
  [MoldTrackingStatus.REPAIR]: [MoldTrackingStatus.ON_MACHINE],
  [MoldTrackingStatus.SEND_BACK]: [MoldTrackingStatus.COMPLETED],
  [MoldTrackingStatus.COMPLETED]: [],
};

// Subset transisi setup/produksi yang boleh dijalankan TEKNISI_SUNDAYA. Sisanya
// (delivery, received, send back, completed) khusus ADMIN_SUNDAYA.
export const MOLD_TEKNISI_ALLOWED: ReadonlyArray<readonly [MoldTrackingStatus, MoldTrackingStatus]> = [
  [MoldTrackingStatus.WAITING_PRODUCTION, MoldTrackingStatus.ON_MACHINE],
  [MoldTrackingStatus.ON_MACHINE, MoldTrackingStatus.PRODUCTION],
  [MoldTrackingStatus.PRODUCTION, MoldTrackingStatus.REPAIR],
  [MoldTrackingStatus.REPAIR, MoldTrackingStatus.ON_MACHINE],
];
