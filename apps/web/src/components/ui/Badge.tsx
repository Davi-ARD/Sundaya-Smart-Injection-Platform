import type { ReactNode } from 'react'
import {
  ExtensionStatus,
  JobLifecycle,
  MachineOperationalStatus,
  MachineStatus,
  MaintenanceStatus,
  MoldTrackingStatus,
  ProgressMolding,
  WarrantyStatus,
} from '@mold-tracker/shared'

export type BadgeTone = 'emerald' | 'amber' | 'rose' | 'slate' | 'brand' | 'sky'

const toneClasses: Record<BadgeTone, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/15',
  rose: 'bg-rose-50 text-rose-700 ring-rose-600/15',
  slate: 'bg-slate-100 text-slate-600 ring-slate-600/10',
  brand: 'bg-brand-50 text-brand-700 ring-brand-600/15',
  sky: 'bg-sky-50 text-sky-700 ring-sky-600/15',
}

const dotClasses: Record<BadgeTone, string> = {
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  slate: 'bg-slate-400',
  brand: 'bg-brand-500',
  sky: 'bg-sky-500',
}

export function Badge({ tone = 'slate', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={[
        'inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset',
        toneClasses[tone],
      ].join(' ')}
    >
      <span className={['h-1.5 w-1.5 shrink-0 rounded-full', dotClasses[tone]].join(' ')} />
      {children}
    </span>
  )
}

// --- Mesin (ketersediaan/rental) ---
const machineStatusTone: Record<MachineStatus, BadgeTone> = {
  [MachineStatus.TERSEDIA]: 'emerald',
  [MachineStatus.DIKONFIRMASI]: 'sky',
  [MachineStatus.AKTIF]: 'brand',
  [MachineStatus.PENGECEKAN]: 'amber',
  [MachineStatus.MAINTENANCE]: 'rose',
}

// Label menyebut kondisi mesin di lantai Sundaya, bukan posisi pengiriman:
// mesin tidak pernah keluar dari sini.
export const machineStatusLabel: Record<MachineStatus, string> = {
  [MachineStatus.TERSEDIA]: 'Tersedia',
  [MachineStatus.DIKONFIRMASI]: 'Disiapkan untuk booking',
  [MachineStatus.AKTIF]: 'Dipakai booking',
  [MachineStatus.PENGECEKAN]: 'Pengecekan',
  [MachineStatus.MAINTENANCE]: 'Maintenance',
}

export function MachineStatusBadge({ status }: { status: MachineStatus }) {
  return <Badge tone={machineStatusTone[status]}>{machineStatusLabel[status]}</Badge>
}

// --- Mesin (realtime Layer 1) ---
const machineOperationalTone: Record<MachineOperationalStatus, BadgeTone> = {
  [MachineOperationalStatus.RUNNING]: 'emerald',
  [MachineOperationalStatus.SETUP]: 'sky',
  [MachineOperationalStatus.STANDBY]: 'slate',
  [MachineOperationalStatus.MAINTENANCE]: 'amber',
}

export const machineOperationalStatusLabel: Record<MachineOperationalStatus, string> = {
  [MachineOperationalStatus.RUNNING]: 'Running',
  [MachineOperationalStatus.SETUP]: 'Setup',
  [MachineOperationalStatus.STANDBY]: 'Standby',
  [MachineOperationalStatus.MAINTENANCE]: 'Maintenance',
}

export function MachineOperationalStatusBadge({ status }: { status: MachineOperationalStatus }) {
  return <Badge tone={machineOperationalTone[status]}>{machineOperationalStatusLabel[status]}</Badge>
}

// --- Maintenance (SSIP) ---
const maintenanceStatusTone: Record<MaintenanceStatus, BadgeTone> = {
  [MaintenanceStatus.TERJADWAL]: 'amber',
  [MaintenanceStatus.BERLANGSUNG]: 'sky',
  [MaintenanceStatus.SELESAI]: 'emerald',
}

export const maintenanceStatusLabel: Record<MaintenanceStatus, string> = {
  [MaintenanceStatus.TERJADWAL]: 'Terjadwal',
  [MaintenanceStatus.BERLANGSUNG]: 'Berlangsung',
  [MaintenanceStatus.SELESAI]: 'Selesai',
}

export function MaintenanceStatusBadge({ status }: { status: MaintenanceStatus }) {
  return <Badge tone={maintenanceStatusTone[status]}>{maintenanceStatusLabel[status]}</Badge>
}

