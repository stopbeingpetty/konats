import { isToday, isSameMonth } from 'date-fns'
import { cn } from '@/lib/utils'
import type { DailyOccupancyOverride, DemandLevel, RoomInventory, RoomType } from '@/types/database'
import type { Reservation } from '@/types/database'
import type { CalendarViewMode } from '@/features/calendar/pages/CalendarPage'
import { computeHybridDayMetrics, computePickupForDate, type PickupWindowDays } from '@/features/calendar/lib/metrics'

// ============================================================================
// Utilities
// ============================================================================

function formatEur(amount: number): string {
  return (
    '\u20ac' +
    new Intl.NumberFormat('hr-HR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(amount))
  )
}

/**
 * Bar color based on barPct (0–100 scale).
 * Occupancy mode: barPct == occupancyPct.
 * ADR mode: barPct == (adr / monthMaxAdr) * 100.
 */
function heatmapBarColor(barPct: number): string {
  if (barPct <= 0) return 'transparent'
  if (barPct >= 100) return '#C9A227'
  if (barPct >= 86) return '#0F3D3E'
  if (barPct >= 61) return 'rgba(15,61,62,0.65)'
  if (barPct >= 31) return '#B8C9C0'
  return '#E5DCC5'
}

/** Bar color for pickup mode — no gold (gold is reserved for occupancy peak/ADR). */
function pickupBarColor(count: number): string {
  if (count <= 0) return 'transparent'
  if (count >= 16) return '#0F3D3E'
  if (count >= 8)  return 'rgba(15,61,62,0.65)'
  if (count >= 4)  return '#B8C9C0'
  return '#E5DCC5'
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
  occupancyOverrides: DailyOccupancyOverride[]
  demandLevel: DemandLevel | null
  hasRestriction: boolean
  viewMode: CalendarViewMode
  monthMaxAdr: number
  pickupWindow: PickupWindowDays
  monthMaxPickup: number
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
  occupancyOverrides,
  demandLevel,
  hasRestriction,
  viewMode,
  monthMaxAdr,
  pickupWindow,
  monthMaxPickup,
  onClick,
}: DayCellProps) {
  const inCurrentMonth = isSameMonth(date, currentMonthDate)
  const today = isToday(date)
  // Hotel weekend convention: Friday (5) + Saturday (6), not Sat + Sun
  const isFriSat = date.getDay() === 5 || date.getDay() === 6

  const dateStr = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')

  // ── Metrics ──────────────────────────────────────────────────────────────
  const filteredRoomTypes = selectedRoomTypeId
    ? roomTypes.filter((rt) => rt.id === selectedRoomTypeId)
    : roomTypes

  const metrics = computeHybridDayMetrics(
    dateStr,
    reservations,
    filteredRoomTypes,
    inventory,
    occupancyOverrides
  )

  const { occupancyPct, soldRooms, totalRooms, adr } = metrics
  const displayOcc = Math.round(occupancyPct)
  const dayNum = date.getDate()

  // ── isPeak only for current-month cells (no gold on overflow days) ────────
  const isPeak = inCurrentMonth && occupancyPct >= 100

  // ── Pickup metrics (computed only in pickup mode for current-month cells) ─
  const pickupCount =
    viewMode === 'pickup' && inCurrentMonth
      ? computePickupForDate(dateStr, pickupWindow, reservations)
      : 0

  // ── Bar logic ─────────────────────────────────────────────────────────────
  let barWidth = 0
  let barColor = 'transparent'

  if (viewMode === 'pickup') {
    barWidth =
      inCurrentMonth && pickupCount > 0 && monthMaxPickup > 0
        ? Math.max(6, Math.round((pickupCount / monthMaxPickup) * 24))
        : 0
    barColor = pickupBarColor(pickupCount)
  } else {
    const barPct =
      viewMode === 'adr' && monthMaxAdr > 0
        ? (adr / monthMaxAdr) * 100
        : occupancyPct
    barWidth = barPct <= 0 ? 0 : Math.max(6, Math.round((barPct / 100) * 24))
    barColor = heatmapBarColor(barPct)
  }

  // ── Big number ────────────────────────────────────────────────────────────
  const bigNumber =
    viewMode === 'pickup'
      ? inCurrentMonth
        ? pickupCount > 0
          ? `+${pickupCount}`
          : '0'
        : ''
      : totalRooms > 0
        ? `${displayOcc}%`
        : '—'

  // ── Subtitle ──────────────────────────────────────────────────────────────
  const pickupSubtitleText =
    pickupWindow === 1
      ? `OCC ${displayOcc}% · in last 24h`
      : `OCC ${displayOcc}% · in last ${pickupWindow}d`

  const subtitle =
    viewMode === 'pickup'
      ? inCurrentMonth
        ? pickupSubtitleText
        : ''
      : viewMode === 'adr'
        ? totalRooms > 0
          ? adr > 0
            ? `${formatEur(adr)} · ${soldRooms}/${totalRooms}`
            : `${soldRooms}/${totalRooms}`
          : '—'
        : totalRooms > 0
          ? adr > 0
            ? `${soldRooms}/${totalRooms} · ${formatEur(adr)}`
            : `${soldRooms}/${totalRooms}`
          : '—'

  // ── Fri/Sat: 1px gold left border only — no bg tint ─────────────────────
  const cellBg = '#FFFFFF'
  // Skip left-border indicator on today cells — today ring takes precedence
  const cellBorderLeft =
    isFriSat && !today ? '1px solid rgba(201,162,39,0.45)' : undefined

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative min-h-[110px] w-full p-[14px] text-left',
        'transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-[#C9A227]/40',
        today ? 'ring-2 ring-inset ring-[#C9A227]' : ''
      )}
      style={{
        fontFeatureSettings: "'tnum'",
        backgroundColor: cellBg,
        border: '1px solid #D8DEDE',
        borderLeft: cellBorderLeft ?? '1px solid #D8DEDE',
        opacity: inCurrentMonth ? undefined : 0.35,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(201,162,39,0.04)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = cellBg
      }}
    >

      {/* Demand / restriction dot — top-left, 14px inset */}
      {(demandLevel !== null || hasRestriction) && (
        <div className="absolute left-[14px] top-[14px] flex flex-col gap-1">
          {hasRestriction && (
            <span
              className="block h-[5px] w-[5px] rounded-full"
              style={{ backgroundColor: 'rgba(180,60,60,0.7)' }}
            />
          )}
          {demandLevel !== null && (
            <span className="block h-[5px] w-[5px] rounded-full bg-[#1A1A1A]" />
          )}
        </div>
      )}

      {/* Day number — top-right */}
      <div className="absolute right-[14px] top-[14px]">
        {today ? (
          <span
            className="inline-block rounded-md bg-[#C9A227] font-display text-[14px] font-bold leading-none text-white"
            style={{ padding: '2px 4px' }}
          >
            {dayNum}
          </span>
        ) : isPeak ? (
          <span className="font-display text-[16px] font-light leading-none text-[#C9A227]">
            {dayNum}
          </span>
        ) : (
          <span className="font-display text-[16px] font-light leading-none text-[rgba(26,26,26,0.65)]">
            {dayNum}
          </span>
        )}
      </div>

      {/* Big metric — below day number */}
      <div className="mt-7">
        <div
          className={cn(
            'font-display text-[30px] font-semibold leading-none tabular-nums',
            viewMode === 'pickup'
              ? pickupCount === 0
                ? 'text-[rgba(26,26,26,0.3)]'
                : 'text-[#1A1A1A]'
              : isPeak
                ? 'text-[#C9A227]'
                : 'text-[#1A1A1A]'
          )}
          style={{ letterSpacing: '-0.02em', fontFeatureSettings: "'tnum', 'ss01'" }}
        >
          {bigNumber}
        </div>

        {/* Proportional bar — width proportional to metric value */}
        {barWidth > 0 && (
          <div
            className="mt-2 h-[2px]"
            style={{ width: `${barWidth}px`, backgroundColor: barColor }}
          />
        )}

        {/* Subtitle — occupancy mode: rooms·ADR; ADR mode: ADR·rooms */}
        <div
          className="mt-1.5 font-sans text-[12px] leading-tight tabular-nums text-[rgba(26,26,26,0.65)]"
          style={{ fontFeatureSettings: "'tnum'" }}
        >
          {subtitle}
        </div>
      </div>
    </button>
  )
}
