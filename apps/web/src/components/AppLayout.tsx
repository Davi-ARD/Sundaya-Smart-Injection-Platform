import { useEffect, useRef, useState, type ComponentType } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Bell,
  Boxes,
  CalendarPlus,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Factory,
  Gauge,
  Inbox,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Pencil,
  Truck,
  UserCog,
  Users,
  Wrench,
} from 'lucide-react'
import { Role, type AppNotification } from '@mold-tracker/shared'
import sundayaIcon from '../assets/icon-sundaya.png'
import { GlobalSearch } from './GlobalSearch'
import { useAuth } from '../features/auth/authContextValue'
import { initialsFromName, roleLabels, roleTagline } from '../features/auth/roleLabels'
import { useNotifications } from '../features/notifications/useNotifications'
import { API_BASE_URL } from '../lib/api'

type MenuItem = {
  label: string
  to: string
  icon: ComponentType<{ className?: string }>
  roles: Role[]
  // Cocokkan path persis, dipakai menu induk yang punya submenu (mis. /staff
  // agar tidak ikut aktif saat berada di /staff/booking).
  exact?: boolean
}

// Menu Penyewa (Manager + Admin Penyewa) dan staf Sundaya. Disaring per role.
const penyewaItems: MenuItem[] = [
  { label: 'Dashboard', to: '/manager', icon: LayoutDashboard, roles: [Role.MANAGER_PENYEWA] },
  { label: 'Cetakan', to: '/molds', icon: Boxes, roles: [Role.MANAGER_PENYEWA] },
  { label: 'Booking Mesin', to: '/booking', icon: CalendarPlus, roles: [Role.MANAGER_PENYEWA] },
  { label: 'Log Pengiriman', to: '/pengiriman', icon: Truck, roles: [Role.MANAGER_PENYEWA] },
  { label: 'Dashboard Job', to: '/job', icon: Gauge, roles: [Role.ADMIN_PENYEWA] },
  { label: 'Log Produksi', to: '/logs', icon: ClipboardList, roles: [Role.ADMIN_PENYEWA] },
]

// Teknisi Sundaya dan Admin Sundaya memakai menu yang sama persis; perbedaan
// hak akses ditampilkan di dalam halaman (tombol aksi muncul atau tidak).
const sundayaItems: MenuItem[] = [
  {
    label: 'Dashboard',
    to: '/staff',
    icon: LayoutDashboard,
    roles: [Role.SUPER_ADMIN, Role.ADMIN_SUNDAYA, Role.TEKNISI_SUNDAYA],
    exact: true,
  },
  {
    label: 'Booking',
    to: '/staff/booking',
    icon: ClipboardCheck,
    roles: [Role.SUPER_ADMIN, Role.ADMIN_SUNDAYA, Role.TEKNISI_SUNDAYA],
  },
  {
    label: 'Log Aktivitas',
    to: '/penerimaan',
    icon: Inbox,
    roles: [Role.SUPER_ADMIN, Role.ADMIN_SUNDAYA],
  },
  {
    label: 'Mesin',
    to: '/machines',
    icon: Factory,
    roles: [Role.SUPER_ADMIN, Role.ADMIN_SUNDAYA, Role.TEKNISI_SUNDAYA],
  },
  {
    label: 'Maintenance',
    to: '/maintenance',
    icon: Wrench,
    roles: [Role.SUPER_ADMIN, Role.ADMIN_SUNDAYA, Role.TEKNISI_SUNDAYA],
  },
]

const administrationItems: MenuItem[] = [
  { label: 'Akun Admin', to: '/penyewa-admins', icon: UserCog, roles: [Role.MANAGER_PENYEWA] },
  { label: 'Pengguna', to: '/users', icon: Users, roles: [Role.SUPER_ADMIN] },
]

const menuSections = [
  { label: 'Penyewa', items: penyewaItems },
  { label: 'Sundaya', items: sundayaItems },
  { label: 'Administrasi', items: administrationItems },
]

const SIDEBAR_GRADIENT = 'linear-gradient(180deg, #16264a 0%, #0f1e3d 55%, #0a1730 100%)'
// Sinkron manual dengan version di apps/web/package.json.
const APP_VERSION = 'v0.1.0'

