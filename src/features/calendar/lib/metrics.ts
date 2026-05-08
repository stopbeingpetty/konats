import { format, endOfMonth } from 'date-fns'

// ============================================================================
// Input types — minimal, no Supabase dependency, pure domain shapes
// ============================================================================

export interface MetricsReservation {
  id: string
  /** YYYY-MM-DD */
  check_in_date: string
  /** YYYY-MM-DD */
  check_out_date: string
  /** YYYY-MM-DD */
  booked_date: string
  rooms_count: number
  /** Per room per night (generated column) */
  adr: number
  nights: number
  /** check_in_date - booked_date in days */
  booking_window: number
  channel: string
  room_type_id: string
}

export interface MetricsRoomType {
  id: string
  default_room_count: number
}

export interface MetricsInventoryRow {
  /** YYYY-MM-DD */
  date: string
  room_type_id: string
  total_rooms: number
}

export interface MetricsOccupancyOverride {
  /** YYYY-MM-DD */
  date: string
  room_type_id: string
  sold_rooms: number
  capacity: number
}

export interface MetricsReservationCount {
  room_type_id: string
  sold_rooms: number
}

/**
 * Minimal shape needed for pickup computation.
 * The full Reservation type from database.ts structurally satisfies this.
 */
export interface PickupReservation {
  source: string
  check_in_date: string
  check_out_date: string
  booked_date: string
  rooms_count: number
  status: string
  deleted_at: string | null
}

// ============================================================================
// Output types
// ============================================================================

export interface DayMetrics {
  totalRooms: number
  soldRooms: number
  freeRooms: number
  /** 0–100 */
  occupancyPct: number
  /** Revenue per sold room per night */
  adr: number
  /** Revenue per available room */
  revpar: number
  roomRevenue: number
}

export interface MonthKpis {
  occupancyPct: number
  adr: number
  revpar: number
  totalRevenue: number
  /** Average Length of Stay */
  alos: number
  /** Average booking_window across all reservations in the month */
  avgLeadTime: number
  pickup: Record<PickupWindowDays, number>
}

/** Supported pickup window sizes in days */
export type PickupWindowDays = 1 | 3 | 7 | 14

// ============================================================================
// Occupancy source resolution
// ============================================================================

/**
 * Returns the effective sold room count for a given date + room type.
 * Prefers override data when a matching row exists in overrideRows;
 * falls back to the pre-computed reservation-derived counts otherwise.
 *
 * @param date          YYYY-MM-DD
 * @param roomTypeId    UUID of the room type
 * @param overrideRows  Rows from daily_occupancy_override for the relevant period
 * @param reservationCounts  Reservation-derived sold counts for all room types on this date
 */
export function getEffectiveOccupancy(
  date: string,
  roomTypeId: string,
  overrideRows: MetricsOccupancyOverride[],
  reservationCounts: MetricsReservationCount[]
): { soldRooms: number; capacity: number | null; fromOverride: boolean } {
  const override = overrideRows.find(
    (o) => o.date === date && o.room_type_id === roomTypeId
  )
  if (override !== undefined) {
    return { soldRooms: override.sold_rooms, capacity: override.capacity, fromOverride: true }
  }
  const fallback = reservationCounts.find((c) => c.room_type_id === roomTypeId)
  return { soldRooms: fallback?.sold_rooms ?? 0, capacity: null, fromOverride: false }
}

// ============================================================================
// Internal helpers
// ============================================================================

function pickupCutoffStr(refDate: Date, windowDays: PickupWindowDays): string {
  const cutoff = new Date(refDate.getTime() - windowDays * 24 * 60 * 60 * 1000)
  return format(cutoff, 'yyyy-MM-dd')
}

function availableRoomsForDate(
  date: string,
  roomTypes: MetricsRoomType[],
  inventory: MetricsInventoryRow[]
): number {
  return roomTypes.reduce((sum, rt) => {
    const inv = inventory.find((i) => i.date === date && i.room_type_id === rt.id)
    return sum + (inv !== undefined ? inv.total_rooms : rt.default_room_count)
  }, 0)
}

// ============================================================================
// Core metric functions
// ============================================================================

