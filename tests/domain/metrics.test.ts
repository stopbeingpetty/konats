import { describe, it, expect } from 'vitest'
import {
  computeDayMetrics,
  aggregateDayRows,
  computePickup,
  computeMonthPickup,
  computeALOS,
  computeAvgLeadTimeForDate,
  computeAvgLeadTime,
  computeMonthKpis,
  type MetricsReservation,
  type MetricsRoomType,
  type MetricsInventoryRow,
} from '@/features/calendar/lib/metrics'

// ============================================================================
// Test data builders
// ============================================================================

let idCounter = 0
function makeRes(overrides: Partial<MetricsReservation> = {}): MetricsReservation {
  const checkIn = overrides.check_in_date ?? '2025-06-10'
  const checkOut = overrides.check_out_date ?? '2025-06-13'
  const nights =
    overrides.nights ??
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)
  return {
    id: `res-${++idCounter}`,
    check_in_date: checkIn,
    check_out_date: checkOut,
    booked_date: overrides.booked_date ?? '2025-05-01',
    rooms_count: 1,
    adr: 200,
    nights,
    booking_window: 40,
    channel: 'Direct',
    room_type_id: 'rt-1',
    ...overrides,
  }
}

function makeRoomType(overrides: Partial<MetricsRoomType> = {}): MetricsRoomType {
  return { id: 'rt-1', default_room_count: 10, ...overrides }
}

function makeInventory(overrides: Partial<MetricsInventoryRow> = {}): MetricsInventoryRow {
  return { date: '2025-06-10', room_type_id: 'rt-1', total_rooms: 10, ...overrides }
}

// Reference date: 2025-06-15 noon UTC
const REF_DATE = new Date('2025-06-15T12:00:00Z')

// ============================================================================
// computeDayMetrics
// ============================================================================

describe('computeDayMetrics', () => {
  it('returns zero metrics when no reservations', () => {
    const rt = makeRoomType({ default_room_count: 44 })
    const result = computeDayMetrics('2025-06-10', [], [rt])
    expect(result.totalRooms).toBe(44)
    expect(result.soldRooms).toBe(0)
    expect(result.freeRooms).toBe(44)
    expect(result.occupancyPct).toBe(0)
    expect(result.adr).toBe(0)
    expect(result.revpar).toBe(0)
    expect(result.roomRevenue).toBe(0)
  })

  it('calculates occupancy % correctly', () => {
    const rt = makeRoomType({ default_room_count: 40 })
    const res = makeRes({ check_in_date: '2025-06-10', check_out_date: '2025-06-13', rooms_count: 20, adr: 100 })
    const result = computeDayMetrics('2025-06-10', [res], [rt])
    expect(result.occupancyPct).toBe(50)
    expect(result.soldRooms).toBe(20)
    expect(result.freeRooms).toBe(20)
  })

  it('calculates ADR correctly', () => {
    const rt = makeRoomType({ default_room_count: 10 })
    // Two reservations: 2 rooms at €200 and 3 rooms at €300
    const r1 = makeRes({ rooms_count: 2, adr: 200 })
    const r2 = makeRes({ rooms_count: 3, adr: 300, id: 'res-alt' })
    const result = computeDayMetrics('2025-06-10', [r1, r2], [rt])
    // totalRevenue = 2*200 + 3*300 = 400+900 = 1300; soldRooms = 5
    expect(result.adr).toBeCloseTo(260, 2)
    expect(result.roomRevenue).toBeCloseTo(1300, 2)
  })

  it('calculates RevPAR correctly', () => {
    const rt = makeRoomType({ default_room_count: 20 })
    const res = makeRes({ rooms_count: 10, adr: 200 })
    const result = computeDayMetrics('2025-06-10', [res], [rt])
    // RevPAR = 10*200 / 20 = 100
    expect(result.revpar).toBeCloseTo(100, 2)
  })

  it('respects room_inventory OOO override (fewer available rooms)', () => {
    const rt = makeRoomType({ default_room_count: 10 })
    // 3 rooms OOO → 7 available
    const inv = makeInventory({ date: '2025-06-10', room_type_id: 'rt-1', total_rooms: 7 })
    const res = makeRes({ rooms_count: 7, adr: 150 })
    const result = computeDayMetrics('2025-06-10', [res], [rt], [inv])
    expect(result.totalRooms).toBe(7)
    expect(result.occupancyPct).toBe(100)
  })

  it('falls back to default_room_count when no inventory row for the date', () => {
    const rt = makeRoomType({ default_room_count: 10 })
    const inv = makeInventory({ date: '2025-06-11', room_type_id: 'rt-1', total_rooms: 5 })
    const result = computeDayMetrics('2025-06-10', [], [rt], [inv])
    // Inventory is for June 11, not June 10 → use default
    expect(result.totalRooms).toBe(10)
  })

  it('aggregates multiple room types', () => {
    const rt1 = makeRoomType({ id: 'rt-1', default_room_count: 20 })
    const rt2 = makeRoomType({ id: 'rt-2', default_room_count: 15 })
    const res = makeRes({ room_type_id: 'rt-1', rooms_count: 5, adr: 200 })
    const result = computeDayMetrics('2025-06-10', [res], [rt1, rt2])
    expect(result.totalRooms).toBe(35)
    expect(result.soldRooms).toBe(5)
    expect(result.occupancyPct).toBeCloseTo((5 / 35) * 100, 2)
  })

  it('handles reservation with multiple rooms (rooms_count > 1)', () => {
    const rt = makeRoomType({ default_room_count: 10 })
    const res = makeRes({ rooms_count: 3, adr: 300 })
    const result = computeDayMetrics('2025-06-10', [res], [rt])
    expect(result.soldRooms).toBe(3)
    expect(result.roomRevenue).toBeCloseTo(900, 2)
  })

  it('excludes reservations that checked out on the target date', () => {
    const rt = makeRoomType({ default_room_count: 10 })
    // Reservation: check_in = June 8, check_out = June 10 → does NOT stay on June 10
    const res = makeRes({ check_in_date: '2025-06-08', check_out_date: '2025-06-10' })
    const result = computeDayMetrics('2025-06-10', [res], [rt])
    expect(result.soldRooms).toBe(0)
  })

  it('excludes reservations checking in after the target date', () => {
    const rt = makeRoomType({ default_room_count: 10 })
    const res = makeRes({ check_in_date: '2025-06-11', check_out_date: '2025-06-14' })
    const result = computeDayMetrics('2025-06-10', [res], [rt])
    expect(result.soldRooms).toBe(0)
  })
})

