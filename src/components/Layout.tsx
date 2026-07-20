import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { LayoutDashboard, BarChart3, Map, History, Settings as SettingsIcon, LogOut, Sparkles } from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/roadmap', label: 'Roadmap', icon: Map },
  { to: '/coach', label: 'AI Coach', icon: Sparkles },
  { to: '/history', label: 'History', icon: History },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

export default function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex bg-ink-50">
      <aside className="hidden md:flex w-60 flex-col border-r border-ink-100 bg-white">
        <div className="px-5 py-5 flex items-center gap-2 border-b border-ink-100">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white font-bold text-sm">GT</div>
          <div>
            <div className="font-semibold text-sm text-ink-900">GrindTrack AI</div>
            <div className="text-[11px] text-ink-400">DSA Progress Tracker</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900',
                )
              }
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-ink-100">
          <div className="px-3 py-2 mb-2">
            <div className="text-[11px] text-ink-400 uppercase tracking-wide">Signed in as</div>
            <div className="text-xs text-ink-700 truncate">{user?.email}</div>
          </div>
          <button onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-50 hover:text-ink-900 transition">
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-ink-100">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white font-bold text-xs">GT</div>
            <span className="font-semibold text-sm">GrindTrack AI</span>
          </div>
          <button onClick={handleSignOut} className="text-ink-500"><LogOut className="h-4 w-4" /></button>
        </header>
        <div className="md:hidden flex gap-1 px-3 py-2 bg-white border-b border-ink-100 overflow-x-auto">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap',
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-500',
                )
              }
            >
              <n.icon className="h-3.5 w-3.5" />
              {n.label}
            </NavLink>
          ))}
        </div>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
