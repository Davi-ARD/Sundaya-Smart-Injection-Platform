// Tipe dan DTO bersama untuk apps/api (NestJS) dan apps/web (React).
// Sumber kebenaran tunggal. Jangan menduplikasi tipe ini di app mana pun.
// Enum di sini harus konsisten dengan schema Prisma di apps/api.

// =====================================================================
// ENUM
// =====================================================================

export enum Role {
  ADMIN = "ADMIN",
  PENYEDIA = "PENYEDIA",
  PENYEWA = "PENYEWA",
  OPERATOR = "OPERATOR",
}

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

export enum WarrantyStatus {
  AKTIF = "AKTIF",
  HABIS = "HABIS",
}

export enum RentalStatus {
  DIAJUKAN = "DIAJUKAN",
  DITOLAK = "DITOLAK",
  DIKONFIRMASI = "DIKONFIRMASI",
  DIKIRIM = "DIKIRIM",
  AKTIF = "AKTIF",
  SELESAI_SEWA = "SELESAI_SEWA",
  DIKEMBALIKAN = "DIKEMBALIKAN",
  SELESAI = "SELESAI",
}

export enum ExtensionStatus {
  DIAJUKAN = "DIAJUKAN",
  DITERIMA = "DITERIMA",
  DITOLAK = "DITOLAK",
}

export enum CauseCategory {
  SETTING_OPERATOR = "SETTING_OPERATOR",
  KUALITAS_MATERIAL = "KUALITAS_MATERIAL",
  KONDISI_MESIN = "KONDISI_MESIN",
  LAIN = "LAIN",
}

export enum ReviewStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export enum ConditionResult {
  BAIK = "BAIK",
  BUTUH_MAINTENANCE = "BUTUH_MAINTENANCE",
  RUSAK = "RUSAK",
}

// Tanggal dikirim sebagai ISO 8601 string di JSON.
export type ISODateString = string;

// =====================================================================
// ENTITAS (bentuk response)
// =====================================================================

export interface User {
  id: string;
  nama: string;
  email: string | null; // null untuk OPERATOR: login memakai nama, bukan email
  role: Role;
  parentId: string | null; // untuk OPERATOR: id PENYEWA induk
  isActive: boolean;
  avatarUrl: string | null; // path relatif, mis. /uploads/avatars/xxx.jpg
  createdAt: ISODateString;
}

export interface Machine {
  id: string;
  machineNumber: string;
  spesifikasi: string;
  standardRatio: number; // output standar per kg material
  status: MachineStatus;
  ownerId: string; // id PENYEDIA
  ownerNama?: string;
  warrantyStart: ISODateString;
  warrantyDurationMonths: number;
  warrantyEnd: ISODateString;
  warrantyStatus: WarrantyStatus;
  isArchived: boolean;
  createdAt: ISODateString;
}

export interface Rental {
  id: string;
  machineId: string;
  machineNumber?: string;
  penyewaId: string;
  penyediaId: string;
  status: RentalStatus;
  requestedDurationDays: number;
  destinationLocation: string;
  startDate: ISODateString | null;
  endDate: ISODateString | null;
  confirmedAt: ISODateString | null;
  shippedAt: ISODateString | null;
  receivedAt: ISODateString | null;
  returnedAt: ISODateString | null;
  rejectionReason: string | null;
  createdAt: ISODateString;
  // Diisi pada GET /rentals dan GET /rentals/:id agar Penyedia bisa memutuskan
  // perpanjangan tanpa endpoint daftar terpisah. Kosong pada respons aksi lain.
  extensions: RentalExtension[];
}

export interface RentalExtension {
  id: string;
  rentalId: string;
  additionalDays: number;
  status: ExtensionStatus;
  requestedAt: ISODateString;
  decidedAt: ISODateString | null;
}

export interface ProductionBatch {
  id: string;
  rentalId: string;
  machineId: string;
  operatorId: string;
  startAt: ISODateString;
  endAt: ISODateString;
  materialInputKg: number;
  targetOutput: number;
  actualOutput: number;
  rejectCount: number;
  causeCategory: CauseCategory | null; // null bila tidak ada selisih
  efficiency: number; // persen, (actualOutput / targetOutput) * 100
  flaggedMachineIssue: boolean;
  reviewStatus: ReviewStatus;
  createdAt: ISODateString;
}

