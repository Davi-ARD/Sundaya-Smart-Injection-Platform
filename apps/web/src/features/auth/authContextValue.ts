import { createContext, useContext } from 'react'
import type { AuthResponse, LoginRequest, RegisterRequest, User } from '@mold-tracker/shared'

export type AuthContextValue = {
  accessToken: string | null
  user: User | null
  isAuthenticated: boolean
  // true selama token tersimpan sedang diverifikasi ke /auth/me (reload/deep-link).
  isInitializing: boolean
  // remember=false menyimpan token di sessionStorage (hilang saat tab ditutup)
  // alih-alih localStorage.
  login: (request: LoginRequest, remember?: boolean) => Promise<AuthResponse>
  register: (request: RegisterRequest) => Promise<AuthResponse>
  logout: () => void
  // Perbarui user tersimpan setelah edit profil, tanpa fetch ulang.
  updateUser: (user: User) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export const useAuth = () => {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider.')
  }

  return context
}
