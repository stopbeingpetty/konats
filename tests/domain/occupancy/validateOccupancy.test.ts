import { describe, it, expect } from 'vitest'
import { validateOccupancyRow, validateOccupancyRows, ROOM_CAPACITY } from '@/features/imports/lib/validateOccupancy'
import type { OccupancyParsedRow } from '@/features/imports/types'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<OccupancyParsedRow> = {}): OccupancyParsedRow {
  return {
    rowIndex: 5,
    date: '2026-05-01',
    day: 'Pet',
    free_sup: ROOM_CAPACITY.sup - 15,  // 8
    free_exe: ROOM_CAPACITY.exe - 10,  // 7
    free_sui: ROOM_CAPACITY.sui - 3,   // 1
    occ_sup: 15,
    occ_exe: 10,
    occ_sui: 3,
    occ_total: 28,
    pct: 0.636,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// validateOccupancyRow
// ---------------------------------------------------------------------------

describe('validateOccupancyRow — valid row', () => {
  it('returns ok: true for a perfectly balanced row', () => {
    expect(validateOccupancyRow(makeRow()).ok).toBe(true)
  })

  it('accepts zero sold rooms (0 + capacity = capacity)', () => {
    const row = makeRow({
      occ_sup: 0, free_sup: ROOM_CAPACITY.sup,
      occ_exe: 0, free_exe: ROOM_CAPACITY.exe,
      occ_sui: 0, free_sui: ROOM_CAPACITY.sui,
    })
    expect(validateOccupancyRow(row).ok).toBe(true)
  })

  it('accepts fully sold rooms (capacity + 0 = capacity)', () => {
    const row = makeRow({
      occ_sup: ROOM_CAPACITY.sup, free_sup: 0,
      occ_exe: ROOM_CAPACITY.exe, free_exe: 0,
      occ_sui: ROOM_CAPACITY.sui, free_sui: 0,
    })
    expect(validateOccupancyRow(row).ok).toBe(true)
  })
})

describe('validateOccupancyRow — Superior capacity mismatch', () => {
  it('fails when occ_sup + free_sup ≠ 23', () => {
    const row = makeRow({ occ_sup: 20, free_sup: 5 }) // 25 ≠ 23
    const result = validateOccupancyRow(row)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/Superior/)
  })

  it('fails when free_sup is too large', () => {
    const row = makeRow({ occ_sup: 0, free_sup: 25 }) // 25 ≠ 23
    expect(validateOccupancyRow(row).ok).toBe(false)
  })
})

describe('validateOccupancyRow — Executive capacity mismatch', () => {
  it('fails when occ_exe + free_exe ≠ 17', () => {
    const row = makeRow({ occ_exe: 10, free_exe: 10 }) // 20 ≠ 17
    const result = validateOccupancyRow(row)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/Executive/)
  })
})

describe('validateOccupancyRow — Suite capacity mismatch', () => {
  it('fails when occ_sui + free_sui ≠ 4', () => {
    const row = makeRow({ occ_sui: 3, free_sui: 3 }) // 6 ≠ 4
    const result = validateOccupancyRow(row)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/Suite/)
  })
})

describe('validateOccupancyRow — negative values', () => {
  it('fails for negative occ value', () => {
    const row = makeRow({ occ_sup: -1, free_sup: ROOM_CAPACITY.sup + 1 })
    expect(validateOccupancyRow(row).ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// validateOccupancyRows (batch)
// ---------------------------------------------------------------------------

describe('validateOccupancyRows', () => {
  it('separates valid rows from invalid ones', () => {
    const rows: OccupancyParsedRow[] = [
      makeRow({ date: '2026-05-01' }),
      makeRow({ date: '2026-05-02', occ_sup: 20, free_sup: 5 }), // invalid
      makeRow({ date: '2026-05-03' }),
    ]
    const { validRows, errors } = validateOccupancyRows(rows)
    expect(validRows).toHaveLength(2)
    expect(errors).toHaveLength(1)
    expect(errors[0].date).toBe('2026-05-02')
    expect(errors[0].reason).toMatch(/Superior/)
  })

  it('returns all rows valid when all pass', () => {
    const rows = [makeRow(), makeRow({ date: '2026-05-02' })]
    const { validRows, errors } = validateOccupancyRows(rows)
    expect(validRows).toHaveLength(2)
    expect(errors).toHaveLength(0)
  })

  it('returns all rows invalid when all fail', () => {
    const rows = [
      makeRow({ occ_sup: 99, free_sup: 99 }),
      makeRow({ occ_sup: 99, free_sup: 99, date: '2026-05-02' }),
    ]
    const { validRows, errors } = validateOccupancyRows(rows)
    expect(validRows).toHaveLength(0)
    expect(errors).toHaveLength(2)
  })
})