// ============================================================================
// aggregateDayRows
// ============================================================================

describe('aggregateDayRows', () => {
  it('returns zero metrics for empty array', () => {
    const result = aggregateDayRows([])
    expect(result.totalRooms).toBe(0)
    expect(result.soldRooms).toBe(0)
    expect(result.occupancyPct).toBe(0)
    expect(result.adr).toBe(0)
    expect(result.revpar).toBe(0)
  })

  it('aggregates multiple room type rows', () => {
    const rows = [
      { total_rooms: 20, sold_rooms: 15, room_revenue: 3000 },
      { total_rooms: 15, sold_rooms: 10, room_revenue: 2500 },
    ]
    const result = aggregateDayRows(rows)
    expect(result.totalRooms).toBe(35)
    expect(result.soldRooms).toBe(25)
    expect(result.roomRevenue).toBeCloseTo(5500, 2)
    expect(result.occupancyPct).toBeCloseTo((25 / 35) * 100, 2)
    expect(result.adr).toBeCloseTo(5500 / 25, 2)
    expect(result.revpar).toBeCloseTo(5500 / 35, 2)
  })

  it('handles single room type row with 100% occupancy', () => {
    const rows = [{ total_rooms: 10, sold_rooms: 10, room_revenue: 2000 }]
    const result = aggregateDayRows(rows)
    expect(result.occupancyPct).toBe(100)
    expect(result.freeRooms).toBe(0)
  })
})

// ============================================================================
// computePickup
// ============================================================================

