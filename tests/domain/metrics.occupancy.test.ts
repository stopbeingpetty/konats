import { describe, it, expect } from 'vitest'
import {
  getEffectiveOccupancy,
  computeHybridDayMetrics,
  type MetricsOccupancyOverride,
  type MetricsReservationCount,
  type MetricsReservation,
  type MetricsRoomType,
} from '@/features/calendar/lib/metrics'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const DATE = '2026-07-15'
const RT_A = 'room-type-a'
const RT_B = 'room-type-b'
const RT_C = 'room-type-c'

const overrideForA: MetricsOccupancyOverride = {
  date: DATE,
  room_type_id: RT_A,
  sold_rooms: 18,
  capacity: 23,
}

const reservationCounts: MetricsReservationCount[] = [
  { room_type_id: RT_A, sold_rooms: 10 },
  { room_type_id: RT_B, sold_rooms: 7 },
]

// ---------------------------------------------------------------------------
// Override present
// ---------------------------------------------------------------------------

describe('getEffectiveOccupancy — override exists', () => {
  it('returns sold_rooms from the override row', () => {
    const result = getEffectiveOccupancy(DATE, RT_A, [overrideForA], reservationCounts)
    expect(result.soldRooms).toBe(18)
  })

  it('returns capacity from the override row', () => {
    const result = getEffectiveOccupancy(DATE, RT_A, [overrideForA], reservationCounts)
    expect(result.capacity).toBe(23)
  })

  it('sets fromOverride to true', () => {
    const result = getEffectiveOccupancy(DATE, RT_A, [overrideForA], reservationCounts)
    expect(result.fromOverride).toBe(true)
  })

  it('does not bleed over to a different room type that has no override', () => {
    const result = getEffectiveOccupancy(DATE, RT_B, [overrideForA], reservationCounts)
    expect(result.fromOverride).toBe(false)
    expect(result.soldRooms).toBe(7)
  })
})

// ---------------------------------------------------------------------------
// Override missing
// ---------------------------------------------------------------------------

