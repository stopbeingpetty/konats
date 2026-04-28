import { useState, useMemo } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useMonthReservations,
  useMonthInventory,
  useMonthDemandMarkers,
  useMonthRestrictions,
} from '@/features/calendar/hooks/useMonthData'
import { useRoomTypesList } from '@/features/settings/hooks/useRoomTypes'
import { MonthHeader } from '@/features/calendar/components/MonthHeader'
import { CalendarGrid } from '@/features/calendar/components/CalendarGrid'
import { DayDrawer } from '@/features/calendar/components/DayDrawer'
import { computeDayMetrics, computeMonthKpis } from '@/features/calendar/lib/metrics'
import { format, eachDayOfInterval, endOfMonth } from 'date-fns'

export default function CalendarPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string | null>(null)
  const [drawerDate, setDrawerDate] = useState<string | null>(null)

  // ── Data fetching ──────────────────────────────────────────────────────────
  const { data: roomTypes = [], isLoading: rtLoading } = useRoomTypesList()
  const { data: reservations = [], isLoading: resLoading } = useMonthReservations(year, month)
  const { data: inventory = [], isLoading: invLoading } = useMonthInventory(year, month)
  const { data: demandMarkers = [], isLoading: dmLoading } = useMonthDemandMarkers(year, month)
  const { data: restrictions = [], isLoading: restsLoading } = useMonthRestrictions(year, month)

  const isLoading = rtLoading || resLoading || invLoading || dmLoading || restsLoading

  // ── Month KPIs ─────────────────────────────────────────────────────────────
  const monthKpis = useMemo(() => {
    if (isLoading) return null

    const filteredRoomTypes =
      selectedRoomTypeId !== null
        ? roomTypes.filter((rt) => rt.id === selectedRoomTypeId)
        : roomTypes

    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = endOfMonth(monthStart)
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

    const dailyMetrics = daysInMonth.map((day) => {
      const dateStr = format(day, 'yyyy-MM-dd')
      return computeDayMetrics(dateStr, reservations, filteredRoomTypes, inventory)
    })

    return computeMonthKpis(year, month, dailyMetrics, reservations, new Date())
  }, [isLoading, year, month, selectedRoomTypeId, roomTypes, reservations, inventory])

  // ── Navigation ─────────────────────────────────────────────────────────────
  function prevMonth() {
    if (month === 1) {
      setYear((y) => y - 1)
      setMonth(12)
    } else {
      setMonth((m) => m - 1)
    }
  }

  function nextMonth() {
    if (month === 12) {
      setYear((y) => y + 1)
      setMonth(1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  // ── Drawer ─────────────────────────────────────────────────────────────────
  function openDrawer(dateStr: string) {
    setDrawerDate(dateStr)
  }

  function closeDrawer() {
    setDrawerDate(null)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Month header — KPI strip + navigation */}
      <MonthHeader
        year={year}
        month={month}
        monthKpis={monthKpis}
        roomTypes={roomTypes}
        selectedRoomTypeId={selectedRoomTypeId}
        onRoomTypeChange={setSelectedRoomTypeId}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
        isLoading={isLoading}
      />

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <CalendarSkeleton />
        ) : (
          <CalendarGrid
            year={year}
            month={month}
            reservations={reservations}
            inventory={inventory}
            roomTypes={roomTypes}
            selectedRoomTypeId={selectedRoomTypeId}
            demandMarkers={demandMarkers}
            restrictions={restrictions}
            onDayClick={openDrawer}
          />
        )}
      </div>

      {/* Day detail drawer */}
      {drawerDate !== null && (
        <DayDrawer
          open={drawerDate !== null}
          onClose={closeDrawer}
          date={drawerDate}
          monthReservations={reservations}
          inventory={inventory}
          roomTypes={roomTypes}
          selectedRoomTypeId={selectedRoomTypeId}
        />
      )}
    </div>
  )
}

// ============================================================================
// Loading skeleton
// ============================================================================

function CalendarSkeleton() {
  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-5 bg-[#1a2f20]" />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="h-[80px] bg-[#1a2f20]" />
        ))}
      </div>
    </div>
  )
}
