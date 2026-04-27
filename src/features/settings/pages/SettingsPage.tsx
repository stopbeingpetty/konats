import { NavLink, Outlet } from 'react-router-dom'
import { cn } from '@/lib/utils'

const TABS = [
  { label: 'Room Types', path: '/settings/room-types' },
  { label: 'Hotel Info', path: '/settings/hotel-info' },
  { label: 'Integrations', path: '/settings/integrations' },
] as const

export default function SettingsPage() {
  return (
    <div className="px-6 py-6 md:px-8 md:py-8">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-sm text-gray-400">
          Configure your hotel profile and integrations.
        </p>
      </div>

      {/* Tab bar — plain NavLink, no Radix involvement */}
      <nav className="mb-8 flex border-b border-[#2D5A3D]" aria-label="Settings tabs">
        {TABS.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              cn(
                'inline-block border-b-2 px-5 pb-3 font-heading text-base font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]',
                isActive
                  ? 'border-[#C9A227] text-white'
                  : 'border-transparent text-gray-400 hover:text-gray-200'
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      {/* Route content — Outlet is a direct child, no Radix wrapper */}
      <Outlet />
    </div>
  )
}
