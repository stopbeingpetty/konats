import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import type { MonthKpis } from '@/features/calendar/lib/metrics'
import type { RoomType } from '@/types/database'

// ============================================================================
// Formatting helpers
// ============================================================================

function fmtEur(amount: number, decimals = 0): string {
  return (
    '\u20ac\u00a0' +
    new Intl.NumberFormat('hr-HR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount)
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
}: MonthHeaderProps) {
  const monthLabel = format(new Date(year, month - 1, 1), 'MMMM yyyy')

  return (
    <div className="border-b border-[#2D5A3D] bg-[#0d1a10] px-6 py-4">
      {/* Row 1: month nav + room type toggle */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {/* Month navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={onPrevMonth}
            className="rounded p-1 text-gray-400 hover:bg-[#1a2f20] hover:text-white transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h1 className="w-40 text-center font-['Rajdhani'] text-xl font-bold text-white">
            {monthLabel}
          </h1>
          <button
            onClick={onNextMonth}
            className="rounded p-1 text-gray-400 hover:bg-[#1a2f20] hover:text-white transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Room type toggle */}
        <div className="flex overflow-hidden rounded-md border border-[#2D5A3D]">
          <RoomTypeButton
            label="All"
            active={selectedRoomTypeId === null}
            onClick={() => onRoomTypeChange(null)}
          />
          {roomTypes.map((rt) => (
            <RoomTypeButton
              key={rt.id}
              label={rt.name}
              active={selectedRoomTypeId === rt.id}
              onClick={() => onRoomTypeChange(rt.id)}
            />
          ))}
        </div>
      </div>

      {/* KPI strip */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full max-w-lg bg-[#1a2f20]" />
          <Skeleton className="h-4 w-full max-w-sm bg-[#1a2f20]" />
          <Skeleton className="h-4 w-full max-w-xs bg-[#1a2f20]" />
        </div>
      ) : monthKpis ? (
        <div className="space-y-1.5 text-sm">
          {/* Row: primary KPIs */}
          <div className="flex flex-wrap gap-4 text-gray-300">
            <KpiItem label="Occupancy" value={fmtPct(monthKpis.occupancyPct)} highlight />
            <KpiItem label="ADR" value={fmtEur(monthKpis.adr)} />
            <KpiItem label="RevPAR" value={fmtEur(monthKpis.revpar)} />
            <KpiItem label="Revenue" value={fmtEur(monthKpis.totalRevenue)} />
          </div>

          {/* Row: pickup */}
          <div className="flex flex-wrap gap-4 text-gray-400">
            <span className="text-gray-500">Pickup:</span>
            <KpiItem label="24h" value={String(monthKpis.pickup[1])} />
            <KpiItem label="3d" value={String(monthKpis.pickup[3])} />
            <KpiItem label="7d" value={String(monthKpis.pickup[7])} />
            <KpiItem label="14d" value={String(monthKpis.pickup[14])} />
          </div>

          {/* Row: ALOS + lead time + pace */}
          <div className="flex flex-wrap gap-4 text-gray-400">
            <KpiItem label="ALOS" value={`${monthKpis.alos.toFixed(1)} nights`} />
            <KpiItem label="Avg lead time" value={`${Math.round(monthKpis.avgLeadTime)} days`} />
            <span className="text-gray-600 italic">Pace vs STLY — awaiting historical data</span>
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function KpiItem({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="text-[11px] uppercase tracking-wider text-gray-500">{label}</span>
      <span className={cn('font-medium', highlight ? 'text-white' : 'text-gray-300')}>
        {value}
      </span>
    </span>
  )
}

function RoomTypeButton({
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
        'px-3 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-[#1A472A] text-white'
          : 'text-gray-400 hover:bg-[#1a2f20] hover:text-white'
      )}
    >
      {label}
    </button>
  )
}
