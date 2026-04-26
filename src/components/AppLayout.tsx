import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  CalendarDays,
  BookOpen,
  Upload,
  Settings,
  HardDrive,
  LogOut,
} from 'lucide-react'

const navItems = [
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/reservations', label: 'Reservations', icon: BookOpen },
  { to: '/imports', label: 'Imports', icon: Upload },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/backups', label: 'Backups', icon: HardDrive },
]

export default function AppLayout() {
  const navigate = useNavigate()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-[#0f1f15]">
      {/* Sidebar */}
      <aside className="flex w-56 flex-shrink-0 flex-col border-r border-[#2D5A3D] bg-[#111d14]">
        <div className="px-5 py-4 border-b border-[#2D5A3D]">
          <span className="text-xl font-bold text-[#C9A227] tracking-widest">KONATS</span>
        </div>

        <nav className="flex-1 space-y-0.5 px-2 py-4">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-[#1A472A] text-white'
                    : 'text-gray-400 hover:bg-[#1a2f20] hover:text-white'
                )
              }
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-[#2D5A3D] p-2">
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-400 hover:bg-[#1a2f20] hover:text-white transition-colors"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
