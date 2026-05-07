import { describe, it, expect } from 'vitest'
import { utils, write } from 'xlsx'
import { parseOccupancyXlsx } from '@/features/imports/lib/parseOccupancyXlsx'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal Navis Popunjenost .xlsx buffer from data rows.
 * Rows 1-4 are placeholder header rows; data starts at row 5.
 */
function makeXlsx(dataRows: unknown[][]): ArrayBuffer {
  const wb = utils.book_new()
  const allRows: unknown[][] = [
    ['Popunjenost po vrstama soba'],
    ['Hotel Boutique'],
    [],
    ['Datum', 'Dan', 'Free Superior', 'Free Executive', 'Free Suite', 'Free Total',
     'Occ Superior', 'Occ Executive', 'Occ Suite', 'Occ Total', 'Pct'],
    ...dataRows,
  ]
  const ws = utils.aoa_to_sheet(allRows)
  utils.book_append_sheet(wb, ws, 'Sheet1')
  return write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

/** Valid row: occ + free = capacity for each type */
function validRow(date: string): unknown[] {
  // Superior: 23, Executive: 17, Suite: 4
  // occ: 15 sup, 10 exe, 3 sui → free: 8, 7, 1
  return [date, 'Pon', 8, 7, 1, 16, 15, 10, 3, 28, 0.636]
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('parseOccupancyXlsx — valid file', () => {
  it('parses 245 data rows correctly', () => {
    const dates: string[] = []
    for (let i = 0; i < 245; i++) {
      const d = new Date(2026, 4, 1) // May 1, 2026
      d.setDate(d.getDate() + i)
      dates.push(d.toISOString().slice(0, 10))
    }
    const dataRows = dates.map(validRow)
    const buf = makeXlsx(dataRows)

    const result = parseOccupancyXlsx(buf)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.rows).toHaveLength(245)
    expect(result.rows[0].occ_sup).toBe(15)
    expect(result.rows[0].occ_exe).toBe(10)
    expect(result.rows[0].occ_sui).toBe(3)
    expect(result.rows[0].free_sup).toBe(8)
    expect(result.rows[0].free_exe).toBe(7)
    expect(result.rows[0].free_sui).toBe(1)
    expect(result.rows[0].occ_total).toBe(28)
  })

  it('parses correct date for first row', () => {
    const buf = makeXlsx([validRow('2026-05-01')])
    const result = parseOccupancyXlsx(buf)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rows[0].date).toBe('2026-05-01')
  })

  it('assigns correct 1-based rowIndex starting at 5', () => {
    const buf = makeXlsx([validRow('2026-05-01'), validRow('2026-05-02')])
    const result = parseOccupancyXlsx(buf)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rows[0].rowIndex).toBe(5)
    expect(result.rows[1].rowIndex).toBe(6)
  })

  it('parses pct and day fields', () => {
    const buf = makeXlsx([['2026-05-01', 'Pet', 8, 7, 1, 16, 15, 10, 3, 28, 0.636]])
    const result = parseOccupancyXlsx(buf)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rows[0].day).toBe('Pet')
    expect(result.rows[0].pct).toBeCloseTo(0.636)
  })
})

describe('parseOccupancyXlsx — empty and sparse rows', () => {
  it('handles empty rows between data rows gracefully', () => {
    const buf = makeXlsx([
      validRow('2026-05-01'),
      [null, null, null, null, null, null, null, null, null, null, null], // empty row
      validRow('2026-05-03'),
    ])
    const result = parseOccupancyXlsx(buf)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0].date).toBe('2026-05-01')
    expect(result.rows[1].date).toBe('2026-05-03')
  })

  it('returns empty rows array for a file with only header rows', () => {
    const buf = makeXlsx([]) // no data rows
    const result = parseOccupancyXlsx(buf)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rows).toHaveLength(0)
  })

  it('returns ok with zero rows for a nonsense buffer (SheetJS is lenient)', () => {
    // SheetJS does not throw on random bytes — it parses what it can.
    // Ensure we get a stable result and no crash.
    const random = new Uint8Array([0, 1, 2, 3, 4]).buffer
    const result = parseOccupancyXlsx(random)
    // Either ok:true with 0 rows, or ok:false — both are acceptable safe outcomes
    if (result.ok) {
      expect(result.rows).toHaveLength(0)
    } else {
      expect(typeof result.error).toBe('string')
    }
  })
})
