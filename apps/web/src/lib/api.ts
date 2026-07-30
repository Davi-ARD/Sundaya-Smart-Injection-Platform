import type {
  AppNotification,
  AssignJobRequest,
  AuthResponse,
  CreateExtensionRequest,
  CreateJobRequest,
  DecideExtensionRequest,
  ExtensionRequestRow,
  JobLogEntry,
  MoldPlanRow,
  RentalExtension,
  CreateLogPenerimaanRequest,
  CreateLogPengirimanRequest,
  CreateLogProduksiRequest,
  CreateMachineRequest,
  CreateMaintenanceRequest,
  CreateMoldRequest,
  CreateOperationalDataRequest,
  CreatePenyewaAdminRequest,
  CreateStaffRequest,
  Job,
  JobCycleProduction,
  JobDashboard,
  JobLifecycle,
  LogPenerimaan,
  LogPengiriman,
  LogProduksi,
  Machine,
  MachineMetrics,
  MachineStatus,
  Maintenance,
  MaintenanceStatus,
  ManagerDashboard,
  Mold,
  RejectJobRequest,
  Role,
  SundayaDashboard,
  UpdateMachineRequest,
  UpdateMaintenanceStatusRequest,
  UpdateMoldRequest,
  UpdateMoldTrackingRequest,
  UpdateProfileRequest,
  UpdateUserRequest,
  User,
  LoginRequest,
  RegisterRequest,
} from '@mold-tracker/shared'

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new ApiError(
      response.status,
      errorData.message || `HTTP ${response.status}: ${response.statusText}`,
    )
  }
  if (response.status === 204) return undefined
  return response.json()
}

const authHeaders = (token: string | null): Record<string, string> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

// Wrapper request generik untuk endpoint yang butuh token.
const request = async <T>(
  method: string,
  path: string,
  token: string | null,
  body?: unknown,
): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: authHeaders(token),
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return handleResponse(response)
}