describe('computePickup', () => {
  // REF_DATE = 2025-06-15
  // 1d cutoff = 2025-06-14, 3d = 2025-06-12, 7d = 2025-06-08, 14d = 2025-06-01

  const stayDate = '2025-06-20'

  function makePickupRes(bookedDate: string, roomTypeId = 'rt-1'): MetricsReservation {
    return makeRes({
      check_in_date: '2025-06-18',
      check_out_date: '2025-06-23',
      booked_date: bookedDate,
      room_type_id: roomTypeId,
    })
  }

  it('returns 0 for empty reservations', () => {
    expect(computePickup(stayDate, [], 1, REF_DATE)).toBe(0)
    expect(computePickup(stayDate, [], 14, REF_DATE)).toBe(0)
  })

  it('counts bookings within 24h window (booked yesterday)', () => {
    const res = makePickupRes('2025-06-14')  // exactly at 1d cutoff
    expect(computePickup(stayDate, [res], 1, REF_DATE)).toBe(1)
  })

  it('counts bookings within 3-day window', () => {
    const inWindow = [makePickupRes('2025-06-13'), makePickupRes('2025-06-14')]
    const outOfWindow = makePickupRes('2025-06-11')  // before 3d cutoff (June 12)
    expect(computePickup(stayDate, [...inWindow, outOfWindow], 3, REF_DATE)).toBe(2)
  })

  it('counts bookings within 7-day window', () => {
    const inWindow = [makePickupRes('2025-06-08'), makePickupRes('2025-06-12')]
    const outOfWindow = makePickupRes('2025-06-07')  // before 7d cutoff (June 8)
    expect(computePickup(stayDate, [...inWindow, outOfWindow], 7, REF_DATE)).toBe(2)
  })

  it('counts bookings within 14-day window', () => {
    const inWindow = [makePickupRes('2025-06-01'), makePickupRes('2025-06-10')]
    const outOfWindow = makePickupRes('2025-05-31')  // before 14d cutoff (June 1)
    expect(computePickup(stayDate, [...inWindow, outOfWindow], 14, REF_DATE)).toBe(2)
  })

  it('excludes reservations not staying on the target date', () => {
    // Reservation ends before stayDate
    const notStaying = makeRes({
      check_in_date: '2025-06-15',
      check_out_date: '2025-06-19',  // check_out < stayDate, so not staying June 20
      booked_date: '2025-06-14',
    })
    expect(computePickup(stayDate, [notStaying], 1, REF_DATE)).toBe(0)
  })

  it('excludes reservations booked before cutoff boundary', () => {
    const justBefore = makePickupRes('2025-05-31')  // before 14d cutoff
    expect(computePickup(stayDate, [justBefore], 14, REF_DATE)).toBe(0)
  })

  it('includes reservation booked exactly on the cutoff date', () => {
    // 14d cutoff = 2025-06-01
    const onCutoff = makePickupRes('2025-06-01')
    expect(computePickup(stayDate, [onCutoff], 14, REF_DATE)).toBe(1)
  })
})

// ============================================================================
// computeMonthPickup
// ============================================================================

describe('computeMonthPickup', () => {
  it('returns 0 for empty reservations', () => {
    expect(computeMonthPickup(2025, 6, [], 7, REF_DATE)).toBe(0)
  })

  it('counts reservations with stay in the month booked within window', () => {
    const inMonth = makeRes({
      check_in_date: '2025-06-10',
      check_out_date: '2025-06-15',
      booked_date: '2025-06-10',  // within 7d window from June 15
    })
    expect(computeMonthPickup(2025, 6, [inMonth], 7, REF_DATE)).toBe(1)
  })

  it('excludes reservations with no stay in the month', () => {
    const outsideMonth = makeRes({
      check_in_date: '2025-07-01',
      check_out_date: '2025-07-05',
      booked_date: '2025-06-14',
    })
    expect(computeMonthPickup(2025, 6, [outsideMonth], 7, REF_DATE)).toBe(0)
  })

  it('excludes reservations booked outside window', () => {
    const oldBooking = makeRes({
      check_in_date: '2025-06-20',
      check_out_date: '2025-06-25',
      booked_date: '2025-04-01',  // way before any window
    })
    expect(computeMonthPickup(2025, 6, [oldBooking], 14, REF_DATE)).toBe(0)
  })

  it('includes cross-month reservation with nights in target month', () => {
    // Check-in May 30, check-out June 3 — has nights in June
    const crossMonth = makeRes({
      check_in_date: '2025-05-30',
      check_out_date: '2025-06-03',
      booked_date: '2025-06-10',  // within 7d window
    })
    expect(computeMonthPickup(2025, 6, [crossMonth], 7, REF_DATE)).toBe(1)
  })
})

// ============================================================================
// computeALOS
// ============================================================================

describe('computeALOS', () => {
  it('returns 0 for empty reservations', () => {
    expect(computeALOS([])).toBe(0)
  })

  it('returns correct average when all reservations have same length', () => {
    const reservations = [makeRes({ nights: 3 }), makeRes({ nights: 3 })]
    expect(computeALOS(reservations)).toBe(3)
  })

  it('calculates ALOS correctly for mixed stays', () => {
    const reservations = [
      makeRes({ nights: 2 }),
      makeRes({ nights: 4 }),
      makeRes({ nights: 6 }),
    ]
    expect(computeALOS(reservations)).toBeCloseTo(4, 5)
  })

  it('returns correct value for single reservation', () => {
    expect(computeALOS([makeRes({ nights: 7 })])).toBe(7)
  })
})

// ============================================================================
// computeAvgLeadTimeForDate
// ============================================================================

