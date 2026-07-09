import { createContext, useContext } from 'react'
import type {
  AuthResponse,
  CreateOperatorRequest,
  CreateUserRequest,
  LoginRequest,
  RegisterRequest,
  UpdateUserRequest,
  User,
} from '@mold-tracker/shared'
import { mockAuthApi } from '../../lib/mockAuth'

export type AuthContextValue = {
  accessToken: string | null
  user: User | null
  isAuthenticated: boolean
  login: (request: LoginRequest) => Promise<AuthResponse>
  register: (request: RegisterRequest) => Promise<AuthResponse>
  logout: () => void
  listUsers: typeof mockAuthApi.listUsers
  createUser: (request: CreateUserRequest) => User
  updateUser: (userId: string, request: UpdateUserRequest) => User
  deactivateUser: (userId: string) => User
  listOperators: () => User[]
  createOperator: (request: CreateOperatorRequest) => User
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export const useAuth = () => {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider.')
  }

  return context
}
