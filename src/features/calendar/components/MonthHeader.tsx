import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { MonthKpis } from '@/features/calendar/lib/metrics'
import type { RoomType } from '@/types/database'
import type { CalendarViewMode } from '@/features/calendar/pages/CalendarPage'

// ============================================================================
// Formatting helpers
// ============================================================================

function fmtEur(amount: number): string {
  return (
    '\u20ac\u00a0' +
    new Intl.NumberFormat('hr-HR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(amount))
  )
}

function fmtPct(pct: number): string {
  return `${Math.round(pct)}%`
}

// ============================================================================
// Props
// ============================================================================

interface MonthHeaderProps {
  year: number
  month: number
  monthKpis: MonthKpis | null
  roomTypes: RoomType[]
  selectedRoomTypeId: string | null
  onRoomTypeChange: (id: string | null) => void
  onPrevMonth: () => void
  onNextMonth: () => void
  isLoading: boolean
  viewMode: CalendarViewMode
  onViewModeChange: (mode: CalendarViewMode) => void
}

// ============================================================================
// Component
// ============================================================================

export function MonthHeader({
  year,
  month,
  monthKpis,
  roomTypes,
  selectedRoomTypeId,
  onRoomTypeChange,
  onPrevMonth,
  onNextMonth,
  isLoading,
  viewMode,
  onViewModeChange,
}: MonthHeaderProps) {
  const monthDate = new Date(year, month - 1, 1)
  const monthName = format(monthDate, 'MMMM').toUpperCase()
  const yearStr = String(year)
  const kpis = monthKpis

  return (
    <div className="border-b border-[#C8D2D2] bg-[#E8EEEE] px-6">

      {/* ── ROW 1: Display row — month/year + Pace pill ────────────────────── */}
      <div className="flex h-16 items-center justify-between">
        <div className="flex items-baseline" style={{ gap: '14px', fontFeatureSettings: "'tnum'" }}>
          <span
            className="font-display text-[44px] font-semibold leading-none text-[#1A1A1A]"
            style={{ letterSpacing: '-0.02em' }}
          >
            {monthName}
          </span>
          <span
            className="font-display text-[44px] font-light leading-none text-[#1A1A1A]"
            style={{ opacity: 0.45, letterSpacing: 0 }}
          >
            {yearStr}
          </span>
        </div>

        {/* Pace vs STLY pill — disabled */}
        <button
          disabled
          title="Available once historical data is connected."
          className="cursor-not-allowed rounded-full border border-[#BFC8C8] px-[14px] py-1.5 font-sans text-[12px] text-[rgba(26,26,26,0.6)]"
        >
          Pace vs STLY
        </button>
      </div>

      {/* ── ROW 2: KPI strip — inline label + value pairs ───────────────────── */}
      <div className="flex h-9 items-center" style={{ gap: '28px' }}>
        <KpiItem label="OCC"    value={isLoading ? '—' : fmtPct(kpis?.occupancyPct ?? 0)} />
        <KpiItem label="ADR"    value={isLoading ? '—' : fmtEur(kpis?.adr ?? 0)} />
        <KpiItem label="REVPAR" value={isLoading ? '—' : fmtEur(kpis?.revpar ?? 0)} />
        <KpiItem label="REV"    value={isLoading ? '—' : fmtEur(kpis?.totalRevenue ?? 0)} />
        <KpiItem label="ALOS"   value={isLoading ? '—' : (kpis?.alos ?? 0).toFixed(1)} />
        <div className="ml-auto">
          <KpiItem label="LEAD" value={isLoading ? '—' : `${Math.round(kpis?.avgLeadTime ?? 0)}d`} />
        </div>
      </div>

      {/* ── ROW 3: Controls — tabs left, nav + room type right ──────────────── */}
      <div className="flex h-11 items-center justify-between">
        {/* Tabs */}
        <div className="flex items-center" style={{ gap: '28px' }}>
          <TabButton label="OCCUPANCY" active={viewMode === 'occupancy'} onClick={() => onViewModeChange('occupancy')} />
          <TabButton label="ADR"       active={viewMode === 'adr'}       onClick={() => onViewModeChange('adr')} />
          <button
            disabled
            title="Available once future bookings are tracked"
            className="cursor-not-allowed font-sans text-[13px] font-medium uppercase tracking-[0.12em] text-[rgba(26,26,26,0.3)]"
          >
            PICKUP
          </button>
        </div>

        {/* Nav arrows + room type pills */}
        <div className="flex items-center gap-4">
          {/* Month nav */}
          <div className="flex items-center gap-1">
            <button
              onClick={onPrevMonth}
              aria-label="Previous month"
              className="flex h-8 w-8 items-center justify-center rounded border border-[#BFC8C8] text-[rgba(26,26,26,0.55)] transition-colors hover:border-[#0F3D3E] hover:text-[#1A1A1A]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={onNextMonth}
              aria-label="Next month"
              className="flex h-8 w-8 items-center justify-center rounded border border-[#BFC8C8] text-[rgba(26,26,26,0.55)] transition-colors hover:border-[#0F3D3E] hover:text-[#1A1A1A]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Room type filter pills */}
          <div className="flex items-center gap-4">
            <RoomTypePill label="All" active={selectedRoomTypeId === null} onClick={() => onRoomTypeChange(null)} />
            {roomTypes.map((rt) => (
              <RoomTypePill
                key={rt.id}
                label={rt.name}
                active={selectedRoomTypeId === rt.id}
                onClick={() => onRoomTypeChange(rt.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function KpiItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline" style={{ gap: '8px' }}>
      <span
        className="font-sans text-[9px] uppercase text-[rgba(26,26,26,0.5)]"
        style={{ letterSpacing: '0.18em' }}
      >
        {label}
      </span>
      <span
        className="font-display text-[20px] font-semibold tabular-nums text-[#1A1A1A]"
        style={{ letterSpacing: '-0.02em', fontFeatureSettings: "'tnum'" }}
      >
        {value}
      </span>
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
        'relative pb-2 font-sans text-[13px] font-medium uppercase tracking-[0.12em] transition-colors',
        active ? 'text-[#1A1A1A]' : 'text-[rgba(26,26,26,0.5)] hover:text-[#1A1A1A]'
      )}
    >
      {label}
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C9A227]" />
      )}
    </button>
  )
}

function RoomTypePill({
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
        'relative pb-2 font-sans text-[11px] font-medium uppercase tracking-[0.12em] transition-colors',
        active ? 'text-[#1A1A1A]' : 'text-[rgba(26,26,26,0.5)] hover:text-[#1A1A1A]'
      )}
    >
      {label}
      {active && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C9A227]" />
      )}
    </button>
  )
}
