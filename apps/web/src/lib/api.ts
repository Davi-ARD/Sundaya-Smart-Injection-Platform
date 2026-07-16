import type {
  AdminDashboard,
  AppNotification,
  AuthResponse,
  ConditionCheck,
  CreateBatchRequest,
  CreateConditionCheckRequest,
  CreateExtensionRequest,
  CreateMachineRequest,
  CreateOperatorRequest,
  CreateRentalRequest,
  CreateUserRequest,
  DecideExtensionRequest,
  LoginRequest,
  Machine,
  MachineEfficiency,
  MachineHistory,
  MachineStatus,
  OperatorEfficiency,
  PenyediaDashboard,
  PenyewaDashboard,
  ProductionBatch,
  RegisterRequest,
  RejectRentalRequest,
  Rental,
  RentalExtension,
  RentalStatus,
  ReviewBatchRequest,
  Role,
  UpdateMachineRequest,
  UpdateProfileRequest,
  UpdateUserRequest,
  User,
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
  if (response.status === 204) {
    return undefined
  }
  return response.json()
}

// Header JSON + Authorization Bearer bila token ada.
const authHeaders = (token: string | null): Record<string, string> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

// Wrapper request generik untuk endpoint yang butuh token (semua kecuali auth publik).
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
    if (value !== undefined) {
      search.set(key, String(value))
    }
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export const api = {
  // ===================================================================
  // Auth
  // ===================================================================
  async register(request: RegisterRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    return handleResponse(response)
  },

  async login(request: LoginRequest): Promise<AuthResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    return handleResponse(response)
  },

  async getMe(token: string | null): Promise<User> {
    return request<User>('GET', '/auth/me', token)
  },

  async updateProfile(token: string | null, body: UpdateProfileRequest): Promise<User> {
    return request<User>('PATCH', '/auth/me', token, body)
  },

  // multipart/form-data: jangan pakai wrapper request() (itu selalu set Content-Type JSON).
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

  // ===================================================================
  // Users (ADMIN)
  // ===================================================================
  async listUsers(
    token: string | null,
    filters?: { role?: Role; isActive?: boolean },
  ): Promise<User[]> {
    const query = buildQuery({ role: filters?.role, isActive: filters?.isActive })
    return request<User[]>('GET', `/users${query}`, token)
  },

  async createUser(token: string | null, body: CreateUserRequest): Promise<User> {
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

  // ===================================================================
  // Operators (PENYEWA)
  // ===================================================================
  async listOperators(token: string | null): Promise<User[]> {
    return request<User[]>('GET', '/operators', token)
  },

  async createOperator(token: string | null, body: CreateOperatorRequest): Promise<User> {
    return request<User>('POST', '/operators', token, body)
  },

  async deleteOperator(token: string | null, operatorId: string): Promise<void> {
    return request<void>('DELETE', `/operators/${operatorId}`, token)
  },

  // ===================================================================
  // Mesin
  // ===================================================================
  async listMachines(
    token: string | null,
    filters?: { status?: MachineStatus; archived?: boolean },
  ): Promise<Machine[]> {
    const query = buildQuery({ status: filters?.status, archived: filters?.archived })
    return request<Machine[]>('GET', `/machines${query}`, token)
  },

  async getMachine(token: string | null, machineId: string): Promise<Machine> {
    return request<Machine>('GET', `/machines/${machineId}`, token)
  },

  async createMachine(token: string | null, body: CreateMachineRequest): Promise<Machine> {
    return request<Machine>('POST', '/machines', token, body)
  },

  async updateMachine(
    token: string | null,
    machineId: string,
    body: UpdateMachineRequest,
  ): Promise<Machine> {
    return request<Machine>('PATCH', `/machines/${machineId}`, token, body)
  },

  async archiveMachine(token: string | null, machineId: string): Promise<Machine> {
    return request<Machine>('PATCH', `/machines/${machineId}/archive`, token)
  },

  async unarchiveMachine(token: string | null, machineId: string): Promise<Machine> {
    return request<Machine>('PATCH', `/machines/${machineId}/unarchive`, token)
  },

  async completeMachineMaintenance(token: string | null, machineId: string): Promise<Machine> {
    return request<Machine>('PATCH', `/machines/${machineId}/complete-maintenance`, token)
  },

  async getMachineHistory(token: string | null, machineId: string): Promise<MachineHistory> {
    return request<MachineHistory>('GET', `/machines/${machineId}/history`, token)
  },

  // ===================================================================
  // Sewa
  // ===================================================================
  async createRental(token: string | null, body: CreateRentalRequest): Promise<Rental> {
    return request<Rental>('POST', '/rentals', token, body)
  },

  async listRentals(token: string | null, filters?: { status?: RentalStatus }): Promise<Rental[]> {
    const query = buildQuery({ status: filters?.status })
    return request<Rental[]>('GET', `/rentals${query}`, token)
  },

  async getRental(token: string | null, rentalId: string): Promise<Rental> {
    return request<Rental>('GET', `/rentals/${rentalId}`, token)
  },

  async confirmRental(token: string | null, rentalId: string): Promise<Rental> {
    return request<Rental>('PATCH', `/rentals/${rentalId}/confirm`, token)
  },

  async rejectRental(token: string | null, rentalId: string, body: RejectRentalRequest): Promise<Rental> {
    return request<Rental>('PATCH', `/rentals/${rentalId}/reject`, token, body)
  },

  async shipRental(token: string | null, rentalId: string): Promise<Rental> {
    return request<Rental>('PATCH', `/rentals/${rentalId}/ship`, token)
  },

  async receiveRental(token: string | null, rentalId: string): Promise<Rental> {
    return request<Rental>('PATCH', `/rentals/${rentalId}/receive`, token)
  },

  async returnRental(token: string | null, rentalId: string): Promise<Rental> {
    return request<Rental>('PATCH', `/rentals/${rentalId}/return`, token)
  },

  async createConditionCheck(
    token: string | null,
    rentalId: string,
    body: CreateConditionCheckRequest,
  ): Promise<ConditionCheck> {
    return request<ConditionCheck>('POST', `/rentals/${rentalId}/condition-check`, token, body)
  },

  async createExtension(
    token: string | null,
    rentalId: string,
    body: CreateExtensionRequest,
  ): Promise<RentalExtension> {
    return request<RentalExtension>('POST', `/rentals/${rentalId}/extensions`, token, body)
  },

  async decideExtension(
    token: string | null,
    extensionId: string,
    body: DecideExtensionRequest,
  ): Promise<RentalExtension> {
    return request<RentalExtension>('PATCH', `/extensions/${extensionId}/decide`, token, body)
  },

  // ===================================================================
  // Produksi
  // ===================================================================
  async createBatch(token: string | null, body: CreateBatchRequest): Promise<ProductionBatch> {
    return request<ProductionBatch>('POST', '/batches', token, body)
  },

  async listBatches(
    token: string | null,
    filters?: { rentalId?: string; machineId?: string; operatorId?: string; flagged?: boolean },
  ): Promise<ProductionBatch[]> {
    const query = buildQuery({
      rentalId: filters?.rentalId,
      machineId: filters?.machineId,
      operatorId: filters?.operatorId,
      flagged: filters?.flagged,
    })
    return request<ProductionBatch[]>('GET', `/batches${query}`, token)
  },

  async getBatch(token: string | null, batchId: string): Promise<ProductionBatch> {
    return request<ProductionBatch>('GET', `/batches/${batchId}`, token)
  },

  async reviewBatch(
    token: string | null,
    batchId: string,
    body: ReviewBatchRequest,
  ): Promise<ProductionBatch> {
    return request<ProductionBatch>('PATCH', `/batches/${batchId}/review`, token, body)
  },

  async getOperatorEfficiency(
    token: string | null,
    filters?: { rentalId?: string; machineId?: string },
  ): Promise<OperatorEfficiency[]> {
    const query = buildQuery({ rentalId: filters?.rentalId, machineId: filters?.machineId })
    return request<OperatorEfficiency[]>('GET', `/batches/efficiency/by-operator${query}`, token)
  },

  async getMachineEfficiency(token: string | null): Promise<MachineEfficiency[]> {
    return request<MachineEfficiency[]>('GET', '/batches/efficiency/by-machine', token)
  },

  // ===================================================================
  // Laporan dan Dashboard
  // ===================================================================
  async getPenyediaDashboard(token: string | null): Promise<PenyediaDashboard> {
    return request<PenyediaDashboard>('GET', '/dashboard/penyedia', token)
  },

  async getPenyewaDashboard(token: string | null): Promise<PenyewaDashboard> {
    return request<PenyewaDashboard>('GET', '/dashboard/penyewa', token)
  },

  async getAdminDashboard(token: string | null): Promise<AdminDashboard> {
    return request<AdminDashboard>('GET', '/dashboard/admin', token)
  },

  async getMachineIssueReports(
    token: string | null,
    filters?: { rentalId?: string; machineId?: string },
  ): Promise<ProductionBatch[]> {
    const query = buildQuery({ rentalId: filters?.rentalId, machineId: filters?.machineId })
    return request<ProductionBatch[]>('GET', `/reports/machine-issues${query}`, token)
  },

  // Endpoint export butuh header Authorization, jadi tidak bisa dipakai sebagai <a href> polos
  // (browser tidak mengirim bearer token pada navigasi biasa) — fetch manual lalu blob download.
  async downloadMachineIssueReport(
    token: string | null,
    filters: { format: 'csv' | 'pdf'; rentalId?: string; machineId?: string },
  ): Promise<Blob> {
    const query = buildQuery({
      format: filters.format,
      rentalId: filters.rentalId,
      machineId: filters.machineId,
    })
    const response = await fetch(`${API_BASE_URL}/reports/machine-issues/export${query}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new ApiError(
        response.status,
        errorData.message || `HTTP ${response.status}: ${response.statusText}`,
      )
    }
    return response.blob()
  },

  // ===================================================================
  // Notifikasi
  // ===================================================================
  async listNotifications(token: string | null, filters?: { unreadOnly?: boolean }): Promise<AppNotification[]> {
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
