import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useRoomTypesList } from '@/features/settings/hooks/useRoomTypes'
import { ReservationsImport } from '../components/ReservationsImport'
import { OccupancyImport } from '../components/OccupancyImport'

type Tab = 'reservations' | 'occupancy'

export default function ImportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('reservations')
  const { data: roomTypes = [] } = useRoomTypesList()

  return (
    <div className="flex flex-col h-full">
      {/* Tab navigation */}
      <div className="border-b border-[#D8DEDE] bg-white px-8">
        <div className="flex gap-1">
          <TabButton
            label="Reservations"
            active={activeTab === 'reservations'}
            onClick={() => setActiveTab('reservations')}
          />
          <TabButton
            label="Occupancy"
            active={activeTab === 'occupancy'}
            onClick={() => setActiveTab('occupancy')}
          />
        </div>
      </div>

      {/* Tab content — each manages its own step state */}
      <div className="flex-1 min-h-0">
        {activeTab === 'reservations' ? (
          <ReservationsImport roomTypes={roomTypes} />
        ) : (
          <OccupancyImport roomTypes={roomTypes} />
        )}
      </div>
    </div>
  )
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-3.5 font-sans text-sm font-medium transition-colors border-b-2 -mb-px',
        active
          ? 'border-[#0F3D3E] text-[#0F3D3E]'
          : 'border-transparent text-[rgba(26,26,26,0.55)] hover:text-[#1A1A1A]'
      )}
    >
      {label}
    </button>
  )
}