export function AppLayout() {
  const { user, logout } = useAuth()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  if (!user) return null

  const visibleSections = menuSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.roles.includes(user.role)),
    }))
    .filter((section) => section.items.length > 0)
  const initials = initialsFromName(user.nama)

  return (
    <div className="min-h-screen bg-surface">
      {isMobileSidebarOpen ? (
        <button
          type="button"
          aria-label="Tutup sidebar"
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-sm transition lg:hidden"
        />
      ) : null}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 hidden overflow-hidden text-white shadow-2xl shadow-slate-900/25 transition-[width] duration-300 ease-out lg:block',
          isSidebarOpen ? 'w-72' : 'w-20',
        ].join(' ')}
        style={{ background: SIDEBAR_GRADIENT }}
      >
        <SidebarContent
          isOpen={isSidebarOpen}
          sections={visibleSections}
          onNavigate={() => undefined}
          onToggleCollapse={() => setIsSidebarOpen((current) => !current)}
        />
      </aside>

      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 w-72 overflow-hidden text-white shadow-2xl shadow-slate-900/30 transition-transform duration-300 ease-out lg:hidden',
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        style={{ background: SIDEBAR_GRADIENT }}
      >
        <SidebarContent isOpen sections={visibleSections} onNavigate={() => setIsMobileSidebarOpen(false)} />
      </aside>

      <div
        className={[
          'transition-[padding] duration-300 ease-out',
          isSidebarOpen ? 'lg:pl-72' : 'lg:pl-20',
        ].join(' ')}
      >
        <header className="sticky top-[22px] z-20 mx-4 mt-[22px] rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-3 shadow-sm shadow-slate-900/5 backdrop-blur-md sm:mx-6 sm:px-6 lg:mx-8 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                aria-label="Buka sidebar"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50 active:scale-95 lg:hidden"
              >
                <PanelLeft className="h-5 w-5" />
              </button>
              <div className="hidden min-w-0 flex-1 sm:block">
                <GlobalSearch />
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <NotificationBell />
              <UserMenu
                initials={initials}
                nama={user.nama}
                role={user.role}
                avatarUrl={user.avatarUrl}
                onLogout={logout}
              />
            </div>
          </div>
        </header>

        <main className="content-dot-grid px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