describe('computeAvgLeadTimeForDate', () => {
  it('returns 0 when no reservations stay that night', () => {
    const res = makeRes({ check_in_date: '2025-06-10', check_out_date: '2025-06-13' })
    expect(computeAvgLeadTimeForDate('2025-06-15', [res])).toBe(0)
  })

  it('returns 0 for empty reservations', () => {
    expect(computeAvgLeadTimeForDate('2025-06-10', [])).toBe(0)
  })

  it('calculates average lead time for staying reservations', () => {
    const r1 = makeRes({
      check_in_date: '2025-06-10',
      check_out_date: '2025-06-14',
      booking_window: 30,
    })
    const r2 = makeRes({
      check_in_date: '2025-06-10',
      check_out_date: '2025-06-14',
      booking_window: 50,
    })
    expect(computeAvgLeadTimeForDate('2025-06-12', [r1, r2])).toBe(40)
  })

  it('only includes reservations staying on the exact target date', () => {
    const staying = makeRes({
      check_in_date: '2025-06-10',
      check_out_date: '2025-06-14',
      booking_window: 20,
    })
    const notStaying = makeRes({
      check_in_date: '2025-06-14',  // checks in on target, so stays from June 14 on
      check_out_date: '2025-06-17',
      booking_window: 60,
    })
    // For June 12: staying (June 10-14) included, notStaying (June 14-17) excluded
    expect(computeAvgLeadTimeForDate('2025-06-12', [staying, notStaying])).toBe(20)
  })
})

// ============================================================================
// computeAvgLeadTime
// ============================================================================

describe('computeAvgLeadTime', () => {
  it('returns 0 for empty reservations', () => {
    expect(computeAvgLeadTime([])).toBe(0)
  })

  it('calculates average lead time correctly', () => {
    const reservations = [
      makeRes({ booking_window: 10 }),
      makeRes({ booking_window: 30 }),
      makeRes({ booking_window: 50 }),
    ]
    expect(computeAvgLeadTime(reservations)).toBeCloseTo(30, 5)
  })
})

// ============================================================================
// computeMonthKpis
// ============================================================================

describe('computeMonthKpis', () => {
  it('returns zeros for empty month (no reservations, no daily metrics)', () => {
    const result = computeMonthKpis(2025, 6, [], [], REF_DATE)
    expect(result.occupancyPct).toBe(0)
    expect(result.adr).toBe(0)
    expect(result.revpar).toBe(0)
    expect(result.totalRevenue).toBe(0)
    expect(result.alos).toBe(0)
    expect(result.avgLeadTime).toBe(0)
    expect(result.pickup[1]).toBe(0)
    expect(result.pickup[14]).toBe(0)
  })

  it('aggregates daily metrics into month KPIs', () => {
    const dailyMetrics = [
      { totalRooms: 40, soldRooms: 30, freeRooms: 10, occupancyPct: 75, adr: 200, revpar: 150, roomRevenue: 6000 },
      { totalRooms: 40, soldRooms: 20, freeRooms: 20, occupancyPct: 50, adr: 200, revpar: 100, roomRevenue: 4000 },
    ]
    const reservations = [
      makeRes({ nights: 2, booking_window: 20 }),
      makeRes({ nights: 4, booking_window: 40 }),
    ]
    const result = computeMonthKpis(2025, 6, dailyMetrics, reservations, REF_DATE)
    // totalSold = 50, totalAvailable = 80
    expect(result.occupancyPct).toBeCloseTo((50 / 80) * 100, 2)
    expect(result.totalRevenue).toBeCloseTo(10000, 2)
    expect(result.adr).toBeCloseTo(10000 / 50, 2)
    expect(result.revpar).toBeCloseTo(10000 / 80, 2)
    expect(result.alos).toBe(3)  // (2+4)/2
    expect(result.avgLeadTime).toBe(30)  // (20+40)/2
  })

  it('computes all four pickup window values', () => {
    // Booking made June 14 for a June 20 stay
    const recentBooking = makeRes({
      check_in_date: '2025-06-20',
      check_out_date: '2025-06-25',
      booked_date: '2025-06-14',  // within 1d window from June 15
    })
    const result = computeMonthKpis(2025, 6, [], [recentBooking], REF_DATE)
    // All windows include June 14+ so all should = 1
    expect(result.pickup[1]).toBe(1)
    expect(result.pickup[3]).toBe(1)
    expect(result.pickup[7]).toBe(1)
    expect(result.pickup[14]).toBe(1)
  })

  it('pickup window 1d does not include older bookings', () => {
    const oldBooking = makeRes({
      check_in_date: '2025-06-20',
      check_out_date: '2025-06-25',
      booked_date: '2025-06-10',  // 5 days before refDate → only in 7d+ windows
    })
    const result = computeMonthKpis(2025, 6, [], [oldBooking], REF_DATE)
    expect(result.pickup[1]).toBe(0)
    expect(result.pickup[3]).toBe(0)
    expect(result.pickup[7]).toBe(1)
    expect(result.pickup[14]).toBe(1)
  })
})
