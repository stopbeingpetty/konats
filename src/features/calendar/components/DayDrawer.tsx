import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { X } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
} from '@/components/ui/sheet'
import {
  computeHybridDayMetrics,
  computePickup,
  type PickupWindowDays,
} from '@/features/calendar/lib/metrics'
import { useDayReservations, useDayOccupancyOverrides } from '@/features/calendar/hooks/useDayDetail'
import type { Reservation, RoomInventory, RoomType } from '@/types/database'

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

function fmtDayOfWeek(dateStr: string): string {
  return format(parseISO(dateStr), 'EEEE').toUpperCase()
}

function fmtDayAndMonth(dateStr: string): string {
  return format(parseISO(dateStr), 'd MMMM yyyy')
}

function fmtShortDate(dateStr: string): string {
  return format(parseISO(dateStr), 'dd.MM.yyyy')
}

// ============================================================================
// Props
// ============================================================================

interface DayDrawerProps {
  open: boolean
  onClose: () => void
  /** YYYY-MM-DD */
  date: string
  monthReservations: Reservation[]
  inventory: RoomInventory[]
  roomTypes: RoomType[]
  selectedRoomTypeId: string | null
}

// ============================================================================
// Component
// ============================================================================

const PICKUP_WINDOWS: PickupWindowDays[] = [1, 3, 7, 14]
const PICKUP_LABELS: Record<PickupWindowDays, string> = { 1: '24H', 3: '3D', 7: '7D', 14: '14D' }