export interface ConditionCheck {
  id: string;
  machineId: string;
  rentalId: string;
  checkedById: string; // id PENYEDIA
  result: ConditionResult;
  notes: string | null;
  checkedAt: ISODateString;
}

export interface MachineHistory {
  rentals: Rental[];
  conditionChecks: ConditionCheck[];
}

// =====================================================================
// DTO REQUEST
// =====================================================================

// Auth
export interface RegisterRequest {
  nama: string;
  email: string;
  password: string;
  role: Role.PENYEWA | Role.PENYEDIA;
}

export interface LoginRequest {
  // Email untuk ADMIN/PENYEDIA/PENYEWA, nama untuk OPERATOR (tidak punya email).
  identifier: string;
  password: string;
}

// User
export interface CreateUserRequest {
  nama: string;
  email?: string; // wajib kecuali role OPERATOR
  password: string;
  role: Role;
  parentId?: string;
}

export interface UpdateUserRequest {
  nama?: string;
  email?: string;
  role?: Role;
  isActive?: boolean;
}

// Edit profil sendiri (semua role). email diabaikan untuk OPERATOR (login by nama).
// Ganti password opsional: kalau newPassword diisi, currentPassword wajib untuk verifikasi.
export interface UpdateProfileRequest {
  nama?: string;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}

export interface CreateOperatorRequest {
  // Operator login memakai nama, bukan email. nama unik per role (lihat User).
  nama: string;
  password: string;
}

// Mesin
export interface CreateMachineRequest {
  machineNumber: string;
  spesifikasi: string;
  standardRatio: number;
  warrantyStart: ISODateString;
  warrantyDurationMonths: number;
}

export interface UpdateMachineRequest {
  spesifikasi?: string;
  standardRatio?: number;
  warrantyStart?: ISODateString;
  warrantyDurationMonths?: number;
}

// Sewa
export interface CreateRentalRequest {
  machineId: string;
  requestedDurationDays: number;
  destinationLocation: string;
  startDate: ISODateString;
}

export interface RejectRentalRequest {
  reason: string;
}

export interface CreateConditionCheckRequest {
  result: ConditionResult;
  notes?: string;
}

export interface CreateExtensionRequest {
  additionalDays: number;
}

export interface DecideExtensionRequest {
  decision: ExtensionStatus.DITERIMA | ExtensionStatus.DITOLAK;
}

// Produksi
export interface CreateBatchRequest {
  rentalId: string;
  startAt: ISODateString;
  endAt: ISODateString;
  materialInputKg: number;
  targetOutput?: number; // bila kosong, dihitung dari materialInputKg * standardRatio
  actualOutput: number;
  rejectCount: number;
  causeCategory?: CauseCategory;
}

export interface ReviewBatchRequest {
  reviewStatus: ReviewStatus.APPROVED | ReviewStatus.REJECTED;
}

// =====================================================================
// DTO RESPONSE (auth, agregasi, laporan)
// =====================================================================

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface OperatorEfficiency {
  operatorId: string;
  nama: string;
  avgEfficiency: number;
  batchCount: number;
}

export interface MachineEfficiency {
  machineId: string;
  machineNumber: string;
  avgEfficiency: number;
  batchCount: number;
  rejectRate: number; // persen
}

export interface MachineStatusCount {
  status: MachineStatus;
  count: number;
}

export interface PenyediaDashboard {
  machineStatusCounts: MachineStatusCount[];
  machineUtilization: {
    machineId: string;
    machineNumber: string;
    daysRented: number;
    daysIdle: number;
  }[];
  recurringIssueMachines: Machine[];
  warrantySummary: {
    machineId: string;
    machineNumber: string;
    warrantyStatus: WarrantyStatus;
    warrantyEnd: ISODateString;
  }[];
}

export interface PenyewaDashboard {
  activeRentals: {
    rentalId: string;
    machineNumber: string;
    endDate: ISODateString;
  }[];
  efficiencyByBatch: {
    batchId: string;
    machineNumber: string;
    date: ISODateString;
    efficiency: number;
  }[];
  rejectRate: number; // persen
  machineIssueBatches: ProductionBatch[];
}

export interface AdminDashboard {
  totalUsers: number;
  totalMachines: number;
  machineStatusCounts: MachineStatusCount[];
  totalActiveRentals: number;
  flaggedPendingReview: number;
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

// Ambang efisiensi default untuk flagging masalah mesin (persen).
// Backend boleh menimpa lewat env atau tabel setting.
export const DEFAULT_EFFICIENCY_THRESHOLD = 85;
