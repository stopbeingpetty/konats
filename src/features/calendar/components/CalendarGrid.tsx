import { useMemo } from 'react'
import { startOfWeek, endOfWeek, eachDayOfInterval, format } from 'date-fns'
import type { DailyOccupancyOverride, DemandMarker, Reservation, Restriction, RoomInventory, RoomType } from '@/types/database'
import type { CalendarViewMode } from '@/features/calendar/pages/CalendarPage'
import type { PickupWindowDays } from '@/features/calendar/lib/metrics'
import { DayCell } from './DayCell'

// ============================================================================
// Helpers
// ============================================================================

const WEEKDAY_LABELS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

function buildCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const gridStart = startOfWeek(firstDay, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(lastDay, { weekStartsOn: 1 })
  return eachDayOfInterval({ start: gridStart, end: gridEnd })
}

function getActiveDemandLevel(
  dateStr: string,
  markers: DemandMarker[]
): import('@/types/database').DemandLevel | null {
  const marker = markers.find((m) => m.date_from <= dateStr && m.date_to >= dateStr)
  return marker?.level ?? null
}

function hasAnyRestriction(
  dateStr: string,
  restrictions: Restriction[],
  roomTypeId: string | null
): boolean {
  return restrictions.some(
    (r) =>
      r.date === dateStr &&
      (roomTypeId === null || r.room_type_id === roomTypeId) &&
      (r.cta || r.ctd || r.min_los > 1)
  )
}

// ============================================================================
// Props
// ============================================================================

interface CalendarGridProps {
  year: number
  month: number
  reservations: Reservation[]
  inventory: RoomInventory[]
  roomTypes: RoomType[]
  selectedRoomTypeId: string | null
  demandMarkers: DemandMarker[]
  restrictions: Restriction[]
  occupancyOverrides: DailyOccupancyOverride[]
  viewMode: CalendarViewMode
  monthMaxAdr: number
  pickupWindow: PickupWindowDays
  monthMaxPickup: number
  onDayClick: (dateStr: string) => void
}

// ============================================================================
// Component
// ============================================================================

export function CalendarGrid({
  year,
  month,
  reservations,
  inventory,
  roomTypes,
  selectedRoomTypeId,
  demandMarkers,
  restrictions,
  occupancyOverrides,
  viewMode,
  monthMaxAdr,
  pickupWindow,
  monthMaxPickup,
  onDayClick,
}: CalendarGridProps) {
  const calendarDays = useMemo(() => buildCalendarDays(year, month), [year, month])
  const currentMonthDate = useMemo(() => new Date(year, month - 1, 1), [year, month])

  return (
    <div>
      {/* Weekday header — Inter Medium 12px, charcoal 70%, clearly readable */}
      <div
        className="grid grid-cols-7 border-b border-[#D8DEDE]"
        style={{ paddingTop: '16px', paddingBottom: '16px' }}
      >
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-center font-sans text-[12px] font-medium uppercase text-[rgba(26,26,26,0.7)]"
            style={{ letterSpacing: '0.12em' }}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day cells — 6px gaps, each cell has its own border */}
      <div className="grid grid-cols-7 gap-1.5">
        {calendarDays.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd')
          return (
            <DayCell
              key={dateStr}
              date={day}
              currentMonthDate={currentMonthDate}
              reservations={reservations}
              inventory={inventory}
              roomTypes={roomTypes}
              selectedRoomTypeId={selectedRoomTypeId}
              occupancyOverrides={occupancyOverrides}
              demandLevel={getActiveDemandLevel(dateStr, demandMarkers)}
              hasRestriction={hasAnyRestriction(dateStr, restrictions, selectedRoomTypeId)}
              viewMode={viewMode}
              monthMaxAdr={monthMaxAdr}
              pickupWindow={pickupWindow}
              monthMaxPickup={monthMaxPickup}
              onClick={() => onDayClick(dateStr)}
            />
          )
        })}
      </div>
    </div>
  )
}