const formatRelativeTime = (iso: string) => {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'Baru saja'
  if (minutes < 60) return `${minutes} menit lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  return `${days} hari lalu`
}

function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const openNotification = (notification: AppNotification) => {
    if (!notification.isRead) void markRead(notification.id)
    setIsOpen(false)
    if (notification.link) navigate(notification.link)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Notifikasi"
        onClick={() => setIsOpen((current) => !current)}
        className="relative grid h-11 w-11 place-items-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-100"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-lg shadow-slate-900/10">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-950">Notifikasi</p>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                Tandai semua dibaca
              </button>
            ) : null}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length ? (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => openNotification(notification)}
                  className="flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left transition-colors duration-150 hover:bg-slate-50"
                >
                  <span
                    className={[
                      'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                      notification.isRead ? 'bg-transparent' : 'bg-brand-500',
                    ].join(' ')}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-950">{notification.title}</span>
                    <span className="mt-0.5 block text-xs leading-normal text-slate-600">{notification.message}</span>
                    <span className="mt-1 block text-[11px] text-slate-400">{formatRelativeTime(notification.createdAt)}</span>
                  </span>
                </button>
              ))
            ) : (
              <p className="px-4 py-8 text-center text-sm text-slate-400">Belum ada notifikasi.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function UserMenu({
  initials,
  nama,
  role,
  avatarUrl,
  onLogout,
}: {
  initials: string
  nama: string
  role: Role
  avatarUrl: string | null
  onLogout: () => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex h-11 items-center gap-2 rounded-lg px-2 py-1 transition-colors duration-150 hover:bg-slate-100"
      >
        {avatarUrl ? (
          <img
            src={`${API_BASE_URL}${avatarUrl}`}
            alt={nama}
            className="h-9 w-9 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-600 text-xs font-bold text-white">
            {initials}
          </span>
        )}
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-semibold leading-tight text-slate-950">{roleLabels[role]}</span>
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-brand-600">
            {roleTagline[role]}
          </span>
        </span>
        <ChevronDown className={['h-5 w-5 text-slate-400 transition-transform duration-150', isOpen ? 'rotate-180' : ''].join(' ')} />
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-slate-200/70 bg-white p-1.5 shadow-lg shadow-slate-900/10">
          <p className="truncate px-2.5 py-1.5 text-sm font-medium text-slate-700">{nama}</p>
          <button
            type="button"
            onClick={() => {
              setIsOpen(false)
              navigate('/profile')
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-slate-100"
          >
            <Pencil className="h-5 w-5" />
            Edit Profil
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-rose-500 transition-colors duration-150 hover:bg-rose-50 hover:text-rose-600"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </div>
      ) : null}
    </div>
  )
}

function SidebarContent({
  isOpen,
  sections,
  onNavigate,
  onToggleCollapse,
}: {
  isOpen: boolean
  sections: { label: string; items: MenuItem[] }[]
  onNavigate: () => void
  // Toggle ringkas/buka; hanya diisi untuk sidebar desktop (mobile tidak
  // punya mode ringkas, ditutup lewat overlay/nav-click).
  onToggleCollapse?: () => void
}) {
  return (
    <>
      {/* Watermark logo samar, dipotong di pojok bawah (posisi relatif ke
          <aside>, yang sudah fixed + overflow-hidden). */}
      <img
        src={sundayaIcon}
        alt=""
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -right-16 h-64 w-64 object-contain opacity-[0.03]"
      />
      <div className="relative flex h-full flex-col overflow-y-auto overflow-x-hidden px-4 py-5">
      <div
        className={[
          'flex items-center gap-3 border-b border-white/10 pb-5',
          isOpen ? '' : 'justify-center',
        ].join(' ')}
      >
        <div className="grid h-16 w-16 shrink-0 place-items-center">
          <img src={sundayaIcon} alt="Sundaya" className="h-14 w-14 object-contain" />
        </div>
        <div
          className={[
            'min-w-0 transition duration-200',
            isOpen ? 'translate-x-0 opacity-100' : 'pointer-events-none w-0 -translate-x-2 opacity-0',
          ].join(' ')}
        >
          <p className="text-base font-semibold uppercase tracking-wider text-brand-300">
            Sundaya Smart Injection Platfrom
          </p>
        </div>
      </div>

      <nav className="mt-6 space-y-6">
        {sections.map((section) => (
          <div key={section.label}>
            <p
              className={[
                'px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 transition-opacity duration-200',
                isOpen ? 'opacity-100' : 'opacity-0',
              ].join(' ')}
            >
              {section.label}
            </p>
            <div className="mt-2 space-y-1">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.exact}
                  onClick={onNavigate}
                  title={isOpen ? undefined : item.label}
                  className={({ isActive }) =>
                    [
                      'group flex h-11 items-center rounded-xl text-sm font-medium transition duration-200',
                      isOpen ? 'gap-3 px-3' : 'justify-center px-0',
                      isActive
                        ? 'bg-white/10 text-brand-200 shadow-lg shadow-slate-900/20'
                        : 'text-slate-300 hover:-translate-y-0.5 hover:bg-white/10 hover:text-white',
                    ].join(' ')
                  }
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span
                    className={[
                      'whitespace-nowrap transition duration-200',
                      isOpen
                        ? 'translate-x-0 opacity-100'
                        : 'pointer-events-none w-0 -translate-x-2 overflow-hidden opacity-0',
                    ].join(' ')}
                  >
                    {item.label}
                  </span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-auto space-y-3 border-t border-white/10 pt-4">
        <div className={['flex items-center gap-2', isOpen ? '' : 'justify-center'].join(' ')}>
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          {isOpen ? <span className="text-xs text-slate-400">Sistem Online</span> : null}
        </div>

        {isOpen ? <p className="text-[10px] text-slate-500">{APP_VERSION}</p> : null}

        {onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={isOpen ? 'Ringkas sidebar' : 'Buka sidebar'}
            className={[
              'flex h-9 w-full items-center rounded-lg text-slate-400 transition-colors duration-150 hover:bg-white/10 hover:text-white',
              isOpen ? 'justify-start gap-2 px-2' : 'justify-center',
            ].join(' ')}
          >
            <PanelLeft className={['h-4 w-4 shrink-0 transition-transform duration-200', isOpen ? '' : 'rotate-180'].join(' ')} />
            {isOpen ? <span className="text-xs font-medium">Ringkas sidebar</span> : null}
          </button>
        ) : null}
      </div>
      </div>
    </>
  )
}
