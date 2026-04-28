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
 * Compute all month-level KPIs from per-day metrics + raw reservations.
 * dailyMetrics: array of DayMetrics for each day in the month (from computeDayMetrics or aggregateDayRows).
 * reservations: active reservations with stay in the month.
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
  const adr = totalSold > 0 ? totalRevenue / totalSold : 0
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
