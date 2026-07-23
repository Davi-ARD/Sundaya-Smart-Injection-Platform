import { Role } from '@mold-tracker/shared'

export const roleLabels: Record<Role, string> = {
  [Role.SUPER_ADMIN]: 'Super Admin',
  [Role.ADMIN_SUNDAYA]: 'Admin Sundaya',
  [Role.TEKNISI_SUNDAYA]: 'Teknisi Sundaya',
  [Role.MANAGER_PENYEWA]: 'Manager Penyewa',
  [Role.ADMIN_PENYEWA]: 'Admin Penyewa',
}

export const roleTagline: Record<Role, string> = {
  [Role.SUPER_ADMIN]: 'SISTEM',
  [Role.ADMIN_SUNDAYA]: 'SUNDAYA',
  [Role.TEKNISI_SUNDAYA]: 'SUNDAYA',
  [Role.MANAGER_PENYEWA]: 'PENYEWA',
  [Role.ADMIN_PENYEWA]: 'PENYEWA',
}

// Staf Sundaya (masuk lewat route internal) vs Penyewa (landing publik).
export const STAF_SUNDAYA_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.ADMIN_SUNDAYA,
  Role.TEKNISI_SUNDAYA,
]

export const isStafSundaya = (role: Role) => STAF_SUNDAYA_ROLES.includes(role)

// Tujuan redirect setelah login, berdasarkan role.
export const homePathForRole = (role: Role): string => {
  switch (role) {
    case Role.MANAGER_PENYEWA:
      return '/manager'
    case Role.ADMIN_PENYEWA:
      return '/job'
    default:
      return '/staff'
  }
}

export const initialsFromName = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('') || 'M'
