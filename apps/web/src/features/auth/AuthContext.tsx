import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  User,
} from '@mold-tracker/shared'
import { api } from '../../lib/api'
import { AuthContext, type AuthContextValue } from './authContextValue'

const SESSION_KEY = 'mold-tracker:auth-session'

const readSession = () => localStorage.getItem(SESSION_KEY)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() => readSession())
  const [user, setUser] = useState<User | null>(null)
  // Token tersimpan tapi belum diverifikasi ke /auth/me. ProtectedRoute harus
  // menunggu ini selesai sebelum menyimpulkan "belum login" pada reload/deep-link.
  const [isInitializing, setIsInitializing] = useState(() => Boolean(readSession()))

  useEffect(() => {
    if (!accessToken) {
      setUser(null)
      setIsInitializing(false)
      return
    }

    const fetchUser = async () => {
      try {
        const fetchedUser = await api.getMe(accessToken)
        setUser(fetchedUser)
      } catch (error) {
        console.error('Failed to fetch user:', error)
        localStorage.removeItem(SESSION_KEY)
        setAccessToken(null)
        setUser(null)
      } finally {
        setIsInitializing(false)
      }
    }

    void fetchUser()
  }, [accessToken])

  const persistSession = useCallback((response: AuthResponse) => {
    localStorage.setItem(SESSION_KEY, response.accessToken)
    setAccessToken(response.accessToken)
    setUser(response.user)
    return response
  }, [])

  const login = useCallback(
    (request: LoginRequest) => {
      return api.login(request).then(persistSession)
    },
    [persistSession],
  )

  const register = useCallback(
    (request: RegisterRequest) => {
      return api.register(request).then(persistSession)
    },
    [persistSession],
  )

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    setAccessToken(null)
    setUser(null)
  }, [])

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      user,
      isAuthenticated: Boolean(user && accessToken),
      isInitializing,
      login,
      register,
      logout,
      updateUser,
    }),
    [accessToken, user, isInitializing, login, register, logout, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
