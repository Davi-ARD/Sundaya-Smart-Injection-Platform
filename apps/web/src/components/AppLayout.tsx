import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Role } from '@mold-tracker/shared'
import { useAuth } from '../features/auth/authContextValue'

const roleLabels: Record<Role, string> = {
  [Role.ADMIN]: 'Admin',
  [Role.PENYEDIA]: 'Penyedia',
  [Role.PENYEWA]: 'Penyewa',
  [Role.OPERATOR]: 'Operator',
}

const menuItems = [
  {
    label: 'Dashboard',
    shortLabel: 'D',
    to: '/dashboard',
    roles: [Role.ADMIN, Role.PENYEDIA, Role.PENYEWA, Role.OPERATOR],
  },
  {
    label: 'Pengguna',
    shortLabel: 'P',
    to: '/users',
    roles: [Role.ADMIN],
  },
  {
    label: 'Operator',
    shortLabel: 'O',
    to: '/operators',
    roles: [Role.PENYEWA],
  },
]

export function AppLayout() {
  const { user, logout } = useAuth()
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  if (!user) {
    return null
  }

  const visibleMenuItems = menuItems.filter((item) => item.roles.includes(user.role))
  const firstInitial = user.nama.trim().charAt(0).toUpperCase() || 'M'

  return (
    <div className="min-h-screen bg-slate-100">
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
        <SidebarContent
          firstInitial={firstInitial}
          isOpen={isSidebarOpen}
          menuItems={visibleMenuItems}
          roleLabel={roleLabels[user.role]}
          userName={user.nama}
          onClose={() => setIsSidebarOpen(false)}
          onLogout={logout}
          onNavigate={() => undefined}
          onToggle={() => setIsSidebarOpen((current) => !current)}
        />
      </aside>

      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 w-72 bg-slate-950 text-white shadow-2xl shadow-slate-900/30 transition-transform duration-300 ease-out lg:hidden',
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <SidebarContent
          firstInitial={firstInitial}
          isOpen
          menuItems={visibleMenuItems}
          roleLabel={roleLabels[user.role]}
          userName={user.nama}
          onClose={() => setIsMobileSidebarOpen(false)}
          onLogout={logout}
          onNavigate={() => setIsMobileSidebarOpen(false)}
          onToggle={() => setIsMobileSidebarOpen(false)}
        />
      </aside>

      <div
        className={[
          'transition-[padding] duration-300 ease-out',
          isSidebarOpen ? 'lg:pl-72' : 'lg:pl-20',
        ].join(' ')}
      >
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                aria-label="Buka sidebar"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-xl font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 lg:hidden"
              >
                =
              </button>
              <button
                type="button"
                aria-label={isSidebarOpen ? 'Ringkas sidebar' : 'Buka sidebar'}
                onClick={() => setIsSidebarOpen((current) => !current)}
                className="hidden h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-xl font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50 lg:grid"
              >
                =
              </button>
              <div className="min-w-0">
                <p className="text-sm text-slate-500">Masuk sebagai</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-semibold text-slate-950">
                    {user.nama}
                  </h2>
                  <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                    {roleLabels[user.role]}
                  </span>
                </div>
              </div>
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

type SidebarMenuItem = (typeof menuItems)[number]

function SidebarContent({
  firstInitial,
  isOpen,
  menuItems,
  roleLabel,
  userName,
  onClose,
  onLogout,
  onNavigate,
  onToggle,
}: {
  firstInitial: string
  isOpen: boolean
  menuItems: SidebarMenuItem[]
  roleLabel: string
  userName: string
  onClose: () => void
  onLogout: () => void
  onNavigate: () => void
  onToggle: () => void
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden px-4 py-5">
      <div
        className={[
          'flex items-center gap-3 border-b border-white/10 pb-5',
          isOpen ? 'justify-between' : 'justify-center',
        ].join(' ')}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-600 text-base font-bold text-white shadow-lg shadow-brand-600/30">
            {firstInitial}
          </div>
          <div
            className={[
              'min-w-0 transition duration-200',
              isOpen
                ? 'translate-x-0 opacity-100'
                : 'pointer-events-none w-0 -translate-x-2 opacity-0',
            ].join(' ')}
          >
            <p className="truncate text-sm font-bold text-white">{userName}</p>
            <p className="mt-0.5 truncate text-xs text-slate-400">
              {roleLabel}
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-label={isOpen ? 'Tutup sidebar' : 'Buka sidebar'}
          onClick={isOpen ? onClose : onToggle}
          className={[
            'grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xl text-slate-300 transition hover:bg-white/10 hover:text-white',
            isOpen ? '' : 'hidden',
          ].join(' ')}
        >
          x
        </button>
      </div>

      <nav className="mt-6 space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            title={isOpen ? undefined : item.label}
            className={({ isActive }) =>
              [
                'group flex h-12 items-center rounded-xl text-sm font-medium transition duration-200',
                isOpen ? 'gap-3 px-4' : 'justify-center px-0',
                isActive
                  ? 'bg-slate-800 text-brand-300 shadow-lg shadow-slate-900/20'
                  : 'text-slate-300 hover:-translate-y-0.5 hover:bg-white/10 hover:text-white',
              ].join(' ')
            }
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-xs font-bold transition group-hover:bg-white/10">
              {item.shortLabel}
            </span>
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
      </nav>

      <div className="mt-auto border-t border-white/10 pt-4">
        <button
          type="button"
          onClick={onLogout}
          className={[
            'flex h-11 w-full items-center rounded-xl text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white',
            isOpen ? 'gap-3 px-4' : 'justify-center px-0',
          ].join(' ')}
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-xs font-bold">
            K
          </span>
          <span
            className={[
              'whitespace-nowrap transition duration-200',
              isOpen
                ? 'translate-x-0 opacity-100'
                : 'pointer-events-none w-0 -translate-x-2 overflow-hidden opacity-0',
            ].join(' ')}
          >
          Logout
          </span>
        </button>
      </div>
    </div>
  )
}