/**
 * Compute day metrics with daily_occupancy_override support.
 *
 * For each room type:
 *   - sold count: from override row when present, else from reservations
 *   - capacity:   from override.capacity when present, else from inventory/default
 *
 * Revenue and ADR denominator always come from reservations — override affects
 * counts only, not rate data.  RevPAR = (effective_sold × ADR) / effective_capacity,
 * which equals ADR × occupancy%.
 *
 * When overrides is empty this produces identical results to computeDayMetrics.
 */
export function computeHybridDayMetrics(
  date: string,
  reservations: MetricsReservation[],
  roomTypes: MetricsRoomType[],
  inventory: MetricsInventoryRow[] = [],
  overrides: MetricsOccupancyOverride[] = []
): DayMetrics {
  const roomTypeIds = new Set(roomTypes.map((rt) => rt.id))
  const staying = reservations.filter(
    (r) =>
      r.check_in_date <= date &&
      r.check_out_date > date &&
      roomTypeIds.has(r.room_type_id)
  )

  // Revenue always from reservations (scoped to the requested room types)
  const roomRevenue = staying.reduce((sum, r) => sum + r.adr * r.rooms_count, 0)
  // ADR denominator: reservation-based sold rooms (not override count)
  const resSoldTotal = staying.reduce((sum, r) => sum + r.rooms_count, 0)

  let totalRooms = 0
  let soldRooms = 0

  for (const rt of roomTypes) {
    const override = overrides.find((o) => o.date === date && o.room_type_id === rt.id)

    if (override !== undefined) {
      totalRooms += override.capacity
      soldRooms += override.sold_rooms
    } else {
      const inv = inventory.find((i) => i.date === date && i.room_type_id === rt.id)
      totalRooms += inv !== undefined ? inv.total_rooms : rt.default_room_count
      soldRooms += staying
        .filter((r) => r.room_type_id === rt.id)
        .reduce((sum, r) => sum + r.rooms_count, 0)
    }
  }

  const adr = resSoldTotal > 0 ? roomRevenue / resSoldTotal : 0
  const occupancyPct = totalRooms > 0 ? (soldRooms / totalRooms) * 100 : 0
  // RevPAR = ADR × occupancy% (spec: override_sold × ADR / override_capacity)
  const revpar = totalRooms > 0 ? (soldRooms * adr) / totalRooms : 0

  return {
    totalRooms,
    soldRooms,
    freeRooms: Math.max(0, totalRooms - soldRooms),
    occupancyPct,
    adr,
    revpar,
    roomRevenue,
  }
}

/**
 * Compute day metrics from raw data.
 * Caller must pre-filter reservations: active only (no deleted, no cancelled/no_show).
 * Inventory overrides default_room_count (OOO rooms respected).
 */
export function computeDayMetrics(
  date: string,
  reservations: MetricsReservation[],
  roomTypes: MetricsRoomType[],
  inventory: MetricsInventoryRow[] = []
): DayMetrics {
  const totalRooms = availableRoomsForDate(date, roomTypes, inventory)

  const staying = reservations.filter(
    (r) => r.check_in_date <= date && r.check_out_date > date
  )

  const soldRooms = staying.reduce((sum, r) => sum + r.rooms_count, 0)
  const roomRevenue = staying.reduce((sum, r) => sum + r.adr * r.rooms_count, 0)
  const adr = soldRooms > 0 ? roomRevenue / soldRooms : 0
  const occupancyPct = totalRooms > 0 ? (soldRooms / totalRooms) * 100 : 0
  const revpar = totalRooms > 0 ? roomRevenue / totalRooms : 0

  return {
    totalRooms,
    soldRooms,
    freeRooms: Math.max(0, totalRooms - soldRooms),
    occupancyPct,
    adr,
    revpar,
    roomRevenue,
  }
}

/**
 * Aggregate daily_occupancy view rows for one stay date across room types.
 * Returns zero metrics for empty input (month with no reservations).
 */
export function aggregateDayRows(
  rows: Array<{ total_rooms: number; sold_rooms: number; room_revenue: number }>
): DayMetrics {
  if (rows.length === 0) {
    return {
      totalRooms: 0,
      soldRooms: 0,
      freeRooms: 0,
      occupancyPct: 0,
      adr: 0,
      revpar: 0,
      roomRevenue: 0,
    }
  }

  const totalRooms = rows.reduce((s, r) => s + r.total_rooms, 0)
  const soldRooms = rows.reduce((s, r) => s + r.sold_rooms, 0)
  const roomRevenue = rows.reduce((s, r) => s + Number(r.room_revenue), 0)
  const occupancyPct = totalRooms > 0 ? (soldRooms / totalRooms) * 100 : 0
  const adr = soldRooms > 0 ? roomRevenue / soldRooms : 0
  const revpar = totalRooms > 0 ? roomRevenue / totalRooms : 0

  return {
    totalRooms,
    soldRooms,
    freeRooms: Math.max(0, totalRooms - soldRooms),
    occupancyPct,
    adr,
    revpar,
    roomRevenue,
  }
}

