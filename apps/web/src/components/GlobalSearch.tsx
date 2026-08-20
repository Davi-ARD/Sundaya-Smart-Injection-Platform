import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import { Role } from '@mold-tracker/shared'
import { useAuth } from '../features/auth/authContextValue'
import { api } from '../lib/api'

type SearchResult = { id: string; group: string; title: string; subtitle: string; to: string }

type SearchSource = { group: string; load: (token: string | null) => Promise<SearchResult[]> }

// Setiap sumber memakai endpoint list yang sama dengan halaman aslinya, jadi
// hasil pencarian otomatis mengikuti scoping RBAC/tenant yang sudah dijamin
// backend (tidak ada endpoint pencarian baru).
const machineSource: SearchSource = {
  group: 'Mesin',
  load: async (token) => {
    const machines = await api.listMachines(token)
    return machines.map((m) => ({ id: m.id, group: 'Mesin', title: m.machineNumber, subtitle: m.spesifikasi, to: '/machines' }))
  },
}

const moldTrackingSource: SearchSource = {
  group: 'Cetakan',
  load: async (token) => {
    const molds = await api.listMolds(token)
    return molds.map((m) => ({ id: m.id, group: 'Cetakan', title: m.kodeMold, subtitle: m.namaProduk, to: '/tracking' }))
  },
}

const staffBookingSource: SearchSource = {
  group: 'Booking',
  load: async (token) => {
    const jobs = await api.listJobs(token)
    return jobs.map((j) => ({
      id: j.id,
      group: 'Booking',
      title: j.jobNumber,
      subtitle: j.companyName ?? j.molds.map((m) => m.namaProduk).join(', ') ?? '-',
      to: '/staff/booking',
    }))
  },
}

const userSource: SearchSource = {
  group: 'Pengguna',
  load: async (token) => {
    const users = await api.listUsers(token)
    return users.map((u) => ({ id: u.id, group: 'Pengguna', title: u.nama, subtitle: u.email, to: '/users' }))
  },
}

const moldsSource: SearchSource = {
  group: 'Cetakan',
  load: async (token) => {
    const molds = await api.listMolds(token)
    return molds.map((m) => ({ id: m.id, group: 'Cetakan', title: m.kodeMold, subtitle: m.namaProduk, to: '/molds' }))
  },
}

const bookingSource: SearchSource = {
  group: 'Booking',
  load: async (token) => {
    const jobs = await api.listJobs(token)
    return jobs.map((j) => ({
      id: j.id,
      group: 'Booking',
      title: j.jobNumber,
      subtitle:
        j.molds.map((m) => m.kodeMold).join(', ') ||
        j.machines.map((m) => m.machineNumber).join(', ') ||
        '-',
      to: '/booking',
    }))
  },
}

const pengirimanSource: SearchSource = {
  group: 'Pengiriman',
  load: async (token) => {
    const rows = await api.listPengiriman(token)
    return rows.map((r) => ({
      id: r.id,
      group: 'Pengiriman',
      title: r.kodeMold ?? r.materialName ?? r.item,
      subtitle: r.jobNumber ?? '-',
      to: '/pengiriman',
    }))
  },
}

const penyewaAdminSource: SearchSource = {
  group: 'Akun Admin',
  load: async (token) => {
    const admins = await api.listPenyewaAdmins(token)
    return admins.map((u) => ({ id: u.id, group: 'Akun Admin', title: u.nama, subtitle: u.email, to: '/penyewa-admins' }))
  },
}

const jobDashboardSource: SearchSource = {
  group: 'Job',
  load: async (token) => {
    const jobs = await api.getJobDashboard(token)
    return jobs.map((j) => ({
      id: j.jobId,
      group: 'Job',
      title: j.jobNumber,
      subtitle: `${j.moldKode} - ${j.moldProduk}`,
      to: '/job',
    }))
  },
}

const logProduksiSource: SearchSource = {
  group: 'Log Produksi',
  load: async (token) => {
    const logs = await api.getJobLogs(token)
    return logs.map((l) => ({
      id: l.id,
      group: 'Log Produksi',
      title: `${l.jobNumber} - ${l.moldKode}`,
      subtitle: l.catatan ?? l.machineNumber ?? l.eventType,
      to: '/logs',
    }))
  },
}

const sourcesByRole: Partial<Record<Role, SearchSource[]>> = {
  [Role.SUPER_ADMIN]: [machineSource, moldTrackingSource, staffBookingSource, userSource],
  [Role.ADMIN_SUNDAYA]: [machineSource, moldTrackingSource, staffBookingSource],
  [Role.TEKNISI_SUNDAYA]: [machineSource, moldTrackingSource, staffBookingSource],
  [Role.MANAGER_PENYEWA]: [moldsSource, bookingSource, pengirimanSource, penyewaAdminSource],
  [Role.ADMIN_PENYEWA]: [jobDashboardSource, logProduksiSource],
}

// Search global di header: menggantikan teks "Selamat datang". Sumber data
// mengikuti role user yang login, hasil dimuat sekali lalu difilter di klien
// supaya ketikan berikutnya instan tanpa request ulang.
export function GlobalSearch() {
  const { user, accessToken } = useAuth()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const cacheRef = useRef<SearchResult[] | null>(null)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!user) return null
  const sources = sourcesByRole[user.role] ?? []

  const ensureLoaded = async (): Promise<SearchResult[]> => {
    if (cacheRef.current) return cacheRef.current
    setIsLoading(true)
    try {
      const settled = await Promise.allSettled(sources.map((source) => source.load(accessToken)))
      const all = settled.flatMap((outcome) => (outcome.status === 'fulfilled' ? outcome.value : []))
      cacheRef.current = all
      return all
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = async (value: string) => {
    setQuery(value)
    const trimmed = value.trim().toLowerCase()
    if (trimmed.length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }
    const all = await ensureLoaded()
    setResults(
      all.filter((r) => r.title.toLowerCase().includes(trimmed) || r.subtitle.toLowerCase().includes(trimmed)),
    )
    setIsOpen(true)
  }

  const openResult = (result: SearchResult) => {
    setIsOpen(false)
    setQuery('')
    navigate(result.to)
  }

  const placeholder = `Cari ${sources.map((s) => s.group.toLowerCase()).join(', ')}...`

  return (
    <div ref={containerRef} className="relative min-w-0 max-w-md flex-1">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(event) => void handleChange(event.target.value)}
          onFocus={() => {
            if (results.length) setIsOpen(true)
          }}
          placeholder={placeholder}
          className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 py-3 pl-9 pr-3 text-sm text-slate-700 placeholder:truncate placeholder:text-slate-400 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </div>

      {isOpen ? (
        <div className="absolute left-0 top-full z-30 mt-2 w-full overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-lg shadow-slate-900/10">
          {isLoading ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">Mencari...</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">Tidak ada hasil untuk &quot;{query}&quot;</p>
          ) : (
            <div className="max-h-80 overflow-y-auto py-1.5">
              {results.slice(0, 20).map((result) => (
                <button
                  key={`${result.group}-${result.id}`}
                  type="button"
                  onClick={() => openResult(result)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-800">{result.title}</span>
                    <span className="block truncate text-xs text-slate-400">{result.subtitle}</span>
                  </span>
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-brand-500">
                    {result.group}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
