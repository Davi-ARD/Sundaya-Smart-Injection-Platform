import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Boxes, ClipboardList, Factory, Gauge, Layers, PackagePlus } from 'lucide-react'
import { LogProduksiEventType, type JobDashboard, type JobLogEntry } from '@mold-tracker/shared'
import { useAuth } from '../auth/authContextValue'
import { api } from '../../lib/api'
import { JobLifecycleBadge, ProgressMoldingBadge, progressMoldingLabel } from '../../components/ui/Badge'
import { Card, StatCard } from '../../components/ui/Card'
import { CardSkeleton } from '../../components/ui/Skeleton'
import { EmptyState } from '../../components/ui/EmptyState'
import { useToast } from '../../components/ui/Toast'
import { errorMessage } from '../../lib/errorMessage'
import { formatDate, formatDateTime, formatNumber, formatSisaHari } from '../../lib/format'

const eventLabel: Record<LogProduksiEventType, string> = {
  [LogProduksiEventType.MATERIAL_DATANG]: 'Material datang',
  [LogProduksiEventType.PRODUKSI_HARIAN]: 'Produksi harian',
  [LogProduksiEventType.PROGRESS_MOLDING]: 'Progress molding',
}

const eventIcon = {
  [LogProduksiEventType.MATERIAL_DATANG]: PackagePlus,
  [LogProduksiEventType.PRODUKSI_HARIAN]: Factory,
  [LogProduksiEventType.PROGRESS_MOLDING]: Layers,
}

// Persentase reject dari total yang diproduksi, satu desimal.
const rejectRate = (good: number, reject: number) => {
  const produced = good + reject
  return produced ? Math.round((reject / produced) * 1000) / 10 : 0
}

// Pasangan cetakan dan mesin pada satu event. Booking meminjamkan beberapa mesin tanpa
// memasangkannya ke cetakan, jadi baris log harus menyebut keduanya secara spesifik.
const logSubjek = (log: JobLogEntry) =>
  log.machineNumber ? `Cetakan ${log.moldKode} di mesin ${log.machineNumber}` : `Cetakan ${log.moldKode}`

// Ringkasan satu baris per event, sama seperti timeline di halaman Log Produksi.
const logSummary = (log: JobLogEntry) => {
  switch (log.eventType) {
    case LogProduksiEventType.MATERIAL_DATANG:
      return `${log.materialName ?? '-'} - ${log.jumlahKg ?? 0} kg${log.noSuratJalan ? ` (surat jalan ${log.noSuratJalan})` : ''}`
    case LogProduksiEventType.PRODUKSI_HARIAN:
      return `${formatNumber(log.goodProduct ?? 0)} baik, ${formatNumber(log.rejectCount ?? 0)} reject${
        log.materialUsedKg != null ? `, material terpakai ${log.materialUsedKg} kg` : ''
      }`
    default:
      return `${log.progressMolding ? progressMoldingLabel[log.progressMolding] : '-'}${
        log.keteranganProgress ? ` - ${log.keteranganProgress}` : ''
      }`
  }
}

// Satu booking bisa memuat beberapa cetakan; baris dashboard datang per cetakan, jadi
// dikelompokkan lagi supaya mesin dan sisa masa sewa cuma ditulis sekali per booking.
type JobGroup = {
  jobId: string
  jobNumber: string
  lifecycle: JobDashboard['lifecycle']
  machineNumbers: string[]
  endDate: string | null
  sisaHariSewa: number | null
  molds: JobDashboard[]
}

function groupByJob(rows: JobDashboard[]): JobGroup[] {
  const byJob = new Map<string, JobGroup>()
  for (const row of rows) {
    const group = byJob.get(row.jobId)
    if (group) {
      group.molds.push(row)
      continue
    }
    byJob.set(row.jobId, {
      jobId: row.jobId,
      jobNumber: row.jobNumber,
      lifecycle: row.lifecycle,
      machineNumbers: row.machineNumbers,
      endDate: row.endDate,
      sisaHariSewa: row.sisaHariSewa,
      molds: [row],
    })
  }
  return [...byJob.values()]
}

// Timeline dikelompokkan per tanggal kejadian supaya tanggalnya ditulis ulang tiap kali
// berganti hari, bukan diulang di setiap baris.
function groupByTanggal(logs: JobLogEntry[]): { tanggal: string; logs: JobLogEntry[] }[] {
  const hari: { tanggal: string; logs: JobLogEntry[] }[] = []
  for (const log of logs) {
    const tanggal = log.occurredAt.slice(0, 10)
    const terakhir = hari.at(-1)
    if (terakhir?.tanggal === tanggal) terakhir.logs.push(log)
    else hari.push({ tanggal, logs: [log] })
  }
  return hari
}