export function DayDrawer({
  open,
  onClose,
  date,
  monthReservations,
  inventory,
  roomTypes,
  selectedRoomTypeId,
}: DayDrawerProps) {
  const { data: dayReservations = [], isLoading: resLoading } = useDayReservations(open ? date : null)
  const { data: dayOverrides = [], isLoading: ovLoading } = useDayOccupancyOverrides(open ? date : null)
  const isLoading = resLoading || ovLoading

  const filteredRoomTypes = selectedRoomTypeId
    ? roomTypes.filter((rt) => rt.id === selectedRoomTypeId)
    : roomTypes

  const dayMetrics = useMemo(
    () => computeHybridDayMetrics(date, dayReservations, filteredRoomTypes, inventory, dayOverrides),
    [date, dayReservations, filteredRoomTypes, inventory, dayOverrides]
  )

  const perTypeMetrics = useMemo(
    () =>
      filteredRoomTypes.map((rt) => ({
        rt,
        metrics: computeHybridDayMetrics(date, dayReservations, [rt], inventory, dayOverrides),
      })),
    [date, dayReservations, filteredRoomTypes, inventory, dayOverrides]
  )

  const refDate = useMemo(() => new Date(), [])
  const pickupCounts = useMemo(
    () =>
      PICKUP_WINDOWS.reduce(
        (acc, w) => {
          acc[w] = computePickup(date, monthReservations, w, refDate)
          return acc
        },
        {} as Record<PickupWindowDays, number>
      ),
    [date, monthReservations, refDate]
  )

  const allPickupZero = PICKUP_WINDOWS.every((w) => pickupCounts[w] === 0)

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-[min(480px,100vw)] max-w-none overflow-y-auto border-l border-[#D8DEDE] bg-[#F0F4F4] p-0 text-[#1A1A1A] shadow-none"
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="relative border-b border-[#D8DEDE] px-8 pb-6 pt-8">
          <button
            onClick={onClose}
            className="absolute right-6 top-6 text-[rgba(26,26,26,0.5)] transition-colors hover:text-[#1A1A1A]"
            aria-label="Close"
          >
            <X className="h-[18px] w-[18px]" />
          </button>

          <div
            className="font-display text-[28px] font-bold leading-none text-[#1A1A1A]"
            style={{ letterSpacing: '-0.01em' }}
          >
            {fmtDayOfWeek(date)}
          </div>
          <div
            className="mt-0.5 font-display text-[28px] font-light leading-none text-[#1A1A1A]"
            style={{ letterSpacing: '-0.01em' }}
          >
            {fmtDayAndMonth(date)}
          </div>
        </div>

        <div className="px-8">
          {/* ── KPI strip ─────────────────────────────────────────────────── */}
          <div className="border-b border-[#D8DEDE] py-6">
            <div className="grid grid-cols-4" style={{ gap: '24px' }}>
              <DrawerKpi label="OCCUPANCY" value={fmtPct(dayMetrics.occupancyPct)} />
              <DrawerKpi label="ADR" value={fmtEur(dayMetrics.adr)} />
              <DrawerKpi label="REVPAR" value={fmtEur(dayMetrics.revpar)} />
              <DrawerKpi label="REVENUE" value={fmtEur(dayMetrics.roomRevenue)} />
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-4 py-6">
              <Skeleton className="h-24 bg-[#D8DEDE]" />
              <Skeleton className="h-16 bg-[#D8DEDE]" />
            </div>
          ) : (
            <>
              {/* ── By Room Type ─────────────────────────────────────────── */}
              {filteredRoomTypes.length > 1 && (
                <div className="border-b border-[#D8DEDE] py-6">
                  <SectionLabel>BY ROOM TYPE</SectionLabel>
                  <div className="mt-3">
                    <div className="mb-2 grid grid-cols-4">
                      <ColHeader>Type</ColHeader>
                      <ColHeader align="right">Occ</ColHeader>
                      <ColHeader align="right">ADR</ColHeader>
                      <ColHeader align="right">Revenue</ColHeader>
                    </div>
                    {perTypeMetrics.map(({ rt, metrics: m }) => (
                      <div
                        key={rt.id}
                        className="grid h-9 grid-cols-4 items-center border-t border-[#D8DEDE]"
                      >
                        <span className="font-display text-[14px] font-medium text-[#1A1A1A]">
                          {rt.name}
                        </span>
                        <span className="text-right font-sans text-[13px] tabular-nums text-[rgba(26,26,26,0.7)]">
                          {fmtPct(m.occupancyPct)}
                        </span>
                        <span
                          className="text-right font-display text-[13px] font-bold tabular-nums text-[#C9A227]"
                          style={{ letterSpacing: '-0.01em', fontFeatureSettings: "'tnum'" }}
                        >
                          {fmtEur(m.adr)}
                        </span>
                        <span className="text-right font-sans text-[13px] tabular-nums text-[rgba(26,26,26,0.7)]">
                          {fmtEur(m.roomRevenue)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Pickup ───────────────────────────────────────────────── */}
              <div className="border-b border-[#D8DEDE] py-6">
                <SectionLabel>PICKUP — NEW BOOKINGS</SectionLabel>
                <div className="mt-3 grid grid-cols-4">
                  {PICKUP_WINDOWS.map((w) => (
                    <div key={w} className={allPickupZero ? 'opacity-30' : ''}>
                      <div
                        className="font-sans text-[9px] uppercase text-[rgba(26,26,26,0.45)]"
                        style={{ letterSpacing: '0.18em' }}
                      >
                        {PICKUP_LABELS[w]}
                      </div>
                      <div
                        className="mt-1 font-display text-[20px] font-bold tabular-nums text-[#1A1A1A]"
                        style={{ letterSpacing: '-0.01em', fontFeatureSettings: "'tnum'" }}
                      >
                        {pickupCounts[w]}
                      </div>
                    </div>
                  ))}
                </div>
                {allPickupZero && (
                  <p className="mt-3 font-sans text-[11px] text-[rgba(26,26,26,0.4)]">
                    — no pickup signal yet. Available once future bookings are tracked.
                  </p>
                )}
              </div>

              {/* ── Reservations ─────────────────────────────────────────── */}
              <div className="py-6">
                <SectionLabel>RESERVATIONS ({dayReservations.length})</SectionLabel>
                {dayReservations.length === 0 ? (
                  <p className="mt-3 font-sans text-[13px] text-[rgba(26,26,26,0.45)]">
                    No active reservations for this date.
                  </p>
                ) : (
                  <div className="mt-3">
                    {dayReservations.map((r) => {
                      const roomTypeName =
                        roomTypes.find((rt) => rt.id === r.room_type_id)?.name ?? r.room_type_id
                      return (
                        <div
                          key={r.id}
                          className="flex items-center justify-between border-t border-[#D8DEDE] py-[14px]"
                        >
                          <div>
                            <div className="font-display text-[15px] font-medium text-[#1A1A1A]">
                              {r.guest_name ?? 'Guest'}
                            </div>
                            <div className="mt-0.5 font-sans text-[11px] text-[rgba(26,26,26,0.5)]">
                              {roomTypeName}
                              <span className="mx-1.5">·</span>
                              {fmtShortDate(r.check_in_date)} – {fmtShortDate(r.check_out_date)}
                              <span className="mx-1.5">·</span>
                              {r.channel}
                              {r.rooms_count > 1 && (
                                <span className="ml-1">× {r.rooms_count} rooms</span>
                              )}
                            </div>
                          </div>
                          <span
                            className="ml-4 font-display text-[16px] font-bold tabular-nums text-[#C9A227]"
                            style={{ letterSpacing: '-0.01em', fontFeatureSettings: "'tnum'" }}
                          >
                            {fmtEur(r.adr)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function DrawerKpi({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="font-sans text-[9px] uppercase text-[rgba(26,26,26,0.4)]"
        style={{ letterSpacing: '0.18em' }}
      >
        {label}
      </div>
      <div
        className="mt-1 font-display text-[22px] font-bold leading-none tabular-nums text-[#1A1A1A]"
        style={{ letterSpacing: '-0.01em', fontFeatureSettings: "'tnum'" }}
      >
        {value}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="font-sans text-[9px] uppercase text-[rgba(26,26,26,0.4)]"
      style={{ letterSpacing: '0.18em' }}
    >
      {children}
    </div>
  )
}

function ColHeader({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <div
      className={`font-sans text-[9px] uppercase text-[rgba(26,26,26,0.4)] ${align === 'right' ? 'text-right' : ''}`}
      style={{ letterSpacing: '0.18em' }}
    >
      {children}
    </div>
  )
}
