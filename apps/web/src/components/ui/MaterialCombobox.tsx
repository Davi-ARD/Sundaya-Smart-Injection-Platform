import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Pencil, Search } from 'lucide-react'
import { materialTypeOptions } from '../../lib/materialLabels'

// Pemilih material: daftar kurasi yang bisa dicari, plus opsi "Lainnya" untuk
// material di luar daftar. Nilai yang disimpan adalah teks bebas, jadi material
// kurasi tersimpan sebagai kodenya (mis. 'PP') dan material lain apa adanya.
//
// ponytail: dibangun dari elemen native (button + input + list) tanpa library
// combobox; kebutuhannya sederhana dan styling-nya mengikuti FormField.
export function MaterialCombobox({
  label,
  value,
  onChange,
  placeholder = '- pilih material -',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  // Mode isian bebas: aktif saat pengguna memilih "Lainnya", atau saat nilai yang
  // sudah tersimpan memang di luar daftar kurasi (mis. hasil input sebelumnya).
  const [isCustom, setIsCustom] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const known = useMemo(() => materialTypeOptions.find((o) => o.value === value), [value])
  const isValueCustom = value !== '' && !known

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fokuskan kolom pencarian tiap kali daftar dibuka.
  useEffect(() => {
    if (isOpen && !isCustom) searchRef.current?.focus()
  }, [isOpen, isCustom])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return materialTypeOptions
    return materialTypeOptions.filter((o) => o.label.toLowerCase().includes(q))
  }, [query])

  const pilih = (next: string) => {
    onChange(next)
    setIsOpen(false)
    setQuery('')
    setIsCustom(false)
  }

  const bukaIsianBebas = () => {
    setIsCustom(true)
    setIsOpen(false)
    setQuery('')
    // Teks yang sudah diketik di pencarian dipakai sebagai nilai awal: kalau
    // materialnya memang tidak ada di daftar, ketikannya tidak terbuang.
    onChange(query.trim())
  }

  // Setelah memilih "Lainnya", field berubah jadi input teks biasa.
  if (isCustom || isValueCustom) {
    return (
      <label className="block">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <div className="mt-1.5 flex gap-2">
          <input
            type="text"
            autoFocus={isCustom}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Ketik nama material"
            className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-slate-800 outline-none transition-all duration-150 placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
          />
          <button
            type="button"
            onClick={() => {
              setIsCustom(false)
              onChange('')
            }}
            className="shrink-0 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            Pilih dari daftar
          </button>
        </div>
      </label>
    )
  }

  return (
    <div ref={containerRef} className="relative block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="mt-1.5 flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2.5 text-left text-slate-800 outline-none transition-all duration-150 hover:border-slate-300 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-100"
      >
        <span className={known ? '' : 'text-slate-400'}>{known ? known.label : placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {isOpen ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg shadow-slate-900/10">
          <div className="relative border-b border-slate-100">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setIsOpen(false)
                // Enter memilih satu-satunya hasil yang tersisa.
                if (event.key === 'Enter' && filtered.length === 1) {
                  event.preventDefault()
                  pilih(filtered[0].value)
                }
              }}
              placeholder="Cari material..."
              className="w-full py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
          </div>

          {/* Tinggi dibatasi ~3,5 baris supaya kotaknya ringkas dan jelas bisa digulir. */}
          <div className="max-h-[9.5rem] overflow-y-auto py-1">
            {filtered.length ? (
              filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => pilih(option.value)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                >
                  {option.label}
                  {option.value === value ? (
                    <Check className="h-4 w-4 shrink-0 text-brand-600" />
                  ) : null}
                </button>
              ))
            ) : (
              <p className="px-3 py-3 text-center text-sm text-slate-400">
                Tidak ada material cocok
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={bukaIsianBebas}
            className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-left text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50"
          >
            <Pencil className="h-4 w-4 shrink-0" />
            {query.trim() ? `Pakai "${query.trim()}"` : 'Lainnya (ketik sendiri)'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