// --- Job lifecycle (booking) ---
const jobLifecycleTone: Record<JobLifecycle, BadgeTone> = {
  [JobLifecycle.DIAJUKAN]: 'amber',
  [JobLifecycle.DITOLAK]: 'rose',
  [JobLifecycle.DIKONFIRMASI]: 'sky',
  [JobLifecycle.AKTIF]: 'brand',
  [JobLifecycle.SELESAI]: 'emerald',
}

// Label menjelaskan posisi booking dalam alur, supaya pembaca tahu apa artinya
// tanpa harus hafal urutan status.
export const jobLifecycleLabel: Record<JobLifecycle, string> = {
  [JobLifecycle.DIAJUKAN]: 'Menunggu approval',
  [JobLifecycle.DITOLAK]: 'Ditolak',
  [JobLifecycle.DIKONFIRMASI]: 'Disetujui, menunggu cetakan',
  [JobLifecycle.AKTIF]: 'Berjalan',
  [JobLifecycle.SELESAI]: 'Selesai',
}

export function JobLifecycleBadge({ status }: { status: JobLifecycle }) {
  return <Badge tone={jobLifecycleTone[status]}>{jobLifecycleLabel[status]}</Badge>
}

// --- Perpanjangan sewa ---
const extensionTone: Record<ExtensionStatus, BadgeTone> = {
  [ExtensionStatus.DIAJUKAN]: 'amber',
  [ExtensionStatus.DITERIMA]: 'emerald',
  [ExtensionStatus.DITOLAK]: 'rose',
}

export const extensionStatusLabel: Record<ExtensionStatus, string> = {
  [ExtensionStatus.DIAJUKAN]: 'Menunggu approval',
  [ExtensionStatus.DITERIMA]: 'Disetujui',
  [ExtensionStatus.DITOLAK]: 'Ditolak',
}

export function ExtensionStatusBadge({ status }: { status: ExtensionStatus }) {
  return <Badge tone={extensionTone[status]}>{extensionStatusLabel[status]}</Badge>
}

// --- Mold tracking (fisik cetakan) ---
const moldTrackingTone: Record<MoldTrackingStatus, BadgeTone> = {
  [MoldTrackingStatus.PLANNING]: 'slate',
  [MoldTrackingStatus.DELIVERY]: 'sky',
  [MoldTrackingStatus.RECEIVED]: 'sky',
  [MoldTrackingStatus.PRODUCTION]: 'brand',
  [MoldTrackingStatus.SEND_BACK]: 'amber',
  [MoldTrackingStatus.COMPLETED]: 'emerald',
}

export const moldTrackingLabel: Record<MoldTrackingStatus, string> = {
  [MoldTrackingStatus.PLANNING]: 'Planning',
  [MoldTrackingStatus.DELIVERY]: 'Delivery',
  [MoldTrackingStatus.RECEIVED]: 'Received',
  [MoldTrackingStatus.PRODUCTION]: 'On Machine (Production)',
  [MoldTrackingStatus.SEND_BACK]: 'Send Back',
  [MoldTrackingStatus.COMPLETED]: 'Completed',
}

export function MoldTrackingBadge({ status }: { status: MoldTrackingStatus }) {
  return <Badge tone={moldTrackingTone[status]}>{moldTrackingLabel[status]}</Badge>
}

// --- Progress molding (Layer 2) ---
const progressMoldingTone: Record<ProgressMolding, BadgeTone> = {
  [ProgressMolding.PLANNING]: 'slate',
  [ProgressMolding.ONGOING]: 'brand',
  [ProgressMolding.SUDAH_DIPRODUKSI]: 'emerald',
}

export const progressMoldingLabel: Record<ProgressMolding, string> = {
  [ProgressMolding.PLANNING]: 'Planning',
  [ProgressMolding.ONGOING]: 'Ongoing',
  [ProgressMolding.SUDAH_DIPRODUKSI]: 'Sudah diproduksi',
}

export function ProgressMoldingBadge({ status }: { status: ProgressMolding }) {
  return <Badge tone={progressMoldingTone[status]}>{progressMoldingLabel[status]}</Badge>
}

// --- Garansi mesin ---
const warrantyStatusTone: Record<WarrantyStatus, BadgeTone> = {
  [WarrantyStatus.AKTIF]: 'emerald',
  [WarrantyStatus.HABIS]: 'rose',
}

export function WarrantyStatusBadge({ status }: { status: WarrantyStatus }) {
  return (
    <Badge tone={warrantyStatusTone[status]}>
      {status === WarrantyStatus.AKTIF ? 'Aktif' : 'Habis'}
    </Badge>
  )
}