// Dashboard job (Admin Penyewa di lokasi Sundaya): visualisasi saja. Ringkasan tiap
// booking aktif perusahaan induk beserta sisa masa sewa mesin, kuota material per
// cetakan, dan log utama seluruh booking. Semua angka diturunkan dari Log Produksi dan
// data booking, tidak ada input baru di halaman ini.
export function JobDashboardPage() {
  const { accessToken } = useAuth()
  const toast = useToast()

  const [rows, setRows] = useState<JobDashboard[]>([])
  const [logs, setLogs] = useState<JobLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const [jobList, logList] = await Promise.all([
        api.getJobDashboard(accessToken),
        api.getJobLogs(accessToken),
      ])
      setRows(jobList)
      setLogs(logList)
    } catch (caught) {
      toast.error(errorMessage(caught, 'Gagal memuat dashboard job'))
    } finally {
      setIsLoading(false)
    }
  }, [accessToken, toast])

  useEffect(() => {
    void load()
  }, [load])

  const jobs = useMemo(() => groupByJob(rows), [rows])
  const hari = useMemo(() => groupByTanggal(logs), [logs])

  const totals = useMemo(() => {
    const good = rows.reduce((sum, row) => sum + row.totalGoodProduct, 0)
    const reject = rows.reduce((sum, row) => sum + row.totalReject, 0)
    const material = rows.reduce((sum, row) => sum + row.materialUsedKg, 0)
    // Sisa sewa terpendek: yang paling perlu diperhatikan Admin Penyewa.
    const sisa = rows.map((row) => row.sisaHariSewa).filter((d): d is number => d != null)
    return {
      good,
      reject,
      rejectRate: rejectRate(good, reject),
      material: Math.round(material * 10) / 10,
      sisaTerpendek: sisa.length ? Math.min(...sisa) : null,
    }
  }, [rows])

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard Job</h1>
          <p className="mt-1 text-sm text-slate-500">
            Pemantauan booking aktif perusahaan Anda di lokasi Sundaya: mesin yang dipinjam, sisa
            masa sewanya, capaian produksi, dan kuota material tiap cetakan.
          </p>
        </div>
        <Link
          to="/logs"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
        >
          Catat log produksi <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {isLoading ? (
        <Card>
          <CardSkeleton lines={4} />
        </Card>
      ) : jobs.length === 0 ? (
        <Card>
          <EmptyState
            icon={Gauge}
            title="Belum ada job aktif"
            message="Job muncul di sini setelah booking perusahaan Anda disetujui dan mesin mulai aktif."
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total produk baik" value={formatNumber(totals.good)} tone="emerald" />
            <StatCard
              label="Total reject"
              value={formatNumber(totals.reject)}
              hint={`Reject rate ${totals.rejectRate}%`}
              tone={totals.rejectRate > 5 ? 'rose' : totals.reject ? 'amber' : 'slate'}
            />
            <StatCard
              label="Material terpakai"
              value={`${formatNumber(totals.material)} kg`}
              hint="Akumulasi seluruh cetakan aktif"
              tone="slate"
            />
            <StatCard
              label="Sisa masa sewa terpendek"
              value={formatSisaHari(totals.sisaTerpendek)}
              hint="Hubungi Manager bila perlu perpanjangan"
              tone={totals.sisaTerpendek != null && totals.sisaTerpendek <= 3 ? 'amber' : 'slate'}
            />
          </div>

          <div className="mt-5 space-y-4">
            {jobs.map((job) => (
              <JobCard key={job.jobId} job={job} />
            ))}
          </div>
        </>
      )}

      <Card
        className="mt-5"
        title="Log utama"
        subtitle="Seluruh event dari semua booking perusahaan Anda, dikelompokkan per tanggal, terbaru di atas."
        actions={
          <Link
            to="/logs"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Log per job <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      >
        {isLoading ? (
          <CardSkeleton lines={4} />
        ) : hari.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Belum ada event tercatat"
            message="Catat event pertama di halaman Log Produksi."
          />
        ) : (
          <div className="space-y-5">
            {hari.map((kelompok) => (
              <section key={kelompok.tanggal}>
                <h3 className="text-sm font-bold text-slate-900">{formatDate(kelompok.tanggal)}</h3>
                <ol className="mt-2 space-y-3">
                  {kelompok.logs.map((log) => (
                    <LogItem key={log.id} log={log} />
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function LogItem({ log }: { log: JobLogEntry }) {
  const Icon = eventIcon[log.eventType]
  return (
    <li className="flex gap-3 rounded-xl border border-slate-200/70 bg-white p-4 shadow-soft">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-slate-900">
            {logSubjek(log)}
            <span className="ml-2 font-medium text-slate-500">
              {eventLabel[log.eventType]} - {log.jobNumber}
            </span>
          </p>
          <p className="text-xs text-slate-400">{formatDateTime(log.occurredAt)}</p>
        </div>
        <p className="mt-1 text-sm text-slate-600">{logSummary(log)}</p>
        {log.catatan ? <p className="mt-1 text-xs text-slate-500">{log.catatan}</p> : null}
      </div>
    </li>
  )
}

function JobCard({ job }: { job: JobGroup }) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold text-slate-900">{job.jobNumber}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <Factory className="h-3.5 w-3.5" />
              {job.machineNumbers.length
                ? `Mesin ${job.machineNumbers.join(', ')}`
                : 'Mesin belum dipinjamkan'}
            </span>
            <span className="flex items-center gap-1.5">
              <Boxes className="h-3.5 w-3.5" />
              {job.molds.length} cetakan
            </span>
          </p>
        </div>
        <div className="text-right">
          <JobLifecycleBadge status={job.lifecycle} />
          <p
            className={[
              'mt-1.5 text-sm font-semibold',
              job.sisaHariSewa != null && job.sisaHariSewa <= 3 ? 'text-amber-700' : 'text-slate-900',
            ].join(' ')}
          >
            Sisa sewa mesin {formatSisaHari(job.sisaHariSewa)}
          </p>
          {job.endDate ? (
            <p className="text-xs text-slate-500">Selesai sewa {formatDate(job.endDate)}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
        {job.molds.map((mold) => (
          <MoldBlock key={mold.moldId} mold={mold} />
        ))}
      </div>
    </Card>
  )
}

// Satu cetakan: capaian terhadap target dan pemakaian material terhadap kuotanya.
// Material diperlakukan sebagai kuota, jadi yang ditampilkan adalah terpakai dan sisa
// dari plan, bukan perbandingan target dengan realisasi.
function MoldBlock({ mold }: { mold: JobDashboard }) {
  const rate = rejectRate(mold.totalGoodProduct, mold.totalReject)

  return (
    <div className="rounded-xl bg-slate-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-900">
            {mold.moldKode} - {mold.moldProduk}
          </p>
          <p className="text-xs text-slate-500">
            {mold.moldCavity} cavity, {mold.moldTonaseTon} ton
            {mold.latestLogAt ? ` - log terakhir ${formatDateTime(mold.latestLogAt)}` : ''}
          </p>
        </div>
        {mold.progressMolding ? <ProgressMoldingBadge status={mold.progressMolding} /> : null}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Produk baik" value={formatNumber(mold.totalGoodProduct)} tone="text-emerald-700" />
        <Stat label="Reject" value={formatNumber(mold.totalReject)} />
        <Stat label="Reject rate" value={`${rate}%`} tone={rate > 5 ? 'text-rose-700' : undefined} />
        <Stat
          label="Target"
          value={mold.targetOutput != null ? formatNumber(mold.targetOutput) : '-'}
        />
      </dl>

      {mold.targetOutput ? (
        <Bar
          label={`Capaian terhadap target ${formatNumber(mold.targetOutput)} pcs`}
          value={`${mold.achievement}%`}
          percent={mold.achievement}
        />
      ) : null}

      {mold.planMaterialKg != null ? (
        <Bar
          label={`Material terpakai ${formatNumber(mold.materialUsedKg)} kg dari kuota ${formatNumber(mold.planMaterialKg)} kg`}
          value={`sisa ${formatNumber(mold.materialRemainingKg ?? 0)} kg`}
          percent={
            mold.planMaterialKg > 0
              ? Math.min((mold.materialUsedKg / mold.planMaterialKg) * 100, 100)
              : 0
          }
          tone="bg-amber-500"
        />
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          Material terpakai {formatNumber(mold.materialUsedKg)} kg, cetakan ini tanpa kuota material.
        </p>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className={['mt-0.5 text-base font-bold', tone ?? 'text-slate-900'].join(' ')}>{value}</dd>
    </div>
  )
}

function Bar({
  label,
  value,
  percent,
  tone = 'bg-brand-600',
}: {
  label: string
  value: string
  percent: number
  tone?: string
}) {
  return (
    <div className="mt-3">
      <div className="flex items-baseline justify-between gap-3 text-xs text-slate-500">
        <span>{label}</span>
        <span className="font-semibold text-slate-900">{value}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200/70">
        <div
          className={['h-full rounded-full transition-[width] duration-500', tone].join(' ')}
          style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
        />
      </div>
    </div>
  )
}
