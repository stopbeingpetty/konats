import { isToday, isWeekend, isSameMonth } from 'date-fns'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DemandLevel, RoomInventory, RoomType } from '@/types/database'
import type { Reservation } from '@/types/database'
import { computeDayMetrics } from '@/features/calendar/lib/metrics'

// ============================================================================
// Utilities
// ============================================================================

function formatEur(amount: number): string {
  return (
    '\u20ac\u00a0' +
    new Intl.NumberFormat('hr-HR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(amount))
  )
}

function occupancyTextColor(pct: number): string {
  if (pct >= 90) return 'text-[#C9A227]'
  if (pct >= 70) return 'text-green-400'
  if (pct >= 40) return 'text-amber-400'
  if (pct > 0) return 'text-red-400'
  return 'text-gray-500'
}

function cellBorderColor(pct: number): string {
  if (pct >= 90) return 'border-[#C9A227]/40'
  if (pct >= 70) return 'border-green-700/40'
  if (pct >= 40) return 'border-amber-700/40'
  if (pct > 0) return 'border-red-800/40'
  return 'border-[#2D5A3D]/30'
}

function demandDotColor(level: DemandLevel): string {
  switch (level) {
    case 'peak': return 'bg-[#C9A227]'
    case 'high': return 'bg-red-500'
    case 'normal': return 'bg-blue-400'
    case 'low': return 'bg-gray-500'
  }
}

// ============================================================================
// Props
// ============================================================================

interface DayCellProps {
  date: Date
  currentMonthDate: Date
  reservations: Reservation[]
  inventory: RoomInventory[]
  roomTypes: RoomType[]
  selectedRoomTypeId: string | null
  demandLevel: DemandLevel | null
  hasRestriction: boolean
  onClick: () => void
}

// ============================================================================
// Component
// ============================================================================

export function DayCell({
  date,
  currentMonthDate,
  reservations,
  inventory,
  roomTypes,
  selectedRoomTypeId,
  demandLevel,
  hasRestriction,
  onClick,
}: DayCellProps) {
  const inCurrentMonth = isSameMonth(date, currentMonthDate)
  const today = isToday(date)
  const weekend = isWeekend(date)

  const dateStr = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')

  const filteredRoomTypes = selectedRoomTypeId
    ? roomTypes.filter((rt) => rt.id === selectedRoomTypeId)
    : roomTypes

  const metrics = computeDayMetrics(
    dateStr,
    reservations,
    filteredRoomTypes,
    inventory
  )

  const { occupancyPct, soldRooms, totalRooms, adr } = metrics
  const displayOcc = Math.round(occupancyPct)

  if (!inCurrentMonth) {
    return (
      <div className="min-h-[80px] rounded border border-[#1a2a1f]/40 p-1.5 opacity-25">
        <span className="text-xs text-gray-600">{date.getDate()}</span>
      </div>
    )
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative min-h-[80px] w-full rounded border p-1.5 text-left transition-colors',
        'hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A227]/50',
        today ? 'ring-1 ring-[#C9A227]/60' : '',
        weekend ? 'bg-[#0f1f15]/60' : 'bg-[#0d1a10]/40',
        cellBorderColor(occupancyPct)
      )}
    >
      {/* Restriction icon — top left */}
      {hasRestriction && (
        <Lock className="absolute left-1.5 top-1.5 h-2.5 w-2.5 text-amber-400" />
      )}

      {/* Day number */}
      <div
        className={cn(
          'mb-0.5 text-right text-xs font-medium leading-none',
          hasRestriction ? 'pr-0 pl-4' : '',
          today ? 'text-[#C9A227]' : 'text-gray-400'
        )}
      >
        {date.getDate()}
        {/* Demand dot — top right */}
        {demandLevel !== null && (
          <span
            className={cn(
              'ml-1 inline-block h-1.5 w-1.5 rounded-full align-middle',
              demandDotColor(demandLevel)
            )}
          />
        )}
      </div>

      {/* Occupancy % — large, heatmap colored */}
      <div
        className={cn(
          'text-center text-lg font-bold leading-none',
          occupancyTextColor(occupancyPct)
        )}
      >
        {soldRooms > 0 || totalRooms > 0 ? `${displayOcc}%` : '—'}
      </div>

      {/* Sold/total · ADR */}
      <div className="mt-0.5 text-center text-[10px] leading-tight text-gray-500">
        {totalRooms > 0 ? (
          <>
            {soldRooms}/{totalRooms}
            {adr > 0 && (
              <>
                {' · '}
                <span className="text-gray-400">{formatEur(adr)}</span>
              </>
            )}
          </>
        ) : (
          <span className="text-gray-600">—</span>
        )}
      </div>
    </button>
  )
}
