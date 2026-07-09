import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Role } from '@mold-tracker/shared'
import { useAuth } from './authContextValue'

export function ProtectedRoute({
  allowedRoles,
  children,
}: {
  allowedRoles?: Role[]
  children?: ReactNode
}) {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children ?? <Outlet />
}
