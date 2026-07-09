import type {
  AuthResponse,
  CreateOperatorRequest,
  CreateUserRequest,
  LoginRequest,
  RegisterRequest,
  Role,
  UpdateUserRequest,
  User,
} from '@mold-tracker/shared'

const API_BASE_URL = '/api'

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

export const api = {
  // Auth endpoints
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
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: authHeaders(token),
    })
    return handleResponse(response)
  },

  // Users (ADMIN)
  async listUsers(
    token: string | null,
    filters?: { role?: Role; isActive?: boolean },
  ): Promise<User[]> {
    const params = new URLSearchParams()
    if (filters?.role) params.set('role', filters.role)
    if (typeof filters?.isActive === 'boolean') params.set('isActive', String(filters.isActive))
    const query = params.toString()
    const response = await fetch(`${API_BASE_URL}/users${query ? `?${query}` : ''}`, {
      headers: authHeaders(token),
    })
    return handleResponse(response)
  },

  async createUser(token: string | null, request: CreateUserRequest): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(request),
    })
    return handleResponse(response)
  },

  async updateUser(
    token: string | null,
    userId: string,
    request: UpdateUserRequest,
  ): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(request),
    })
    return handleResponse(response)
  },

  async deactivateUser(token: string | null, userId: string): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/deactivate`, {
      method: 'PATCH',
      headers: authHeaders(token),
    })
    return handleResponse(response)
  },

  // Operators (PENYEWA)
  async listOperators(token: string | null): Promise<User[]> {
    const response = await fetch(`${API_BASE_URL}/operators`, {
      headers: authHeaders(token),
    })
    return handleResponse(response)
  },

  async createOperator(token: string | null, request: CreateOperatorRequest): Promise<User> {
    const response = await fetch(`${API_BASE_URL}/operators`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(request),
    })
    return handleResponse(response)
  },
}
