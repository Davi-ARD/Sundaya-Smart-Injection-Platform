import { useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  ArrowRight,
  Boxes,
  ClipboardList,
  Gauge,
  ShieldCheck,
  Truck,
} from 'lucide-react'
import { useAuth } from '../features/auth/authContextValue'
import { homePathForRole } from '../features/auth/roleLabels'
import sundayaIcon from '../assets/icon-sundaya.png'

export function LandingPage() {
  const { isAuthenticated, user } = useAuth()
  const featuresRef = useRef<HTMLDivElement>(null)
  const [isFeaturesVisible, setIsFeaturesVisible] = useState(false)

  // Reveal sekali saat kartu fitur masuk viewport pas discroll ke bawah;
  // tidak perlu animasi ulang tiap kali di-scroll bolak-balik.
  useEffect(() => {
    const node = featuresRef.current
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsFeaturesVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.2 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  if (isAuthenticated && user) return <Navigate to={homePathForRole(user.role)} replace />

  return (
    <div className="min-h-screen bg-surface">
      <header className="fixed inset-x-4 top-4 z-30 mx-auto flex max-w-[1440px] items-center justify-between rounded-full border border-white/15 bg-white/10 px-6 py-3 text-white shadow-lg shadow-black/10 backdrop-blur-md sm:inset-x-6 lg:inset-x-8">
        <span className="flex items-center gap-2 text-base font-bold tracking-wide">
          <img src={sundayaIcon} alt="Sundaya" className="h-8 w-8 object-contain" /> Sundaya Smart Injection Platform
        </span>
        <nav className="flex items-center gap-2">
          <Link
            to="/register"
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-800 hover:-translate-y-0.5"
          >
            Daftar
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-800 hover:-translate-y-0.5"
          >
            Masuk <ArrowRight className="h-5 w-5" />
          </Link>
        </nav>
      </header>

      <section
        className="relative flex min-h-screen items-center pb-16 pt-28 text-white"
        style={{ background: 'linear-gradient(150deg, #0f1e3d 0%, #1e40af 100%)' }}
      >
        <div className="absolute inset-0 overflow-hidden" aria-hidden>
          <div className="absolute inset-0 hero-glow" />
          <div className="absolute inset-0 hero-pattern" />
          <div className="absolute inset-0 hero-circuit-lines" />
        </div>

        <div className="relative mx-auto grid w-full max-w-[1440px] items-center gap-14 px-6 lg:grid-cols-2">
          <div className="animate-fade-in-left text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand-100 ring-1 ring-inset ring-white/15">
              PT Sundaya Indonesia
            </span>
            <h1 className="mx-auto mt-6 max-w-xl text-4xl font-bold leading-tight sm:text-5xl lg:mx-0">
              Platform sewa dan monitoring mesin injection molding
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-normal text-brand-100/85 lg:mx-0">
              Sundaya Smart Injection Platform menghubungkan perusahaan penyewa dengan Sundaya:
              booking mesin, tracking cetakan, dan log produksi dalam satu sistem terpadu.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-brand-800 shadow-lg shadow-black/10 transition-all hover:bg-brand-50 hover:-translate-y-0.5"
              >
                Daftar <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-lg border border-white/25 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                masuk
              </Link>
            </div>
          </div>

          {/* Visual mesin (foto asli mesin Sundaya). */}
          <div className="animate-fade-in-right relative hidden lg:block">
            <div className="relative overflow-hidden rounded-3xl border border-white/15 shadow-2xl shadow-black/30">
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f1e3d]/60 via-[#0f1e3d]/5 to-transparent" />
              <img
                src="/mesin_molding.jpeg"
                alt="Mesin injection molding Sundaya"
                className="h-80 w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-6 py-20">
        <div
          ref={featuresRef}
          className={[
            'grid gap-5 transition-all duration-700 ease-out sm:grid-cols-2 lg:grid-cols-4',
            isFeaturesVisible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
          ].join(' ')}
        >
          <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-soft transition-shadow hover:shadow-soft-lg">
            <span className="grid h-12 w-12 place-items-center text-brand-600">
              <Boxes className="h-7 w-7" strokeWidth={2.25} />
            </span>
            <h3 className="mt-4 text-base font-semibold text-slate-800">Kelola Cetakan</h3>
            <p className="mt-1.5 text-sm leading-normal text-slate-500">
              Daftarkan mold beserta rencana material dan target produksi.
            </p>
            <div className="mt-4 flex h-10 items-end gap-1.5" aria-hidden>
              <div className="w-2.5 rounded-t bg-brand-200" style={{ height: '40%' }} />
              <div className="w-2.5 rounded-t bg-brand-300" style={{ height: '70%' }} />
              <div className="w-2.5 rounded-t bg-brand-600" style={{ height: '100%' }} />
              <div className="w-2.5 rounded-t bg-brand-200" style={{ height: '55%' }} />
              <div className="w-2.5 rounded-t bg-brand-300" style={{ height: '80%' }} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-soft transition-shadow hover:shadow-soft-lg">
            <span className="grid h-12 w-12 place-items-center text-brand-600">
              <Gauge className="h-7 w-7" strokeWidth={2.25} />
            </span>
            <h3 className="mt-4 text-base font-semibold text-slate-800">Booking Mesin</h3>
            <p className="mt-1.5 text-sm leading-normal text-slate-500">
              Ajukan sewa tanpa memilih mesin; Sundaya yang meng-assign.
            </p>
            <div className="mt-4 space-y-1.5" aria-hidden>
              <div className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1 text-[11px]">
                <span className="text-slate-500">Unit 1</span>
                <span className="inline-flex items-center gap-1 font-semibold text-accent-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
                  Tersedia
                </span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1 text-[11px]">
                <span className="text-slate-500">Unit 2</span>
                <span className="inline-flex items-center gap-1 font-semibold text-slate-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                  Terpakai
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-soft transition-shadow hover:shadow-soft-lg">
            <span className="grid h-12 w-12 place-items-center text-brand-600">
              <ClipboardList className="h-7 w-7" strokeWidth={2.25} />
            </span>
            <h3 className="mt-4 text-base font-semibold text-slate-800">Log Produksi</h3>
            <p className="mt-1.5 text-sm leading-normal text-slate-500">
              Catat timeline produksi harian langsung dari lokasi Sundaya.
            </p>
            <div className="mt-4 flex items-center gap-1.5" aria-hidden>
              <span className="h-2 w-2 rounded-full bg-brand-600" />
              <span className="h-px flex-1 bg-slate-200" />
              <span className="h-2 w-2 rounded-full bg-brand-600" />
              <span className="h-px flex-1 bg-slate-200" />
              <span className="h-2 w-2 rounded-full border-2 border-slate-300 bg-white" />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-soft transition-shadow hover:shadow-soft-lg">
            <span className="grid h-12 w-12 place-items-center text-brand-600">
              <Truck className="h-7 w-7" strokeWidth={2.25} />
            </span>
            <h3 className="mt-4 text-base font-semibold text-slate-800">Log Pengiriman</h3>
            <p className="mt-1.5 text-sm leading-normal text-slate-500">
              Bandingkan rencana vs aktual kedatangan mold dan material.
            </p>
            <div className="mt-4 flex items-center gap-1.5" aria-hidden>
              <span className="h-2 w-2 rounded-full bg-brand-600" />
              <span className="h-px flex-1 border-t border-dashed border-slate-300" />
              <Truck className="h-4 w-4 text-brand-500" />
              <span className="h-px flex-1 border-t border-dashed border-slate-300" />
              <span className="h-2 w-2 rounded-full bg-accent-500" />
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-100/70 px-6 py-14">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-2 text-center">
          <ShieldCheck className="h-7 w-7 text-brand-700" />
          <p className="text-sm font-medium text-slate-700">
            Data setiap perusahaan penyewa terisolasi dan hanya dapat diakses oleh timnya sendiri.
          </p>
        </div>
      </section>

      <footer className="px-6 py-8">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-3">
          <p className="text-center text-xs text-slate-400">
            &copy; {new Date().getFullYear()} PT Sundaya Indonesia. Sundaya Smart Injection Platform.
          </p>
        </div>
      </footer>
    </div>
  )
}
