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
import { mockAuthApi } from '../../lib/mockAuth'
import { AuthContext, type AuthContextValue } from './authContextValue'

const SESSION_KEY = 'mold-tracker:auth-session'

const readSession = () => localStorage.getItem(SESSION_KEY)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() => readSession())
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    if (!accessToken) {
      setUser(null)
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

  const requireUser = useCallback(() => {
    if (!user) {
      throw new Error('Sesi pengguna belum tersedia.')
    }

    return user
  }, [user])

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      user,
      isAuthenticated: Boolean(user && accessToken),
      login,
      register,
      logout,
      listUsers: (currentUser, filters) =>
        mockAuthApi.listUsers(currentUser, filters),
      createUser: (request) => mockAuthApi.createUser(requireUser(), request),
      updateUser: (userId, request) =>
        mockAuthApi.updateUser(requireUser(), userId, request),
      deactivateUser: (userId) =>
        mockAuthApi.deactivateUser(requireUser(), userId),
      listOperators: () => mockAuthApi.listOperators(requireUser()),
      createOperator: (request) =>
        mockAuthApi.createOperator(requireUser(), request),
    }),
    [accessToken, user, login, register, logout, requireUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
