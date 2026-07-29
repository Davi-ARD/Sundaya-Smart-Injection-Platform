import type { ReactNode } from 'react'
import {
  DeliveryStatus,
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
  [MachineStatus.DIAJUKAN]: 'amber',
  [MachineStatus.DIKONFIRMASI]: 'sky',
  [MachineStatus.DIKIRIM]: 'sky',
  [MachineStatus.AKTIF]: 'brand',
  [MachineStatus.SELESAI_SEWA]: 'amber',
  [MachineStatus.DIKEMBALIKAN]: 'amber',
  [MachineStatus.PENGECEKAN]: 'amber',
  [MachineStatus.MAINTENANCE]: 'rose',
}

export const machineStatusLabel: Record<MachineStatus, string> = {
  [MachineStatus.TERSEDIA]: 'Tersedia',
  [MachineStatus.DIAJUKAN]: 'Diajukan',
  [MachineStatus.DIKONFIRMASI]: 'Dikonfirmasi',
  [MachineStatus.DIKIRIM]: 'Dikirim',
  [MachineStatus.AKTIF]: 'Aktif',
  [MachineStatus.SELESAI_SEWA]: 'Selesai Sewa',
  [MachineStatus.DIKEMBALIKAN]: 'Dikembalikan',
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
  [MachineOperationalStatus.BREAKDOWN]: 'rose',
  [MachineOperationalStatus.MAINTENANCE]: 'amber',
}

export const machineOperationalLabel: Record<MachineOperationalStatus, string> = {
  [MachineOperationalStatus.RUNNING]: 'Running',
  [MachineOperationalStatus.SETUP]: 'Setup',
  [MachineOperationalStatus.STANDBY]: 'Standby',
  [MachineOperationalStatus.BREAKDOWN]: 'Breakdown',
  [MachineOperationalStatus.MAINTENANCE]: 'Maintenance',
}

export function MachineOperationalBadge({ status }: { status: MachineOperationalStatus }) {
  return <Badge tone={machineOperationalTone[status]}>{machineOperationalLabel[status]}</Badge>
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
  [JobLifecycle.DIKIRIM]: 'sky',
  [JobLifecycle.AKTIF]: 'brand',
  [JobLifecycle.SELESAI_SEWA]: 'amber',
  [JobLifecycle.DIKEMBALIKAN]: 'amber',
  [JobLifecycle.SELESAI]: 'emerald',
}

export const jobLifecycleLabel: Record<JobLifecycle, string> = {
  [JobLifecycle.DIAJUKAN]: 'Diajukan',
  [JobLifecycle.DITOLAK]: 'Ditolak',
  [JobLifecycle.DIKONFIRMASI]: 'Dikonfirmasi',
  [JobLifecycle.DIKIRIM]: 'Dikirim',
  [JobLifecycle.AKTIF]: 'Aktif',
  [JobLifecycle.SELESAI_SEWA]: 'Selesai Sewa',
  [JobLifecycle.DIKEMBALIKAN]: 'Dikembalikan',
  [JobLifecycle.SELESAI]: 'Selesai',
}

export function JobLifecycleBadge({ status }: { status: JobLifecycle }) {
  return <Badge tone={jobLifecycleTone[status]}>{jobLifecycleLabel[status]}</Badge>
}

// --- Mold tracking (fisik cetakan) ---
const moldTrackingTone: Record<MoldTrackingStatus, BadgeTone> = {
  [MoldTrackingStatus.PLANNING]: 'slate',
  [MoldTrackingStatus.READY_DELIVERY]: 'amber',
  [MoldTrackingStatus.DELIVERY]: 'sky',
  [MoldTrackingStatus.RECEIVED]: 'sky',
  [MoldTrackingStatus.WAITING_PRODUCTION]: 'amber',
  [MoldTrackingStatus.ON_MACHINE]: 'brand',
  [MoldTrackingStatus.PRODUCTION]: 'brand',
  [MoldTrackingStatus.REPAIR]: 'rose',
  [MoldTrackingStatus.SEND_BACK]: 'amber',
  [MoldTrackingStatus.COMPLETED]: 'emerald',
}

export const moldTrackingLabel: Record<MoldTrackingStatus, string> = {
  [MoldTrackingStatus.PLANNING]: 'Planning',
  [MoldTrackingStatus.READY_DELIVERY]: 'Ready Delivery',
  [MoldTrackingStatus.DELIVERY]: 'Delivery',
  [MoldTrackingStatus.RECEIVED]: 'Received',
  [MoldTrackingStatus.WAITING_PRODUCTION]: 'Waiting Production',
  [MoldTrackingStatus.ON_MACHINE]: 'On Machine',
  [MoldTrackingStatus.PRODUCTION]: 'Production',
  [MoldTrackingStatus.REPAIR]: 'Repair',
  [MoldTrackingStatus.SEND_BACK]: 'Send Back',
  [MoldTrackingStatus.COMPLETED]: 'Completed',
}

export function MoldTrackingBadge({ status }: { status: MoldTrackingStatus }) {
  return <Badge tone={moldTrackingTone[status]}>{moldTrackingLabel[status]}</Badge>
}

// --- Delivery status (Log Pengiriman, dihitung) ---
const deliveryTone: Record<DeliveryStatus, BadgeTone> = {
  [DeliveryStatus.DIRENCANAKAN]: 'slate',
  [DeliveryStatus.DIKIRIM]: 'sky',
  [DeliveryStatus.TIBA_ONTIME]: 'emerald',
  [DeliveryStatus.TIBA_TERLAMBAT]: 'amber',
  [DeliveryStatus.BELUM_TIBA]: 'rose',
}

export const deliveryLabel: Record<DeliveryStatus, string> = {
  [DeliveryStatus.DIRENCANAKAN]: 'Direncanakan',
  [DeliveryStatus.DIKIRIM]: 'Dikirim',
  [DeliveryStatus.TIBA_ONTIME]: 'Tiba On-time',
  [DeliveryStatus.TIBA_TERLAMBAT]: 'Tiba Terlambat',
  [DeliveryStatus.BELUM_TIBA]: 'Belum Tiba',
}

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  return <Badge tone={deliveryTone[status]}>{deliveryLabel[status]}</Badge>
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
