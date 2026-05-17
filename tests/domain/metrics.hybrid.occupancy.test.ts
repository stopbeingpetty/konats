import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  getOccupancyForDateType,
  type MetricsOccupancyOverride,
  type MetricsReservation,
} from '@/features/calendar/lib/metrics'

// ============================================================================
// Fixtures
// ============================================================================

const DATE = '2026-06-15'
const RT = 'room-type-a'
const SNAPSHOT = '2026-05-07'

let _idSeq = 0
function makeRes(
  fields: Partial<MetricsReservation> & { check_in_date?: string; check_out_date?: string }
): MetricsReservation {
  // Derive created_at/updated_at from booked_date so that existing tests continue to work:
  // overriding booked_date implicitly shifts the DB-insert timestamp to the same calendar day.
  const bookedDate = fields.booked_date ?? '2026-05-10'
  return {
    id: `res-${++_idSeq}`,
    check_in_date: DATE,
    check_out_date: '2026-06-16',
    booked_date: bookedDate,
    created_at: `${bookedDate}T00:00:00Z`,
    updated_at: `${bookedDate}T00:00:00Z`,
    rooms_count: 1,
    adr: 200,
    nights: 1,
    booking_window: 30,
    channel: 'direct',
    room_type_id: RT,
    source: 'phobs_excel',
    status: 'confirmed',
    cancellation_date: null,
    deleted_at: null,
    ...fields,
  }
}

function makeOverride(extra: Partial<MetricsOccupancyOverride> = {}): MetricsOccupancyOverride {
  return {
    date: DATE,
    room_type_id: RT,
    sold_rooms: 18,
    capacity: 20,
    snapshot_date: SNAPSHOT,
    ...extra,
  }
}

// ============================================================================
// Tests
// ============================================================================

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getOccupancyForDateType — test 1: no override, no reservations', () => {
  it('returns sold=0 and capacity=null', () => {
    const result = getOccupancyForDateType(DATE, RT, [], [])
    expect(result.sold).toBe(0)
    expect(result.capacity).toBeNull()
    expect(result.baseline).toBe(0)
    expect(result.delta).toBe(0)
  })
})

describe('getOccupancyForDateType — test 2: override exists, no recent Phobs', () => {
  it('sold = override.sold_rooms (baseline only)', () => {
    const result = getOccupancyForDateType(DATE, RT, [makeOverride()], [])
    expect(result.sold).toBe(18)
    expect(result.capacity).toBe(20)
    expect(result.baseline).toBe(18)
    expect(result.delta).toBe(0)
  })
})

describe('getOccupancyForDateType — test 3: override + 2 Phobs booked AFTER snapshot', () => {
  it('sold = override.sold + 2', () => {
    const res1 = makeRes({ booked_date: '2026-05-10' })
    const res2 = makeRes({ booked_date: '2026-05-12' })
    const result = getOccupancyForDateType(DATE, RT, [makeOverride()], [res1, res2])
    expect(result.sold).toBe(20) // 18 + 2
    expect(result.delta).toBe(2)
  })
})

describe('getOccupancyForDateType — test 4: override + 2 Phobs booked BEFORE snapshot', () => {
  it('sold = override.sold (no double-count)', () => {
    const res1 = makeRes({ booked_date: '2026-05-01' })
    const res2 = makeRes({ booked_date: '2026-05-05' })
    const result = getOccupancyForDateType(DATE, RT, [makeOverride()], [res1, res2])
    expect(result.sold).toBe(18)
    expect(result.delta).toBe(0)
  })
})

describe('getOccupancyForDateType — test 5: 1 Phobs before snapshot + 1 after', () => {
  it('sold = override.sold + 1', () => {
    const before = makeRes({ booked_date: '2026-04-01' })
    const after = makeRes({ booked_date: '2026-05-20' })
    const result = getOccupancyForDateType(DATE, RT, [makeOverride()], [before, after])
    expect(result.sold).toBe(19)
    expect(result.delta).toBe(1)
  })
})

describe('getOccupancyForDateType — test 6: 2 added + 1 cancelled (all after snapshot)', () => {
  it('sold = override.sold + 1 (net: +2 delta – 1 cancel of pre-snapshot booking)', () => {
    // 2 confirmed bookings after snapshot
    const add1 = makeRes({ booked_date: '2026-05-10' })
    const add2 = makeRes({ booked_date: '2026-05-14' })
    // 1 reservation booked BEFORE snapshot, cancelled AFTER snapshot
    const cancel = makeRes({
      booked_date: '2026-04-20', // before snapshot → was in baseline
      created_at: '2026-04-20T00:00:00Z',
      status: 'cancelled',
      cancellation_date: '2026-05-10', // after snapshot → baseline is stale
      updated_at: '2026-05-10T00:00:00Z', // updated_at drives the cancellation delta check
    })
    const result = getOccupancyForDateType(DATE, RT, [makeOverride()], [add1, add2, cancel])
    expect(result.sold).toBe(19) // 18 + 2 - 1
    expect(result.delta).toBe(1) // net
  })
})

