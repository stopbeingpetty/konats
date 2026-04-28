import { useMemo } from 'react'
import { startOfWeek, endOfWeek, eachDayOfInterval, format } from 'date-fns'
import type { DemandMarker, Reservation, Restriction, RoomInventory, RoomType } from '@/types/database'
import { DayCell } from './DayCell'

// ============================================================================
// Helpers
// ============================================================================

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function buildCalendarDays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)  // last day of month
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
  onDayClick,
}: CalendarGridProps) {
  const calendarDays = useMemo(() => buildCalendarDays(year, month), [year, month])
  const currentMonthDate = useMemo(() => new Date(year, month - 1, 1), [year, month])

  return (
    <div>
      {/* Weekday header */}
      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="py-1 text-center text-[11px] font-medium uppercase tracking-widest text-gray-500"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
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
              demandLevel={getActiveDemandLevel(dateStr, demandMarkers)}
              hasRestriction={hasAnyRestriction(dateStr, restrictions, selectedRoomTypeId)}
              onClick={() => onDayClick(dateStr)}
            />
          )
        })}
      </div>
    </div>
  )
}
