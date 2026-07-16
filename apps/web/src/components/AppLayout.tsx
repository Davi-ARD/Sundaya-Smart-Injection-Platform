import { useEffect, useRef, useState, type ComponentType } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Bell,
  ChevronDown,
  ClipboardEdit,
  Factory,
  FileBarChart,
  Kanban,
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Pencil,
  Store,
  UserCog,
  Users,
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
}

const operationalItems: MenuItem[] = [
  {
    label: 'Dashboard',
    to: '/dashboard',
    icon: LayoutDashboard,
    roles: [Role.ADMIN, Role.PENYEDIA, Role.PENYEWA, Role.OPERATOR],
  },
  {
    label: 'Daftar Mesin',
    to: '/machines',
    icon: Factory,
    roles: [Role.ADMIN, Role.PENYEDIA],
  },
  {
    label: 'Katalog Sewa',
    to: '/catalog',
    icon: Store,
    roles: [Role.ADMIN, Role.PENYEWA],
  },
  {
    label: 'Status Sewa',
    to: '/rentals',
    icon: Kanban,
    roles: [Role.PENYEWA],
  },
  {
    label: 'Panel Siklus',
    to: '/rental-cycle',
    icon: Kanban,
    roles: [Role.ADMIN, Role.PENYEDIA],
  },
  {
    label: 'Input Produksi',
    to: '/production',
    icon: ClipboardEdit,
    roles: [Role.ADMIN, Role.PENYEDIA, Role.PENYEWA, Role.OPERATOR],
  },
  {
    label: 'Laporan',
    to: '/reports',
    icon: FileBarChart,
    roles: [Role.ADMIN, Role.PENYEWA],
  },
]

const administrationItems: MenuItem[] = [
  {
    label: 'Pengguna',
    to: '/users',
    icon: Users,
    roles: [Role.ADMIN],
  },
  {
    label: 'Operator',
    to: '/operators',
    icon: UserCog,
    roles: [Role.PENYEWA],
  },
]

const menuSections = [
  { label: 'Operasional', items: operationalItems },
  { label: 'Administrasi', items: administrationItems },
]

export function AppLayout() {
  const { user, logout } = useAuth()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  if (!user) {
    return null
  }

  const visibleSections = menuSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.roles.includes(user.role)),
    }))
    .filter((section) => section.items.length > 0)
  const initials = initialsFromName(user.nama)

  return (
    <div className="min-h-screen bg-slate-50">
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
          'fixed inset-y-0 left-0 z-40 hidden border-r border-slate-800/80 bg-slate-950 text-white shadow-2xl shadow-slate-900/25 transition-[width] duration-300 ease-out lg:block',
          isSidebarOpen ? 'w-72' : 'w-20',
        ].join(' ')}
      >
        <SidebarContent isOpen={isSidebarOpen} sections={visibleSections} onNavigate={() => undefined} />
      </aside>

      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 w-72 bg-slate-950 text-white shadow-2xl shadow-slate-900/30 transition-transform duration-300 ease-out lg:hidden',
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <SidebarContent isOpen sections={visibleSections} onNavigate={() => setIsMobileSidebarOpen(false)} />
      </aside>

      <div
        className={[
          'transition-[padding] duration-300 ease-out',
          isSidebarOpen ? 'lg:pl-72' : 'lg:pl-20',
        ].join(' ')}
      >
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <button
                type="button"
                aria-label="Buka sidebar"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50 active:scale-95 lg:hidden"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label={isSidebarOpen ? 'Ringkas sidebar' : 'Buka sidebar'}
                onClick={() => setIsSidebarOpen((current) => !current)}
                className="hidden h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200/70 bg-white text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-50 active:scale-95 lg:grid"
              >
                <PanelLeft className="h-4 w-4" />
              </button>

              <GlobalSearch />
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

        <main className="px-4 py-6 sm:px-6 lg:px-8">
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
    if (!notification.isRead) {
      void markRead(notification.id)
    }
    setIsOpen(false)
    if (notification.link) {
      navigate(notification.link)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Notifikasi"
        onClick={() => setIsOpen((current) => !current)}
        className="relative grid h-10 w-10 place-items-center rounded-lg text-slate-500 transition-colors duration-150 hover:bg-slate-100"
      >
        <Bell className="h-4.5 w-4.5" />
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
                    <span className="mt-0.5 block text-xs leading-5 text-slate-600">{notification.message}</span>
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
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-slate-100"
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
        <ChevronDown className={['h-4 w-4 text-slate-400 transition-transform duration-150', isOpen ? 'rotate-180' : ''].join(' ')} />
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
            <Pencil className="h-4 w-4" />
            Edit Profil
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-rose-500 transition-colors duration-150 hover:bg-rose-50 hover:text-rose-600"
          >
            <LogOut className="h-4 w-4" />
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
}: {
  isOpen: boolean
  sections: { label: string; items: MenuItem[] }[]
  onNavigate: () => void
}) {
  return (
    <div className="flex h-full flex-col overflow-y-auto overflow-x-hidden px-4 py-5">
      <div className={['flex items-center gap-3', isOpen ? '' : 'justify-center'].join(' ')}>
        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white shadow-lg shadow-slate-900/10">
          <img src={sundayaIcon} alt="Sundaya" className="h-8 w-8 object-contain" />
        </div>
        <div
          className={[
            'min-w-0 transition duration-200',
            isOpen ? 'translate-x-0 opacity-100' : 'pointer-events-none w-0 -translate-x-2 opacity-0',
          ].join(' ')}
        >
          <p className="truncate text-sm font-bold text-white">Mold Tracker</p>
          <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Rental &amp; Production
          </p>
        </div>
      </div>

      <nav className="mt-8 space-y-6">
        {sections.map((section) => (
          <div key={section.label}>
            <p
              className={[
                'px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500 transition-opacity duration-200',
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
                  onClick={onNavigate}
                  title={isOpen ? undefined : item.label}
                  className={({ isActive }) =>
                    [
                      'group flex h-11 items-center rounded-xl text-sm font-medium transition duration-200',
                      isOpen ? 'gap-3 px-3' : 'justify-center px-0',
                      isActive
                        ? 'bg-slate-800 text-brand-300 shadow-lg shadow-slate-900/20'
                        : 'text-slate-300 hover:-translate-y-0.5 hover:bg-white/10 hover:text-white',
                    ].join(' ')
                  }
                >
                  <item.icon className="h-4.5 w-4.5 shrink-0" />
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
    </div>
  )
}
