import type { ReactNode } from 'react'
import {
  CauseCategory,
  ConditionResult,
  MachineStatus,
  RentalStatus,
  ReviewStatus,
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

const rentalStatusTone: Record<RentalStatus, BadgeTone> = {
  [RentalStatus.DIAJUKAN]: 'amber',
  [RentalStatus.DITOLAK]: 'rose',
  [RentalStatus.DIKONFIRMASI]: 'sky',
  [RentalStatus.DIKIRIM]: 'sky',
  [RentalStatus.AKTIF]: 'brand',
  [RentalStatus.SELESAI_SEWA]: 'amber',
  [RentalStatus.DIKEMBALIKAN]: 'amber',
  [RentalStatus.SELESAI]: 'emerald',
}

const rentalStatusLabel: Record<RentalStatus, string> = {
  [RentalStatus.DIAJUKAN]: 'Diajukan',
  [RentalStatus.DITOLAK]: 'Ditolak',
  [RentalStatus.DIKONFIRMASI]: 'Dikonfirmasi',
  [RentalStatus.DIKIRIM]: 'Dikirim',
  [RentalStatus.AKTIF]: 'Aktif',
  [RentalStatus.SELESAI_SEWA]: 'Selesai Sewa',
  [RentalStatus.DIKEMBALIKAN]: 'Dikembalikan',
  [RentalStatus.SELESAI]: 'Selesai',
}

export function RentalStatusBadge({ status }: { status: RentalStatus }) {
  return <Badge tone={rentalStatusTone[status]}>{rentalStatusLabel[status]}</Badge>
}

const warrantyStatusTone: Record<WarrantyStatus, BadgeTone> = {
  [WarrantyStatus.AKTIF]: 'emerald',
  [WarrantyStatus.HABIS]: 'rose',
}

const warrantyStatusLabel: Record<WarrantyStatus, string> = {
  [WarrantyStatus.AKTIF]: 'Aktif',
  [WarrantyStatus.HABIS]: 'Habis',
}

export function WarrantyStatusBadge({ status }: { status: WarrantyStatus }) {
  return <Badge tone={warrantyStatusTone[status]}>{warrantyStatusLabel[status]}</Badge>
}

const conditionResultTone: Record<ConditionResult, BadgeTone> = {
  [ConditionResult.BAIK]: 'emerald',
  [ConditionResult.BUTUH_MAINTENANCE]: 'amber',
  [ConditionResult.RUSAK]: 'rose',
}

const conditionResultLabel: Record<ConditionResult, string> = {
  [ConditionResult.BAIK]: 'Baik',
  [ConditionResult.BUTUH_MAINTENANCE]: 'Butuh Maintenance',
  [ConditionResult.RUSAK]: 'Rusak',
}

export function ConditionResultBadge({ result }: { result: ConditionResult }) {
  return <Badge tone={conditionResultTone[result]}>{conditionResultLabel[result]}</Badge>
}

const reviewStatusTone: Record<ReviewStatus, BadgeTone> = {
  [ReviewStatus.PENDING]: 'amber',
  [ReviewStatus.APPROVED]: 'emerald',
  [ReviewStatus.REJECTED]: 'rose',
}

const reviewStatusLabel: Record<ReviewStatus, string> = {
  [ReviewStatus.PENDING]: 'Menunggu Review',
  [ReviewStatus.APPROVED]: 'Disetujui',
  [ReviewStatus.REJECTED]: 'Ditolak',
}

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  return <Badge tone={reviewStatusTone[status]}>{reviewStatusLabel[status]}</Badge>
}

// Label kategori penyebab selisih produksi. Dipakai di tabel Produksi dan Laporan.
export const causeCategoryLabel: Record<CauseCategory, string> = {
  [CauseCategory.SETTING_OPERATOR]: 'Setting Operator',
  [CauseCategory.KUALITAS_MATERIAL]: 'Kualitas Material',
  [CauseCategory.KONDISI_MESIN]: 'Kondisi Mesin/Mold',
  [CauseCategory.LAIN]: 'Faktor Lain',
}