const buildQuery = (params: Record<string, string | boolean | undefined>) => {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export const api = {
  // ===================== Auth (publik) =====================
  async register(body: RegisterRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return handleResponse(response)
  },

  async login(body: LoginRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return handleResponse(response)
  },

  async getMe(token: string | null): Promise<User> {
    return request<User>('GET', '/auth/me', token)
  },

  async updateProfile(token: string | null, body: UpdateProfileRequest): Promise<User> {
    return request<User>('PATCH', '/auth/me', token, body)
  },

  async uploadAvatar(token: string | null, file: File): Promise<User> {
    const formData = new FormData()
    formData.append('avatar', file)
    const response = await fetch(`${API_BASE_URL}/auth/me/avatar`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    })
    return handleResponse(response)
  },

  // ===================== Users (SUPER_ADMIN) =====================
  async listUsers(
    token: string | null,
    filters?: { role?: Role; isActive?: boolean },
  ): Promise<User[]> {
    const query = buildQuery({ role: filters?.role, isActive: filters?.isActive })
    return request<User[]>('GET', `/users${query}`, token)
  },

  async createStaff(token: string | null, body: CreateStaffRequest): Promise<User> {
    return request<User>('POST', '/users', token, body)
  },

  async updateUser(token: string | null, userId: string, body: UpdateUserRequest): Promise<User> {
    return request<User>('PATCH', `/users/${userId}`, token, body)
  },

  async deactivateUser(token: string | null, userId: string): Promise<User> {
    return request<User>('PATCH', `/users/${userId}/deactivate`, token)
  },

  async deleteUser(token: string | null, userId: string): Promise<void> {
    return request<void>('DELETE', `/users/${userId}`, token)
  },

  // ===================== Admin Penyewa (MANAGER_PENYEWA) =====================
  async listPenyewaAdmins(token: string | null): Promise<User[]> {
    return request<User[]>('GET', '/penyewa-admins', token)
  },

  async createPenyewaAdmin(token: string | null, body: CreatePenyewaAdminRequest): Promise<User> {
    return request<User>('POST', '/penyewa-admins', token, body)
  },

  async deactivatePenyewaAdmin(token: string | null, id: string): Promise<User> {
    return request<User>('PATCH', `/penyewa-admins/${id}/deactivate`, token)
  },

  async deletePenyewaAdmin(token: string | null, id: string): Promise<void> {
    return request<void>('DELETE', `/penyewa-admins/${id}`, token)
  },

  // ===================== Cetakan (Mold) =====================
  async listMolds(token: string | null): Promise<Mold[]> {
    return request<Mold[]>('GET', '/molds', token)
  },

  async getMold(token: string | null, id: string): Promise<Mold> {
    return request<Mold>('GET', `/molds/${id}`, token)
  },

  async createMold(token: string | null, body: CreateMoldRequest): Promise<Mold> {
    return request<Mold>('POST', '/molds', token, body)
  },

  async updateMold(token: string | null, id: string, body: UpdateMoldRequest): Promise<Mold> {
    return request<Mold>('PATCH', `/molds/${id}`, token, body)
  },

  async updateMoldTracking(
    token: string | null,
    id: string,
    body: UpdateMoldTrackingRequest,
  ): Promise<Mold> {
    return request<Mold>('PATCH', `/molds/${id}/tracking`, token, body)
  },

  // ===================== Job (Booking + lifecycle) =====================
  async createJob(token: string | null, body: CreateJobRequest): Promise<Job> {
    return request<Job>('POST', '/jobs', token, body)
  },

  async listJobs(token: string | null, filters?: { lifecycle?: JobLifecycle }): Promise<Job[]> {
    const query = buildQuery({ lifecycle: filters?.lifecycle })
    return request<Job[]>('GET', `/jobs${query}`, token)
  },

  async getJob(token: string | null, id: string): Promise<Job> {
    return request<Job>('GET', `/jobs/${id}`, token)
  },

  async assignJob(token: string | null, id: string, body: AssignJobRequest): Promise<Job> {
    return request<Job>('PATCH', `/jobs/${id}/assign`, token, body)
  },

  async rejectJob(token: string | null, id: string, body: RejectJobRequest): Promise<Job> {
    return request<Job>('PATCH', `/jobs/${id}/reject`, token, body)
  },

  async shipJob(token: string | null, id: string): Promise<Job> {
    return request<Job>('PATCH', `/jobs/${id}/ship`, token)
  },

  async activateJob(token: string | null, id: string): Promise<Job> {
    return request<Job>('PATCH', `/jobs/${id}/activate`, token)
  },

  async returnJob(token: string | null, id: string): Promise<Job> {
    return request<Job>('PATCH', `/jobs/${id}/return`, token)
  },

  async collectJob(token: string | null, id: string): Promise<Job> {
    return request<Job>('PATCH', `/jobs/${id}/collect`, token)
  },

  async completeJob(token: string | null, id: string): Promise<Job> {
    return request<Job>('PATCH', `/jobs/${id}/complete`, token)
  },

  // ===================== Perpanjangan sewa =====================
  async createExtension(
    token: string | null,
    jobId: string,
    body: CreateExtensionRequest,
  ): Promise<RentalExtension> {
    return request<RentalExtension>('POST', `/jobs/${jobId}/extensions`, token, body)
  },

  async listExtensions(token: string | null): Promise<ExtensionRequestRow[]> {
    return request<ExtensionRequestRow[]>('GET', '/jobs/extensions', token)
  },

  async requestExtension(
    token: string | null,
    jobId: string,
    body: CreateExtensionRequest,
  ): Promise<RentalExtension> {
    return request<RentalExtension>('POST', `/jobs/${jobId}/extensions`, token, body)
  },

  async decideExtension(
    token: string | null,
    extensionId: string,
    body: DecideExtensionRequest,
  ): Promise<RentalExtension> {
    return request<RentalExtension>(
      'PATCH',
      `/jobs/extensions/${extensionId}/decide`,
      token,
      body,
    )
  },

  // ===================== Log Produksi (Layer 2) =====================
  async listLogs(token: string | null, jobId: string): Promise<LogProduksi[]> {
    return request<LogProduksi[]>('GET', `/jobs/${jobId}/logs`, token)
  },

  async createLog(
    token: string | null,
    jobId: string,
    body: CreateLogProduksiRequest,
  ): Promise<LogProduksi> {
    return request<LogProduksi>('POST', `/jobs/${jobId}/logs`, token, body)
  },

  // ===================== Log Pengiriman (Manager Penyewa) =====================
  async listPengiriman(token: string | null, jobId?: string): Promise<LogPengiriman[]> {
    const query = buildQuery({ jobId })
    return request<LogPengiriman[]>('GET', `/pengiriman${query}`, token)
  },

  async createPengiriman(
    token: string | null,
    body: CreateLogPengirimanRequest,
  ): Promise<LogPengiriman> {
    return request<LogPengiriman>('POST', '/pengiriman', token, body)
  },

  // ===================== Log Penerimaan (Admin Sundaya) =====================
  async listPenerimaan(token: string | null, jobId?: string): Promise<LogPenerimaan[]> {
    const query = buildQuery({ jobId })
    return request<LogPenerimaan[]>('GET', `/penerimaan${query}`, token)
  },

  async createPenerimaan(
    token: string | null,
    body: CreateLogPenerimaanRequest,
  ): Promise<LogPenerimaan> {
    return request<LogPenerimaan>('POST', '/penerimaan', token, body)
  },

  // ===================== Dashboard =====================
  async getSundayaDashboard(token: string | null): Promise<SundayaDashboard> {
    return request<SundayaDashboard>('GET', '/dashboard/sundaya', token)
  },

  async getManagerDashboard(token: string | null): Promise<ManagerDashboard> {
    return request<ManagerDashboard>('GET', '/dashboard/manager', token)
  },

  async getCycleProduction(token: string | null): Promise<JobCycleProduction[]> {
    return request<JobCycleProduction[]>('GET', '/dashboard/manager/cycle-production', token)
  },

  async getJobDashboard(token: string | null): Promise<JobDashboard[]> {
    return request<JobDashboard[]>('GET', '/dashboard/job', token)
  },

  // Log utama Admin Penyewa: seluruh event dari semua job tenant.
  async getJobLogs(token: string | null): Promise<JobLogEntry[]> {
    return request<JobLogEntry[]>('GET', '/dashboard/job/logs', token)
  },

  // Perkembangan plan mold Manager: dipakai dashboard dan detail cetakan.
  async getMoldPlan(token: string | null): Promise<MoldPlanRow[]> {
    return request<MoldPlanRow[]>('GET', '/dashboard/manager/mold-plan', token)
  },

  async getMachineMetrics(token: string | null, machineId: string): Promise<MachineMetrics> {
    return request<MachineMetrics>('GET', `/machines/${machineId}/metrics`, token)
  },

  // ===================== Mesin (staf Sundaya) =====================
  async listMachines(
    token: string | null,
    filters?: { status?: MachineStatus; archived?: boolean },
  ): Promise<Machine[]> {
    const query = buildQuery({ status: filters?.status, archived: filters?.archived })
    return request<Machine[]>('GET', `/machines${query}`, token)
  },

  async listOperationalMachines(token: string | null): Promise<Machine[]> {
    return request<Machine[]>('GET', '/machines/operational', token)
  },

  async getMachine(token: string | null, id: string): Promise<Machine> {
    return request<Machine>('GET', `/machines/${id}`, token)
  },

  async createMachine(token: string | null, body: CreateMachineRequest): Promise<Machine> {
    return request<Machine>('POST', '/machines', token, body)
  },

  async updateMachine(
    token: string | null,
    id: string,
    body: UpdateMachineRequest,
  ): Promise<Machine> {
    return request<Machine>('PATCH', `/machines/${id}`, token, body)
  },

  async archiveMachine(token: string | null, id: string): Promise<Machine> {
    return request<Machine>('PATCH', `/machines/${id}/archive`, token)
  },

  async unarchiveMachine(token: string | null, id: string): Promise<Machine> {
    return request<Machine>('PATCH', `/machines/${id}/unarchive`, token)
  },

  async addOperationalData(
    token: string | null,
    machineId: string,
    body: CreateOperationalDataRequest,
  ): Promise<Machine> {
    return request<Machine>('POST', `/machines/${machineId}/operational`, token, body)
  },

  // ===================== Maintenance =====================
  async listMaintenance(
    token: string | null,
    filters?: { machineId?: string; status?: MaintenanceStatus },
  ): Promise<Maintenance[]> {
    const query = buildQuery({ machineId: filters?.machineId, status: filters?.status })
    return request<Maintenance[]>('GET', `/maintenance${query}`, token)
  },

  async createMaintenance(token: string | null, body: CreateMaintenanceRequest): Promise<Maintenance> {
    return request<Maintenance>('POST', '/maintenance', token, body)
  },

  async updateMaintenanceStatus(
    token: string | null,
    id: string,
    body: UpdateMaintenanceStatusRequest,
  ): Promise<Maintenance> {
    return request<Maintenance>('PATCH', `/maintenance/${id}/status`, token, body)
  },

  // ===================== Notifikasi =====================
  async listNotifications(
    token: string | null,
    filters?: { unreadOnly?: boolean },
  ): Promise<AppNotification[]> {
    const query = buildQuery({ unreadOnly: filters?.unreadOnly })
    return request<AppNotification[]>('GET', `/notifications${query}`, token)
  },

  async markNotificationRead(token: string | null, id: string): Promise<AppNotification> {
    return request<AppNotification>('PATCH', `/notifications/${id}/read`, token)
  },

  async markAllNotificationsRead(token: string | null): Promise<void> {
    return request<void>('PATCH', '/notifications/read-all', token)
  },
}
