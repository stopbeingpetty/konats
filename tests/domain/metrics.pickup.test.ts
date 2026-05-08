import { describe, it, expect } from 'vitest'
import {
  computePickupForDate,
  computeMonthPickupFiltered,
  type PickupReservation,
} from '@/features/calendar/lib/metrics'

// ============================================================================
// Test data builders
// ============================================================================

function makePickupRes(overrides: Partial<PickupReservation> = {}): PickupReservation {
  return {
    source: 'phobs_api',
    check_in_date: '2026-05-10',
    check_out_date: '2026-05-13',
    booked_date: '2026-05-08',   // today in test context
    rooms_count: 1,
    status: 'confirmed',
    deleted_at: null,
    ...overrides,
    // id not part of PickupReservation — unused here
  }
}

// Reference date: 2026-05-08 noon UTC (matches currentDate in project memory)
const REF_DATE = new Date('2026-05-08T12:00:00Z')
// A stay-date covered by the default reservation
const STAY_DATE = '2026-05-11'

// ============================================================================
// computePickupForDate
// ============================================================================

describe('computePickupForDate', () => {
  it('counts a Phobs reservation whose booked_date is within the window', () => {
    const res = makePickupRes({ booked_date: '2026-05-07' }) // 1 day before REF
    expect(computePickupForDate(STAY_DATE, 7, [res], REF_DATE)).toBe(1)
  })

  it('sums rooms_count, not reservation row count', () => {
    const res = makePickupRes({ booked_date: '2026-05-07', rooms_count: 3 })
    expect(computePickupForDate(STAY_DATE, 7, [res], REF_DATE)).toBe(3)
  })

  it('EXCLUDES laserline_legacy reservation even when booked_date is within window', () => {
    const legacy = makePickupRes({
      source: 'laserline_legacy',
      booked_date: '2026-05-07',
    })
    expect(computePickupForDate(STAY_DATE, 7, [legacy], REF_DATE)).toBe(0)
  })

  it('excludes a Phobs reservation whose booked_date is outside the window', () => {
    const old = makePickupRes({ booked_date: '2026-04-01' }) // 37 days ago, window=7
    expect(computePickupForDate(STAY_DATE, 7, [old], REF_DATE)).toBe(0)
  })

  it('excludes a cancelled Phobs reservation', () => {
    const cancelled = makePickupRes({
      booked_date: '2026-05-07',
      status: 'cancelled',
    })
    expect(computePickupForDate(STAY_DATE, 7, [cancelled], REF_DATE)).toBe(0)
  })

  it('excludes a no_show Phobs reservation', () => {
    const noShow = makePickupRes({
      booked_date: '2026-05-07',
      status: 'no_show',
    })
    expect(computePickupForDate(STAY_DATE, 7, [noShow], REF_DATE)).toBe(0)
  })

  it('excludes a soft-deleted reservation', () => {
    const deleted = makePickupRes({
      booked_date: '2026-05-07',
      deleted_at: '2026-05-08T00:00:00Z',
    })
    expect(computePickupForDate(STAY_DATE, 7, [deleted], REF_DATE)).toBe(0)
  })

  it('counts checked_in and checked_out reservations', () => {
    const checkedIn  = makePickupRes({ booked_date: '2026-05-07', status: 'checked_in' })
    const checkedOut = makePickupRes({ booked_date: '2026-05-07', status: 'checked_out', rooms_count: 2 })
    expect(computePickupForDate(STAY_DATE, 7, [checkedIn, checkedOut], REF_DATE)).toBe(3)
  })

  it('excludes a reservation whose stay does not cover the target date', () => {
    // check_out_date <= STAY_DATE → not covering
    const miss = makePickupRes({
      check_in_date: '2026-05-08',
      check_out_date: '2026-05-11', // check_out == STAY_DATE → not covering (condition is >)
      booked_date: '2026-05-07',
    })
    expect(computePickupForDate(STAY_DATE, 7, [miss], REF_DATE)).toBe(0)
  })

  it('returns 0 for empty input', () => {
    expect(computePickupForDate(STAY_DATE, 7, [], REF_DATE)).toBe(0)
  })

  it('handles 24h window (windowDays=1) correctly', () => {
    // booked_date == REF_DATE date itself → within 1-day window
    const res = makePickupRes({ booked_date: '2026-05-08' })
    expect(computePickupForDate(STAY_DATE, 1, [res], REF_DATE)).toBe(1)
    // booked_date 2 days ago → outside 1-day window
    const old = makePickupRes({ booked_date: '2026-05-06' })
    expect(computePickupForDate(STAY_DATE, 1, [old], REF_DATE)).toBe(0)
  })
})

// ============================================================================
// computeMonthPickupFiltered
// ============================================================================

describe('computeMonthPickupFiltered', () => {
  it('counts a reservation with a night in the month', () => {
    const res = makePickupRes({
      check_in_date: '2026-05-10',
      check_out_date: '2026-05-13',
      booked_date: '2026-05-07',
    })
    expect(computeMonthPickupFiltered(2026, 5, [res], 7, REF_DATE)).toBe(1)
  })

  it('excludes laserline_legacy even when stay is in the month', () => {
    const legacy = makePickupRes({
      source: 'laserline_legacy',
      check_in_date: '2026-05-10',
      check_out_date: '2026-05-13',
      booked_date: '2026-05-07',
    })
    expect(computeMonthPickupFiltered(2026, 5, [legacy], 7, REF_DATE)).toBe(0)
  })

  it('excludes a reservation whose booked_date is outside the window', () => {
    const old = makePickupRes({
      check_in_date: '2026-05-10',
      check_out_date: '2026-05-13',
      booked_date: '2026-04-01',
    })
    expect(computeMonthPickupFiltered(2026, 5, [old], 7, REF_DATE)).toBe(0)
  })

  it('sums rooms_count across qualifying reservations', () => {
    const a = makePickupRes({ booked_date: '2026-05-07', rooms_count: 2 })
    const b = makePickupRes({ booked_date: '2026-05-06', rooms_count: 3 })
    expect(computeMonthPickupFiltered(2026, 5, [a, b], 14, REF_DATE)).toBe(5)
  })

  it('excludes cancelled reservations', () => {
    const cancelled = makePickupRes({
      booked_date: '2026-05-07',
      status: 'cancelled',
    })
    expect(computeMonthPickupFiltered(2026, 5, [cancelled], 7, REF_DATE)).toBe(0)
  })
})
