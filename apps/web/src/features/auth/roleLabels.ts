import { Role } from '@mold-tracker/shared'

export const roleLabels: Record<Role, string> = {
  [Role.ADMIN]: 'Admin',
  [Role.PENYEDIA]: 'Penyedia',
  [Role.PENYEWA]: 'Penyewa',
  [Role.OPERATOR]: 'Operator',
}

export const roleTagline: Record<Role, string> = {
  [Role.ADMIN]: 'FULL ACCESS',
  [Role.PENYEDIA]: 'PENYEDIA',
  [Role.PENYEWA]: 'PENYEWA',
  [Role.OPERATOR]: 'OPERATOR',
}

export const initialsFromName = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('') || 'M'
