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
import { Toaster } from '@/components/ui/sonner'

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
    <div className="flex min-h-screen bg-[#E8EEEE]">
      {/* Sidebar — deep premium teal, no right border (contrast with canvas is enough) */}
      <aside className="flex w-56 flex-shrink-0 flex-col bg-[#0F3D3E]">
        {/* Brand header */}
        <div className="px-8 pt-8" style={{ paddingBottom: 0 }}>
          <div
            className="font-display font-semibold text-[#C9A227]"
            style={{ fontSize: '32px', letterSpacing: '-0.02em', lineHeight: 1 }}
          >
            KONATS
          </div>
          {/* Gold accent bar */}
          <div
            style={{ width: '24px', height: '1.5px', backgroundColor: '#C9A227', marginTop: '8px' }}
          />
          <div
            className="font-sans italic text-[rgba(240,244,244,0.55)]"
            style={{ fontSize: '11px', marginTop: '8px' }}
          >
            by David Atlija
          </div>
        </div>

        {/* Hotel context block */}
        <div className="px-8" style={{ marginTop: '24px' }}>
          {/* Hairline divider */}
          <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.08)' }} />
          <div style={{ marginTop: '12px' }}>
            <div
              className="font-sans font-medium uppercase text-[rgba(240,244,244,0.45)]"
              style={{ fontSize: '9px', letterSpacing: '0.18em' }}
            >
              HOTEL
            </div>
            <div
              className="font-sans font-medium text-[rgba(240,244,244,0.85)]"
              style={{ fontSize: '13px', lineHeight: 1.3, marginTop: '4px' }}
            >
              Design & Boutique<br />Hotel Navis
            </div>
            <div
              className="font-sans italic text-[rgba(240,244,244,0.55)]"
              style={{ fontSize: '11px', marginTop: '6px' }}
            >
              Opatija, Croatia
            </div>
          </div>
        </div>

        {/* Nav — 32px gap below hotel block */}
        <nav className="flex-1 space-y-0.5 px-2" style={{ marginTop: '32px' }}>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 py-3 text-sm transition-colors',
                  isActive
                    ? "border-l-2 border-[#C9A227] bg-[rgba(201,162,39,0.10)] pl-[22px] pr-6 font-sans font-medium text-[rgba(240,244,244,1)]"
                    : "px-6 font-sans font-medium text-[rgba(240,244,244,0.7)] hover:bg-[rgba(255,255,255,0.04)] hover:text-[rgba(240,244,244,1)]"
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={cn(
                      'h-4 w-4 flex-shrink-0',
                      isActive ? 'text-[#C9A227]' : 'text-[rgba(240,244,244,0.7)]'
                    )}
                  />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-6 pb-5 pt-3">
          <div
            className="font-sans text-[10px] text-[rgba(240,244,244,0.45)]"
          >
            v0.1
          </div>
          <button
            onClick={handleSignOut}
            className="mt-3 flex items-center gap-2 font-sans text-[13px] text-[rgba(240,244,244,0.7)] transition-colors hover:text-[rgba(240,244,244,1)]"
          >
            <LogOut className="h-3.5 w-3.5 flex-shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-[#E8EEEE]">
        <Outlet />
      </main>

      <Toaster
        theme="light"
        toastOptions={{
          classNames: {
            toast: 'border-[#D8DEDE] bg-white text-[#1A1A1A]',
            success: 'border-[rgba(15,61,62,0.4)]',
            error: 'border-red-300',
          },
        }}
      />
    </div>
  )
}