describe('getOccupancyForDateType — test 7: no override, 5 Phobs', () => {
  it('sold = 5 (all Phobs since 1900-01-01 baseline)', () => {
    const reservations = Array.from({ length: 5 }, () =>
      makeRes({ booked_date: '2026-01-01' })
    )
    const result = getOccupancyForDateType(DATE, RT, [], reservations)
    expect(result.sold).toBe(5)
    expect(result.capacity).toBeNull()
    expect(result.baseline).toBe(0)
    expect(result.delta).toBe(5)
  })
})

describe('getOccupancyForDateType — test 8: legacy reservations excluded', () => {
  it('source=laserline_legacy is not counted even if booked after snapshot', () => {
    const legacy = makeRes({ source: 'laserline_legacy', booked_date: '2026-05-20' })
    const result = getOccupancyForDateType(DATE, RT, [makeOverride()], [legacy])
    expect(result.sold).toBe(18) // baseline only, legacy not counted
    expect(result.delta).toBe(0)
  })
})

describe('getOccupancyForDateType — test 9: cancellation BEFORE snapshot not subtracted', () => {
  it('updated_at <= snapshot_date is ignored (already accounted for in Excel)', () => {
    const cancel = makeRes({
      booked_date: '2026-04-01',
      created_at: '2026-04-01T00:00:00Z',
      status: 'cancelled',
      cancellation_date: '2026-05-06', // day before snapshot
      updated_at: '2026-05-06T00:00:00Z', // before snapshot → already accounted for in Excel
    })
    const result = getOccupancyForDateType(DATE, RT, [makeOverride()], [cancel])
    expect(result.sold).toBe(18)
    expect(result.delta).toBe(0)
  })
})

describe('getOccupancyForDateType — test 10: reservation that checked out before the date', () => {
  it('check_out_date <= date means the room is free; not counted', () => {
    // check_out_date = DATE → check_out_date > date is FALSE (strictly greater)
    const gone = makeRes({ check_in_date: '2026-06-14', check_out_date: DATE })
    const result = getOccupancyForDateType(DATE, RT, [makeOverride()], [gone])
    expect(result.sold).toBe(18)
    expect(result.delta).toBe(0)
  })
})

describe('getOccupancyForDateType — test 11: effective_sold clamped to capacity', () => {
  it('clamps and emits console.warn when raw > capacity', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // Override: 18/20 rooms. Add 30 Phobs → would be 48, exceeds capacity 20.
    const reservations = Array.from({ length: 30 }, () =>
      makeRes({ booked_date: '2026-05-20' })
    )
    const result = getOccupancyForDateType(DATE, RT, [makeOverride()], reservations)
    expect(result.sold).toBe(20) // clamped to capacity
    expect(warnSpy).toHaveBeenCalledOnce()
    expect(warnSpy.mock.calls[0][0]).toContain('clamped')
  })
})

// ============================================================================
// Same-day timestamp tests (the core bug fix)
// ============================================================================

const SNAPSHOT_TS = '2026-05-17T11:32:42Z'

function makeSameDayOverride(): MetricsOccupancyOverride {
  return { date: DATE, room_type_id: RT, sold_rooms: 10, capacity: 20, snapshot_date: SNAPSHOT_TS }
}

describe('getOccupancyForDateType — test 12: same-day import AFTER snapshot counts in delta', () => {
  it('reservation created at 18:29 on snapshot day (11:32) is included in delta', () => {
    const res = makeRes({
      created_at: '2026-05-17T18:29:42Z', // same calendar day as snapshot, but later
      updated_at: '2026-05-17T18:29:42Z',
      booked_date: '2026-05-17',
    })
    const result = getOccupancyForDateType(DATE, RT, [makeSameDayOverride()], [res])
    expect(result.delta).toBe(1)
    expect(result.sold).toBe(11) // 10 baseline + 1 delta
  })
})

describe('getOccupancyForDateType — test 13: reservation created BEFORE snapshot (day-before) excluded', () => {
  it('reservation created at 15:00 the day before snapshot is not in delta', () => {
    const res = makeRes({
      created_at: '2026-05-16T15:00:00Z', // day before snapshot
      updated_at: '2026-05-16T15:00:00Z',
      booked_date: '2026-05-16',
    })
    const result = getOccupancyForDateType(DATE, RT, [makeSameDayOverride()], [res])
    expect(result.delta).toBe(0)
    expect(result.sold).toBe(10) // baseline only
  })
})

describe('getOccupancyForDateType — test 14: cancellation same day as snapshot counts as -1', () => {
  it('reservation updated_at 19:00 on snapshot day (11:32) is subtracted', () => {
    // Reservation was created before the snapshot (already in the 10-room baseline)
    // and then cancelled after the snapshot.
    const cancel = makeRes({
      created_at: '2026-05-10T08:00:00Z', // well before snapshot
      updated_at: '2026-05-17T19:00:00Z', // same calendar day as snapshot, but after it
      booked_date: '2026-05-10',
      status: 'cancelled',
      cancellation_date: '2026-05-17',
    })
    const result = getOccupancyForDateType(DATE, RT, [makeSameDayOverride()], [cancel])
    expect(result.delta).toBe(-1)
    expect(result.sold).toBe(9) // 10 baseline - 1 cancellation
  })
})
