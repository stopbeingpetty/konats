import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  computeDayMetrics,
  computePickup,
  computeAvgLeadTimeForDate,
  type PickupWindowDays,
} from '@/features/calendar/lib/metrics'
import { useDayReservations } from '@/features/calendar/hooks/useDayDetail'
import type { Reservation, RoomInventory, RoomType } from '@/types/database'

// ============================================================================
// Formatting helpers (drawer-local)
// ============================================================================

function fmtEur(amount: number): string {
  return (
    '\u20ac\u00a0' +
    new Intl.NumberFormat('hr-HR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  )
}

function fmtDate(dateStr: string): string {
  return format(parseISO(dateStr), 'EEEE, d MMMM yyyy')
}

function fmtShortDate(dateStr: string): string {
  return format(parseISO(dateStr), 'dd.MM.yyyy')
}

function fmtPct(pct: number): string {
  return `${Math.round(pct)}%`
}

// ============================================================================
// Channel mix
// ============================================================================

interface ChannelStat {
  channel: string
  count: number
  pct: number
}

function computeChannelMix(reservations: Reservation[]): ChannelStat[] {
  const counts = new Map<string, number>()
  for (const r of reservations) {
    counts.set(r.channel, (counts.get(r.channel) ?? 0) + 1)
  }
  const total = reservations.length
  return Array.from(counts.entries())
    .map(([channel, count]) => ({
      channel,
      count,
      pct: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

// ============================================================================
// Props
// ============================================================================

interface DayDrawerProps {
  open: boolean
  onClose: () => void
  /** YYYY-MM-DD */
  date: string
  /** All active reservations in the displayed month (for pickup computation) */
  monthReservations: Reservation[]
  inventory: RoomInventory[]
  roomTypes: RoomType[]
  selectedRoomTypeId: string | null
}

// ============================================================================
// Component
// ============================================================================

const PICKUP_WINDOWS: PickupWindowDays[] = [1, 3, 7, 14]
const PICKUP_LABELS: Record<PickupWindowDays, string> = { 1: '24h', 3: '3d', 7: '7d', 14: '14d' }

export function DayDrawer({
  open,
  onClose,
  date,
  monthReservations,
  inventory,
  roomTypes,
  selectedRoomTypeId,
}: DayDrawerProps) {
  const { data: dayReservations = [], isLoading } = useDayReservations(open ? date : null)

  const filteredRoomTypes = selectedRoomTypeId
    ? roomTypes.filter((rt) => rt.id === selectedRoomTypeId)
    : roomTypes

  // Day-level aggregate metrics
  const dayMetrics = useMemo(
    () => computeDayMetrics(date, dayReservations, filteredRoomTypes, inventory),
    [date, dayReservations, filteredRoomTypes, inventory]
  )

  // Per-room-type metrics
  const perTypeMetrics = useMemo(
    () =>
      filteredRoomTypes.map((rt) => ({
        rt,
        metrics: computeDayMetrics(date, dayReservations, [rt], inventory),
      })),
    [date, dayReservations, filteredRoomTypes, inventory]
  )

  // Pickup counts — computed from month reservations (no extra fetch)
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

  const avgLeadTime = useMemo(
    () => computeAvgLeadTimeForDate(date, dayReservations),
    [date, dayReservations]
  )

  const channelMix = useMemo(() => computeChannelMix(dayReservations), [dayReservations])

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="w-[min(560px,95vw)] max-w-none overflow-y-auto border-[#2D5A3D] bg-[#0d1a10] p-0 text-white"
      >
        <SheetHeader className="border-b border-[#2D5A3D] px-5 py-4">
          <SheetTitle className="font-['Rajdhani'] text-xl font-bold text-white">
            {fmtDate(date)}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-5 px-5 py-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="Occupancy" value={fmtPct(dayMetrics.occupancyPct)} />
            <KpiCard label="ADR" value={fmtEur(dayMetrics.adr)} />
            <KpiCard label="RevPAR" value={fmtEur(dayMetrics.revpar)} />
            <KpiCard label="Revenue" value={fmtEur(dayMetrics.roomRevenue)} />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-32 bg-[#1a2f20]" />
              <Skeleton className="h-24 bg-[#1a2f20]" />
            </div>
          ) : (
            <>
              {/* Per room type breakdown */}
              {filteredRoomTypes.length > 1 && (
                <Section title="By Room Type">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#2D5A3D] text-left text-[11px] uppercase tracking-wider text-gray-500">
                        <th className="pb-1.5">Type</th>
                        <th className="pb-1.5 text-right">Occ</th>
                        <th className="pb-1.5 text-right">ADR</th>
                        <th className="pb-1.5 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perTypeMetrics.map(({ rt, metrics: m }) => (
                        <tr key={rt.id} className="border-b border-[#1a2a1f] last:border-0">
                          <td className="py-1.5 text-gray-300">{rt.name}</td>
                          <td className="py-1.5 text-right text-gray-300">{fmtPct(m.occupancyPct)}</td>
                          <td className="py-1.5 text-right text-gray-300">{fmtEur(m.adr)}</td>
                          <td className="py-1.5 text-right text-gray-300">{fmtEur(m.roomRevenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Section>
              )}

              {/* Pickup */}
              <Section title="Pickup — New Bookings">
                <div className="grid grid-cols-4 gap-2">
                  {PICKUP_WINDOWS.map((w) => (
                    <div key={w} className="rounded bg-[#1a2f20] p-2 text-center">
                      <div className="text-[11px] uppercase tracking-wider text-gray-500">
                        {PICKUP_LABELS[w]}
                      </div>
                      <div className="mt-0.5 text-lg font-bold text-white">{pickupCounts[w]}</div>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Lead time */}
              <Section title="Avg Lead Time">
                <p className="text-lg font-medium text-gray-200">
                  {Math.round(avgLeadTime)} days
                </p>
              </Section>

              {/* Channel mix */}
              {channelMix.length > 0 && (
                <Section title="Channel Mix">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[#2D5A3D] text-left text-[11px] uppercase tracking-wider text-gray-500">
                        <th className="pb-1.5">Channel</th>
                        <th className="pb-1.5 text-right">Bookings</th>
                        <th className="pb-1.5 text-right">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {channelMix.map((c) => (
                        <tr key={c.channel} className="border-b border-[#1a2a1f] last:border-0">
                          <td className="py-1.5 text-gray-300">{c.channel}</td>
                          <td className="py-1.5 text-right text-gray-300">{c.count}</td>
                          <td className="py-1.5 text-right text-gray-400">{Math.round(c.pct)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Section>
              )}

              {/* Reservations list */}
              <Section title={`Reservations (${dayReservations.length})`}>
                {dayReservations.length === 0 ? (
                  <p className="text-sm text-gray-500">No active reservations for this date.</p>
                ) : (
                  <div className="space-y-1.5">
                    {dayReservations.map((r) => {
                      const roomTypeName =
                        roomTypes.find((rt) => rt.id === r.room_type_id)?.name ?? r.room_type_id
                      return (
                        <div
                          key={r.id}
                          className="rounded border border-[#2D5A3D]/50 bg-[#111d14] px-3 py-2 text-sm"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="font-medium text-white">
                                {r.guest_name ?? 'Guest'}
                              </span>
                              <span className="ml-2 text-xs text-gray-500">{roomTypeName}</span>
                            </div>
                            <span className="font-medium text-[#C9A227]">{fmtEur(r.adr)}</span>
                          </div>
                          <div className="mt-0.5 text-xs text-gray-500">
                            {fmtShortDate(r.check_in_date)} – {fmtShortDate(r.check_out_date)}
                            <span className="mx-1.5">·</span>
                            {r.channel}
                            {r.rooms_count > 1 && (
                              <span className="ml-1.5 text-gray-600">× {r.rooms_count} rooms</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </Section>
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

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[#2D5A3D]/50 bg-[#111d14] px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-0.5 font-medium text-white">{value}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
        {title}
      </h3>
      {children}
    </div>
  )
}