/**
 * Count pickup (new bookings) for a specific stay date within a window.
 * Spec: count reservations where booked_date >= refDate - window AND check_in_date <= stayDate < check_out_date.
 * Reservations must be pre-filtered: active only.
 */
export function computePickup(
  stayDate: string,
  reservations: MetricsReservation[],
  windowDays: PickupWindowDays,
  refDate: Date
): number {
  const cutoff = pickupCutoffStr(refDate, windowDays)
  return reservations.filter(
    (r) =>
      r.booked_date >= cutoff &&
      r.check_in_date <= stayDate &&
      r.check_out_date > stayDate
  ).length
}

/**
 * Count new bookings for the entire month within a window.
 * Counts distinct reservations with at least one night in the month.
 */
export function computeMonthPickup(
  year: number,
  month: number,
  reservations: MetricsReservation[],
  windowDays: PickupWindowDays,
  refDate: Date
): number {
  const cutoff = pickupCutoffStr(refDate, windowDays)
  const monthFirstDay = new Date(year, month - 1, 1)
  const monthStart = format(monthFirstDay, 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(monthFirstDay), 'yyyy-MM-dd')

  return reservations.filter(
    (r) =>
      r.booked_date >= cutoff &&
      r.check_in_date <= monthEnd &&
      r.check_out_date > monthStart
  ).length
}

/**
 * Average Length of Stay across the given reservations.
 * Returns 0 for empty input.
 */
export function computeALOS(reservations: MetricsReservation[]): number {
  if (reservations.length === 0) return 0
  return reservations.reduce((sum, r) => sum + r.nights, 0) / reservations.length
}

/**
 * Average lead time (booking_window) for reservations staying on a specific date.
 * Returns 0 if no reservations are staying that night.
 */
export function computeAvgLeadTimeForDate(
  stayDate: string,
  reservations: MetricsReservation[]
): number {
  const staying = reservations.filter(
    (r) => r.check_in_date <= stayDate && r.check_out_date > stayDate
  )
  if (staying.length === 0) return 0
  return staying.reduce((sum, r) => sum + r.booking_window, 0) / staying.length
}

/**
 * Average lead time across all passed reservations.
 * Returns 0 for empty input.
 */
export function computeAvgLeadTime(reservations: MetricsReservation[]): number {
  if (reservations.length === 0) return 0
  return reservations.reduce((sum, r) => sum + r.booking_window, 0) / reservations.length
}

/**
 * Count picked-up rooms for a specific stay-date within a window.
 * KEY: excludes laserline_legacy reservations (their booked_date is artificial).
 * Sums rooms_count (not reservation row count).
 *
 * @param date        YYYY-MM-DD stay date
 * @param windowDays  lookback window in days (e.g. 1, 3, 7, 14)
 * @param reservations  full reservations array (pre-filtering NOT required)
 * @param refDate     reference "today" — defaults to new Date()
 */
export function computePickupForDate(
  date: string,
  windowDays: number,
  reservations: PickupReservation[],
  refDate: Date = new Date()
): number {
  const cutoff = format(
    new Date(refDate.getTime() - windowDays * 24 * 60 * 60 * 1000),
    'yyyy-MM-dd'
  )
  return reservations
    .filter(
      (r) =>
        r.source !== 'laserline_legacy' &&
        r.deleted_at === null &&
        (r.status === 'confirmed' ||
          r.status === 'checked_in' ||
          r.status === 'checked_out') &&
        r.check_in_date <= date &&
        r.check_out_date > date &&
        r.booked_date >= cutoff
    )
    .reduce((sum, r) => sum + r.rooms_count, 0)
}

/**
 * Total picked-up rooms for the entire month within a window.
 * Counts a reservation once if any stay-night falls in the month.
 * Excludes laserline_legacy reservations.
 *
 * @param year       calendar year
 * @param month      1-based month
 * @param reservations  full reservations array (pre-filtering NOT required)
 * @param windowDays lookback window in days
 * @param refDate    reference "today" — defaults to new Date()
 */