describe('getEffectiveOccupancy — override missing', () => {
  it('falls back to reservation count', () => {
    const result = getEffectiveOccupancy(DATE, RT_B, [], reservationCounts)
    expect(result.soldRooms).toBe(7)
  })

  it('sets fromOverride to false', () => {
    const result = getEffectiveOccupancy(DATE, RT_B, [], reservationCounts)
    expect(result.fromOverride).toBe(false)
  })

  it('returns null capacity when falling back to reservations', () => {
    const result = getEffectiveOccupancy(DATE, RT_B, [], reservationCounts)
    expect(result.capacity).toBeNull()
  })

  it('returns 0 sold rooms when room type has no override and no reservations', () => {
    const result = getEffectiveOccupancy(DATE, RT_C, [], reservationCounts)
    expect(result.soldRooms).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Mixed — some room types have overrides, some fall back
// ---------------------------------------------------------------------------

describe('getEffectiveOccupancy — mixed (some types overridden, some not)', () => {
  const overrides: MetricsOccupancyOverride[] = [
    { date: DATE, room_type_id: RT_A, sold_rooms: 20, capacity: 23 },
  ]
  const counts: MetricsReservationCount[] = [
    { room_type_id: RT_A, sold_rooms: 5 },  // should be ignored in favour of override
    { room_type_id: RT_B, sold_rooms: 9 },
  ]

  it('RT_A: uses override sold_rooms (not reservation count)', () => {
    const result = getEffectiveOccupancy(DATE, RT_A, overrides, counts)
    expect(result.soldRooms).toBe(20)
    expect(result.fromOverride).toBe(true)
  })

  it('RT_B: falls back to reservation count', () => {
    const result = getEffectiveOccupancy(DATE, RT_B, overrides, counts)
    expect(result.soldRooms).toBe(9)
    expect(result.fromOverride).toBe(false)
  })

  it('RT_C: returns 0 (no override, no reservations)', () => {
    const result = getEffectiveOccupancy(DATE, RT_C, overrides, counts)
    expect(result.soldRooms).toBe(0)
    expect(result.fromOverride).toBe(false)
  })

  it('override from a different date does not match', () => {
    const wrongDate: MetricsOccupancyOverride = {
      date: '2026-07-16',
      room_type_id: RT_A,
      sold_rooms: 99,
      capacity: 23,
    }
    const result = getEffectiveOccupancy(DATE, RT_A, [wrongDate], counts)
    // Should fall back to reservation count, not pick up the wrong-date override
    expect(result.soldRooms).toBe(5)
    expect(result.fromOverride).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// computeHybridDayMetrics
// ---------------------------------------------------------------------------

const roomTypes: MetricsRoomType[] = [
  { id: RT_A, default_room_count: 23 },
  { id: RT_B, default_room_count: 14 },
]

function makeReservation(
  fields: Partial<MetricsReservation> & {
    check_in_date: string
    check_out_date: string
    room_type_id: string
    rooms_count: number
    adr: number
  }
): MetricsReservation {
  return {
    id: crypto.randomUUID(),
    booked_date: '2026-01-01',
    nights: 1,
    booking_window: 30,
    channel: 'direct',
    ...fields,
  }
}

describe('computeHybridDayMetrics — no overrides', () => {
  it('behaves identically to computeDayMetrics when overrides is empty', () => {
    const res = makeReservation({
      check_in_date: DATE,
      check_out_date: '2026-07-16',
      room_type_id: RT_A,
      rooms_count: 5,
      adr: 200,
    })
    const result = computeHybridDayMetrics(DATE, [res], roomTypes, [], [])
    expect(result.soldRooms).toBe(5)
    expect(result.totalRooms).toBe(37) // 23 + 14
    expect(result.roomRevenue).toBe(1000) // 5 × 200
    expect(result.adr).toBe(200)
    expect(result.occupancyPct).toBeCloseTo((5 / 37) * 100, 5)
  })
})

describe('computeHybridDayMetrics — override replaces reservation count', () => {
  const res = makeReservation({
    check_in_date: DATE,
    check_out_date: '2026-07-16',
    room_type_id: RT_A,
    rooms_count: 5,
    adr: 300,
  })
  const override: MetricsOccupancyOverride = {
    date: DATE,
    room_type_id: RT_A,
    sold_rooms: 18,
    capacity: 23,
  }

  it('uses override sold_rooms instead of reservation rooms_count', () => {
    const result = computeHybridDayMetrics(DATE, [res], roomTypes, [], [override])
    // RT_A from override (18), RT_B has no res and no override (0)
    expect(result.soldRooms).toBe(18)
  })

  it('uses override capacity for the overridden type', () => {
    const result = computeHybridDayMetrics(DATE, [res], roomTypes, [], [override])
    expect(result.totalRooms).toBe(37) // override.capacity(23) + RT_B.default(14)
  })

  it('keeps revenue from reservations', () => {
    const result = computeHybridDayMetrics(DATE, [res], roomTypes, [], [override])
    expect(result.roomRevenue).toBe(1500) // 5 rooms × 300 adr
  })

  it('ADR denominator uses reservation sold count, not override sold count', () => {
    const result = computeHybridDayMetrics(DATE, [res], roomTypes, [], [override])
    // ADR = revenue(1500) / res_sold(5) = 300
    expect(result.adr).toBe(300)
  })

  it('occupancyPct = override sold / (override capacity + fallback capacity)', () => {
    const result = computeHybridDayMetrics(DATE, [res], roomTypes, [], [override])
    expect(result.occupancyPct).toBeCloseTo((18 / 37) * 100, 5)
  })

  it('revpar = soldRooms × ADR / totalRooms', () => {
    const result = computeHybridDayMetrics(DATE, [res], roomTypes, [], [override])
    expect(result.revpar).toBeCloseTo((18 * 300) / 37, 5)
  })
})

describe('computeHybridDayMetrics — override with 0 reservations (edge case)', () => {
  const override: MetricsOccupancyOverride = {
    date: DATE,
    room_type_id: RT_A,
    sold_rooms: 10,
    capacity: 23,
  }

  it('shows override occupancy even with no reservation records', () => {
    const result = computeHybridDayMetrics(DATE, [], roomTypes, [], [override])
    expect(result.soldRooms).toBe(10)
    expect(result.occupancyPct).toBeCloseTo((10 / 37) * 100, 5)
  })

  it('revenue and ADR are zero when there are no reservations', () => {
    const result = computeHybridDayMetrics(DATE, [], roomTypes, [], [override])
    expect(result.roomRevenue).toBe(0)
    expect(result.adr).toBe(0)
  })

  it('revpar is zero when ADR is zero', () => {
    const result = computeHybridDayMetrics(DATE, [], roomTypes, [], [override])
    expect(result.revpar).toBe(0)
  })
})

describe('computeHybridDayMetrics — per-type ADR isolation', () => {
  const RT_SUITE = 'room-type-suite'
  const rtSuite: MetricsRoomType = { id: RT_SUITE, default_room_count: 5 }
  const rtA: MetricsRoomType = { id: RT_A, default_room_count: 23 }
  const rtB: MetricsRoomType = { id: RT_B, default_room_count: 14 }
  const resSuperior = makeReservation({
    check_in_date: DATE,
    check_out_date: '2026-07-16',
    room_type_id: RT_A,
    rooms_count: 3,
    adr: 400,
  })
  const resExecutive = makeReservation({
    check_in_date: DATE,
    check_out_date: '2026-07-16',
    room_type_id: RT_B,
    rooms_count: 2,
    adr: 300,
  })
  const resSuite = makeReservation({
    check_in_date: DATE,
    check_out_date: '2026-07-16',
    room_type_id: RT_SUITE,
    rooms_count: 1,
    adr: 650,
  })
  const allRes = [resSuperior, resExecutive, resSuite]

  it('3 different room types on the same night each compute a distinct per-type ADR', () => {
    const superior = computeHybridDayMetrics(DATE, allRes, [rtA], [], [])
    const executive = computeHybridDayMetrics(DATE, allRes, [rtB], [], [])
    const suite = computeHybridDayMetrics(DATE, allRes, [rtSuite], [], [])

    expect(superior.adr).toBe(400)
    expect(executive.adr).toBe(300)
    expect(suite.adr).toBe(650)
  })

  it('type with override but no reservations → ADR is 0 (no rate data)', () => {
    const override: MetricsOccupancyOverride = {
      date: DATE,
      room_type_id: RT_A,
      sold_rooms: 10,
      capacity: 23,
    }
    // No reservations for RT_A; RT_B and Suite reservations must not bleed in
    const result = computeHybridDayMetrics(DATE, [resExecutive, resSuite], [rtA], [], [override])
    expect(result.adr).toBe(0)
    expect(result.roomRevenue).toBe(0)
    expect(result.soldRooms).toBe(10) // override count still applies
  })

  it('type with reservations but no override → reservation-based occupancy and ADR', () => {
    // RT_B: 2 rooms at ADR 300, no override; other types' reservations must not bleed in
    const result = computeHybridDayMetrics(DATE, allRes, [rtB], [], [])
    expect(result.soldRooms).toBe(2)
    expect(result.adr).toBe(300)
    expect(result.roomRevenue).toBe(600) // 2 × 300
    expect(result.occupancyPct).toBeCloseTo((2 / 14) * 100, 5)
  })
})

describe('computeHybridDayMetrics — mixed: RT_A overridden, RT_B from reservations', () => {
  const resA = makeReservation({
    check_in_date: DATE,
    check_out_date: '2026-07-16',
    room_type_id: RT_A,
    rooms_count: 5,
    adr: 200,
  })
  const resB = makeReservation({
    check_in_date: DATE,
    check_out_date: '2026-07-16',
    room_type_id: RT_B,
    rooms_count: 8,
    adr: 150,
  })
  const override: MetricsOccupancyOverride = {
    date: DATE,
    room_type_id: RT_A,
    sold_rooms: 20,
    capacity: 23,
  }

  it('RT_A sold uses override, RT_B sold uses reservations', () => {
    const result = computeHybridDayMetrics(DATE, [resA, resB], roomTypes, [], [override])
    // soldRooms = override RT_A(20) + res RT_B(8)
    expect(result.soldRooms).toBe(28)
  })

  it('totalRooms = override capacity for RT_A + default for RT_B', () => {
    const result = computeHybridDayMetrics(DATE, [resA, resB], roomTypes, [], [override])
    expect(result.totalRooms).toBe(37) // 23 + 14
  })

  it('revenue sums both reservation types (override does not affect revenue)', () => {
    const result = computeHybridDayMetrics(DATE, [resA, resB], roomTypes, [], [override])
    // resA: 5×200=1000, resB: 8×150=1200
    expect(result.roomRevenue).toBe(2200)
  })

  it('ADR denominator is total reservation sold (5+8=13), not override+res (20+8)', () => {
    const result = computeHybridDayMetrics(DATE, [resA, resB], roomTypes, [], [override])
    // ADR = 2200 / 13
    expect(result.adr).toBeCloseTo(2200 / 13, 5)
  })
})
