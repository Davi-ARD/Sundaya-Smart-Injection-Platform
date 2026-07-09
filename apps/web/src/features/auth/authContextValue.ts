import { createContext, useContext } from 'react'
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

export type AuthContextValue = {
  accessToken: string | null
  user: User | null
  isAuthenticated: boolean
  login: (request: LoginRequest) => Promise<AuthResponse>
  register: (request: RegisterRequest) => Promise<AuthResponse>
  logout: () => void
  listUsers: (filters?: { role?: Role; isActive?: boolean }) => Promise<User[]>
  createUser: (request: CreateUserRequest) => Promise<User>
  updateUser: (userId: string, request: UpdateUserRequest) => Promise<User>
  deactivateUser: (userId: string) => Promise<User>
  listOperators: () => Promise<User[]>
  createOperator: (request: CreateOperatorRequest) => Promise<User>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export const useAuth = () => {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider.')
  }

  return context
}
