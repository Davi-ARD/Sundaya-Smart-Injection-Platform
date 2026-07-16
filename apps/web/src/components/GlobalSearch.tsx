import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { Role } from '@mold-tracker/shared'
import { useAuth } from '../features/auth/authContextValue'
import { api } from '../lib/api'

const batchLabel = (id: string) => `B-${id.slice(-6).toUpperCase()}`

type ResultItem = { id: string; primary: string; secondary: string }
type ResultGroup = { label: string; items: ResultItem[]; onSelect: () => void }

// Pencarian global lintas modul (mesin, sewa, batch produksi, pengguna/operator),
// disaring otomatis per role lewat endpoint list yang sudah ada (bukan endpoint baru).
export function GlobalSearch() {
  const { accessToken, user } = useAuth()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [groups, setGroups] = useState<ResultGroup[]>([])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const term = query.trim().toLowerCase()
    if (term.length < 2 || !user) {
      setGroups([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    const timeout = window.setTimeout(() => {
      const canSeeMachines = user.role !== Role.OPERATOR

      Promise.all([
        canSeeMachines ? api.listMachines(accessToken) : Promise.resolve([]),
        api.listRentals(accessToken),
        api.listBatches(accessToken),
        user.role === Role.ADMIN ? api.listUsers(accessToken) : Promise.resolve([]),
        user.role === Role.PENYEWA ? api.listOperators(accessToken) : Promise.resolve([]),
      ])
        .then(([machines, rentals, batches, users, operators]) => {
          const rentalById = Object.fromEntries(rentals.map((rental) => [rental.id, rental]))

          const machineGroup: ResultGroup = {
            label: 'Mesin',
            items: machines
              .filter(
                (machine) =>
                  machine.machineNumber.toLowerCase().includes(term) ||
                  machine.spesifikasi.toLowerCase().includes(term),
              )
              .slice(0, 5)
              .map((machine) => ({ id: machine.id, primary: machine.machineNumber, secondary: machine.spesifikasi })),
            onSelect: () =>
              navigate(user.role === Role.PENYEWA ? '/catalog' : `/machines?q=${encodeURIComponent(term)}`),
          }

          const rentalGroup: ResultGroup = {
            label: 'Sewa',
            items: rentals
              .filter(
                (rental) =>
                  (rental.machineNumber ?? '').toLowerCase().includes(term) ||
                  rental.destinationLocation.toLowerCase().includes(term),
              )
              .slice(0, 5)
              .map((rental) => ({
                id: rental.id,
                primary: rental.machineNumber ?? rental.machineId,
                secondary: rental.destinationLocation,
              })),
            onSelect: () => navigate(user.role === Role.PENYEWA ? '/rentals' : '/rental-cycle'),
          }

          const batchGroup: ResultGroup = {
            label: 'Batch Produksi',
            items: batches
              .filter((batch) => {
                const machineNumber = rentalById[batch.rentalId]?.machineNumber ?? ''
                return batchLabel(batch.id).toLowerCase().includes(term) || machineNumber.toLowerCase().includes(term)
              })
              .slice(0, 5)
              .map((batch) => ({
                id: batch.id,
                primary: batchLabel(batch.id),
                secondary: rentalById[batch.rentalId]?.machineNumber ?? '-',
              })),
            onSelect: () => navigate(`/production?q=${encodeURIComponent(term)}`),
          }

          const userGroup: ResultGroup = {
            label: 'Pengguna',
            items: users
              .filter(
                (item) =>
                  item.nama.toLowerCase().includes(term) || (item.email ?? '').toLowerCase().includes(term),
              )
              .slice(0, 5)
              .map((item) => ({ id: item.id, primary: item.nama, secondary: item.email ?? item.role })),
            onSelect: () => navigate('/users'),
          }

          const operatorGroup: ResultGroup = {
            label: 'Operator',
            items: operators
              .filter((item) => item.nama.toLowerCase().includes(term))
              .slice(0, 5)
              .map((item) => ({ id: item.id, primary: item.nama, secondary: 'Operator' })),
            onSelect: () => navigate('/operators'),
          }

          setGroups([machineGroup, rentalGroup, batchGroup, userGroup, operatorGroup].filter((g) => g.items.length > 0))
          setIsOpen(true)
        })
        .finally(() => setIsSearching(false))
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [query, accessToken, user, navigate])

  const hasResults = groups.some((group) => group.items.length > 0)

  return (
    <div ref={containerRef} className="relative min-w-0 max-w-md flex-1">
      <label className="relative hidden sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          placeholder="Cari mesin, penyewa, batch..."
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => query.trim().length >= 2 && setIsOpen(true)}
          className="w-full rounded-lg border border-slate-200 bg-slate-50/60 py-2 pl-9 pr-8 text-sm text-slate-700 outline-none transition-colors duration-150 placeholder:text-slate-400 focus:border-brand-500 focus:bg-white"
        />
        {query ? (
          <button
            type="button"
            aria-label="Bersihkan pencarian"
            onClick={() => {
              setQuery('')
              setGroups([])
              setIsOpen(false)
            }}
            className="absolute right-2.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-slate-400 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </label>

      {isOpen && query.trim().length >= 2 ? (
        <div className="absolute left-0 top-full z-30 mt-2 w-full max-w-md overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-lg shadow-slate-900/10">
          {isSearching ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">Mencari...</p>
          ) : hasResults ? (
            <div className="max-h-96 overflow-y-auto">
              {groups.map((group) => (
                <div key={group.label} className="border-b border-slate-100 last:border-b-0">
                  <p className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {group.label}
                  </p>
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        group.onSelect()
                        setIsOpen(false)
                      }}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors duration-150 hover:bg-slate-50"
                    >
                      <span className="font-medium text-slate-950">{item.primary}</span>
                      <span className="truncate text-xs text-slate-500">{item.secondary}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-slate-500">
              Tidak ada hasil untuk &quot;{query}&quot;.
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