export function computeMonthPickupFiltered(
  year: number,
  month: number,
  reservations: PickupReservation[],
  windowDays: number,
  refDate: Date = new Date()
): number {
  const cutoff = format(
    new Date(refDate.getTime() - windowDays * 24 * 60 * 60 * 1000),
    'yyyy-MM-dd'
  )
  const monthFirstDay = new Date(year, month - 1, 1)
  const monthStart = format(monthFirstDay, 'yyyy-MM-dd')
  const monthEnd = format(endOfMonth(monthFirstDay), 'yyyy-MM-dd')

  return reservations
    .filter(
      (r) =>
        r.source !== 'laserline_legacy' &&
        r.deleted_at === null &&
        (r.status === 'confirmed' ||
          r.status === 'checked_in' ||
          r.status === 'checked_out') &&
        r.booked_date >= cutoff &&
        r.check_in_date <= monthEnd &&
        r.check_out_date > monthStart
    )
    .reduce((sum, r) => sum + r.rooms_count, 0)
}

/**
 * Compute all month-level KPIs from per-day metrics + raw reservations.
 * dailyMetrics: array of DayMetrics for each day in the month (from computeDayMetrics or aggregateDayRows).
 * reservations: active reservations with stay in the month.
 *
 * ADR uses reservation room-nights as denominator (not override-inflated dailyMetrics.soldRooms).
 * Override data inflates sold counts for occupancy/RevPAR purposes (it includes groups and
 * pre-arrival stays not yet in the reservations table), so using it as an ADR denominator
 * produces artificially low ADR values. Revenue always comes from reservations only, so the
 * denominator must also be reservation-based to produce a meaningful average rate.
 *
 * Cross-month reservations are clipped to the month boundary so a 10-night stay that overlaps
 * by 2 nights contributes only 2 room-nights to the denominator.
 *
 * RevPAR uses total capacity (override-aware) so it correctly reflects utilisation of all rooms.
 * Occupancy % is unchanged — it uses the hybrid (override-aware) sold count.
 */
export function computeMonthKpis(
  year: number,
  month: number,
  dailyMetrics: DayMetrics[],
  reservations: MetricsReservation[],
  refDate: Date
): MonthKpis {
  const totalSold = dailyMetrics.reduce((s, d) => s + d.soldRooms, 0)
  const totalAvailable = dailyMetrics.reduce((s, d) => s + d.totalRooms, 0)
  const totalRevenue = dailyMetrics.reduce((s, d) => s + d.roomRevenue, 0)

  const occupancyPct = totalAvailable > 0 ? (totalSold / totalAvailable) * 100 : 0

  // ADR denominator: reservation room-nights clipped to this month (not override-inflated sold).
  const monthStartStr = format(new Date(year, month - 1, 1), 'yyyy-MM-dd')
  const monthEndExclusive = format(new Date(year, month, 1), 'yyyy-MM-dd')
  let resSoldRoomNights = 0
  for (const r of reservations) {
    if (r.check_in_date >= monthEndExclusive || r.check_out_date <= monthStartStr) continue
    const effIn = r.check_in_date > monthStartStr ? r.check_in_date : monthStartStr
    const effOut = r.check_out_date < monthEndExclusive ? r.check_out_date : monthEndExclusive
    resSoldRoomNights +=
      ((new Date(effOut).getTime() - new Date(effIn).getTime()) / 86400000) * r.rooms_count
  }

  const adr = resSoldRoomNights > 0 ? totalRevenue / resSoldRoomNights : 0
  const revpar = totalAvailable > 0 ? totalRevenue / totalAvailable : 0

  const pickup: Record<PickupWindowDays, number> = {
    1: computeMonthPickup(year, month, reservations, 1, refDate),
    3: computeMonthPickup(year, month, reservations, 3, refDate),
    7: computeMonthPickup(year, month, reservations, 7, refDate),
    14: computeMonthPickup(year, month, reservations, 14, refDate),
  }

  return {
    occupancyPct,
    adr,
    revpar,
    totalRevenue,
    alos: computeALOS(reservations),
    avgLeadTime: computeAvgLeadTime(reservations),
    pickup,
  }
}
