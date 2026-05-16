import { describe, it, expect } from 'vitest'
import { utils, write } from 'xlsx'
import { parseOccupancyXlsx } from '@/features/imports/lib/parseOccupancyXlsx'

// ---------------------------------------------------------------------------
// Helpers — old 11-column format (Navis_Popunjenost_2026_v2 style)
// ---------------------------------------------------------------------------

/**
 * Build a minimal Navis Popunjenost .xlsx buffer from data rows.
 * Rows 1-4 are placeholder header rows; data starts at row 5.
 * Layout: Datum | Dan | Free Sup | Free Exe | Free Sui | Free Total |
 *         Occ Sup | Occ Exe | Occ Sui | Occ Total | Pct
 */
function makeXlsxOld(dataRows: unknown[][]): ArrayBuffer {
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

// Alias kept for backward compat with original tests
const makeXlsx = makeXlsxOld

/** Valid old-format data row. Columns: date, day, freeSup, freeExe, freeSui, freeTotal, occSup, occExe, occSui, occTotal, pct */
function validRowOld(date: string): unknown[] {
  // Superior: 23 (occ=15, free=8), Executive: 17 (occ=10, free=7), Suite: 4 (occ=3, free=1)
  return [date, 'Pon', 8, 7, 1, 16, 15, 10, 3, 28, 0.636]
}

// Alias kept for backward compat with original tests
const validRow = validRowOld

// ---------------------------------------------------------------------------
// Helpers — new 15-column format (Hotel_Navis_Popunjenost_2026 style)
// Per-type ordering: Free → Occ → Pct, plus Mjesec at index 2.
// ---------------------------------------------------------------------------

/**
 * Build a 15-column xlsx buffer.
 * Layout: Datum | Dan | Mjesec |
 *         Free Sup | Occ Sup | Pct Sup |
 *         Free Exe | Occ Exe | Pct Exe |
 *         Free Sui | Occ Sui | Pct Sui |
 *         Free Total | Occ Total | Pct Total
 */
function makeXlsxNew(dataRows: unknown[][]): ArrayBuffer {
  const wb = utils.book_new()
  const allRows: unknown[][] = [
    ['Popunjenost po vrstama soba'],
    ['Hotel Navis'],
    [],
    [
      'Datum', 'Dan', 'Mjesec',
      'Free Superior', 'Occ Superior', 'Pct Superior',
      'Free Executive', 'Occ Executive', 'Pct Executive',
      'Free Suite', 'Occ Suite', 'Pct Suite',
      'Free Total', 'Occ Total', 'Pct Total',
    ],
    ...dataRows,
  ]
  const ws = utils.aoa_to_sheet(allRows)
  utils.book_append_sheet(wb, ws, 'Sheet1')
  return write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

/** Valid new-format data row. Same underlying room numbers as validRowOld. */
function validRowNew(date: string): unknown[] {
  // date, day, month, freeSup, occSup, pctSup, freeExe, occExe, pctExe, freeSui, occSui, pctSui, freeTotal, occTotal, pctTotal
  return [date, 'Pon', 'Tra', 8, 15, 0.652, 7, 10, 0.588, 1, 3, 0.75, 16, 28, 0.636]
}

// ---------------------------------------------------------------------------
// Helpers — merged-cell format (group header row above sub-header row)
// ---------------------------------------------------------------------------

/**
 * Build a xlsx with a merged-cell group header above Croatian sub-headers.
 * Row 3: group labels (only first cell of each group is non-null — SheetJS merged cell behaviour)
 * Row 4: Datum | Dan | Miesec | Slobodno | Zauzeto | Popunjenost | (×4 groups)
 * Row 5+: data
 */
function makeXlsxMerged(dataRows: unknown[][]): ArrayBuffer {
  const wb = utils.book_new()
  const allRows: unknown[][] = [
    ['Popunjenost po vrstama soba'],
    ['Hotel Navis'],
    [],
    // Group header row — merged cells: value only in first cell of group
    [null, null, null, 'SUPERIOR ROOM (23)', null, null, 'EXECUTIVE ROOM (17)', null, null, 'SUITE (4)', null, null, 'UKUPNO (44)', null, null],
    // Sub-header row (this is the row findHeaderRowIdx will locate via 'datum')
    ['Datum', 'Dan', 'Mjesec', 'Slobodno', 'Zauzeto', 'Popunjenost', 'Slobodno', 'Zauzeto', 'Popunjenost', 'Slobodno', 'Zauzeto', 'Popunjenost', 'Slobodno', 'Zauzeto', 'Popunjenost'],
    ...dataRows,
  ]
  const ws = utils.aoa_to_sheet(allRows)
  utils.book_append_sheet(wb, ws, 'Sheet1')
  return write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

/** Valid merged-format data row — same column positions as new 15-col format. */
function validRowMerged(date: string): unknown[] {
  // Datum, Dan, Mjesec, freeSup, occSup, pctSup, freeExe, occExe, pctExe, freeSui, occSui, pctSui, freeTotal, occTotal, pctTotal
  return [date, 'Pon', 'Tra', 8, 15, 0.652, 7, 10, 0.588, 1, 3, 0.75, 16, 28, 0.636]
}

// ---------------------------------------------------------------------------
// Helpers — Hotel_Navis_Popunjenost_2026 format
// Title in A1, subtitle (with room-type keywords) in A2, blank row,
// group header row with "DATUM" at col 0, Croatian sub-header row, data.
// ---------------------------------------------------------------------------

/**
 * Build a xlsx matching the real Hotel_Navis_Popunjenost_2026.xlsx layout:
 *   Row 1: title (A1 only)
 *   Row 2: subtitle containing "Superior", "Executive", "Suite" keywords (A2 only)
 *   Row 3: blank
 *   Row 4: group header — "DATUM" | null | null | "SUPERIOR ROOM (23)" | …
 *   Row 5: sub-header — "Datum" | "Dan" | "Mjesec" | "Slobodno" | …
 *   Row 6+: data
 */
function makeXlsxNavis(dataRows: unknown[][]): ArrayBuffer {
  const wb = utils.book_new()
  const allRows: unknown[][] = [
    ['HOTEL NAVIS — POPUNJENOST 2026'],
    ['Kapacitet: 44 jedinica | Superior: 23 | Executive: 17 | Suite: 4'],
    [],
    // Group header row — "DATUM" at col 0 is the key difference vs makeXlsxMerged
    ['DATUM', null, null, 'SUPERIOR ROOM (23)', null, null, 'EXECUTIVE ROOM (17)', null, null, 'SUITE (4)', null, null, 'UKUPNO (44)', null, null],
    // Sub-header row (findHeaderRowIdx locates this via 'datum')
    ['Datum', 'Dan', 'Mjesec', 'Slobodno', 'Zauzeto', 'Popunjenost', 'Slobodno', 'Zauzeto', 'Popunjenost', 'Slobodno', 'Zauzeto', 'Popunjenost', 'Slobodno', 'Zauzeto', 'Popunjenost'],
    ...dataRows,
  ]
  const ws = utils.aoa_to_sheet(allRows)
  utils.book_append_sheet(wb, ws, 'Sheet1')
  return write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

// ---------------------------------------------------------------------------
// Original tests (must continue to pass)
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

// ---------------------------------------------------------------------------
// New-format tests
// ---------------------------------------------------------------------------

describe('parseOccupancyXlsx — new 15-column format', () => {
  it('parses 245 data rows correctly', () => {
    const dates: string[] = []
    for (let i = 0; i < 245; i++) {
      const d = new Date(2026, 4, 1)
      d.setDate(d.getDate() + i)
      dates.push(d.toISOString().slice(0, 10))
    }
    const buf = makeXlsxNew(dates.map(validRowNew))
    const result = parseOccupancyXlsx(buf)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rows).toHaveLength(245)
  })

  it('reads correct field values from new layout', () => {
    const buf = makeXlsxNew([validRowNew('2026-05-01')])
    const result = parseOccupancyXlsx(buf)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const row = result.rows[0]
    expect(row.free_sup).toBe(8)
    expect(row.occ_sup).toBe(15)
    expect(row.free_exe).toBe(7)
    expect(row.occ_exe).toBe(10)
    expect(row.free_sui).toBe(1)
    expect(row.occ_sui).toBe(3)
    expect(row.occ_total).toBe(28)
    expect(row.pct).toBeCloseTo(0.636)
    expect(row.day).toBe('Pon')
  })

  it('produces identical field values to old format for the same source data', () => {
    const dates = ['2026-05-01', '2026-06-15', '2026-12-31']
    const bufOld = makeXlsxOld(dates.map(validRowOld))
    const bufNew = makeXlsxNew(dates.map(validRowNew))

    const rOld = parseOccupancyXlsx(bufOld)
    const rNew = parseOccupancyXlsx(bufNew)
    expect(rOld.ok).toBe(true)
    expect(rNew.ok).toBe(true)
    if (!rOld.ok || !rNew.ok) return

    expect(rOld.rows).toHaveLength(rNew.rows.length)
    for (let i = 0; i < rOld.rows.length; i++) {
      const o = rOld.rows[i]
      const n = rNew.rows[i]
      expect(n.date).toBe(o.date)
      expect(n.free_sup).toBe(o.free_sup)
      expect(n.occ_sup).toBe(o.occ_sup)
      expect(n.free_exe).toBe(o.free_exe)
      expect(n.occ_exe).toBe(o.occ_exe)
      expect(n.free_sui).toBe(o.free_sui)
      expect(n.occ_sui).toBe(o.occ_sui)
      expect(n.occ_total).toBe(o.occ_total)
      expect(n.pct).toBeCloseTo(o.pct)
    }
  })
})

// ---------------------------------------------------------------------------
// Merged-cell format tests
// ---------------------------------------------------------------------------

describe('parseOccupancyXlsx — merged-cell / Croatian sub-header format', () => {
  it('parses data using carry-forward parent row context', () => {
    const buf = makeXlsxMerged([validRowMerged('2026-05-01')])
    const result = parseOccupancyXlsx(buf)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const row = result.rows[0]
    expect(row.free_sup).toBe(8)
    expect(row.occ_sup).toBe(15)
    expect(row.free_exe).toBe(7)
    expect(row.occ_exe).toBe(10)
    expect(row.free_sui).toBe(1)
    expect(row.occ_sui).toBe(3)
    expect(row.occ_total).toBe(28)
    expect(row.pct).toBeCloseTo(0.636)
  })

  it('header row is detected at the sub-header row (row 5, 1-based)', () => {
    // The group row is at 0-based index 3; the sub-header (with "Datum") is at index 4.
    // Data starts at index 5, so first rowIndex = 4 + 0 + 2 = 6.
    const buf = makeXlsxMerged([validRowMerged('2026-05-01')])
    const result = parseOccupancyXlsx(buf)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rows[0].rowIndex).toBe(6)
  })
})

// ---------------------------------------------------------------------------
// Header detection edge cases
// ---------------------------------------------------------------------------

describe('parseOccupancyXlsx — header detection', () => {
  it('finds header row at index 3 for old format (row 4, 1-based)', () => {
    // Old format: header at 0-based index 3 → first data rowIndex = 3 + 0 + 2 = 5
    const buf = makeXlsxOld([validRowOld('2026-05-01')])
    const result = parseOccupancyXlsx(buf)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rows[0].rowIndex).toBe(5)
  })

  it('finds header row at index 3 for new 15-column format', () => {
    // New format also has header at 0-based index 3 → first data rowIndex = 5
    const buf = makeXlsxNew([validRowNew('2026-05-01')])
    const result = parseOccupancyXlsx(buf)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rows[0].rowIndex).toBe(5)
  })

  it('returns ok:false with explanation when columns cannot be mapped', () => {
    // Build a file with a recognisable header row (contains "Datum") but with
    // unrecognisable column names — parser should report which columns are missing.
    const wb = utils.book_new()
    const ws = utils.aoa_to_sheet([
      ['Report'],
      ['Datum', 'Dan', 'ColA', 'ColB', 'ColC'],
      ['2026-05-01', 'Pon', 1, 2, 3],
    ])
    utils.book_append_sheet(wb, ws, 'Sheet1')
    const buf = write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer

    const result = parseOccupancyXlsx(buf)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/could not map required columns/i)
    // Should name at least one of the missing columns
    expect(result.error).toMatch(/free_sup|occ_sup|occ_total/i)
  })

  it('returns ok:false when no header row is found at all', () => {
    // All-numeric sheet — no row with "datum" or keyword cluster
    const wb = utils.book_new()
    const ws = utils.aoa_to_sheet([
      [1, 2, 3],
      [4, 5, 6],
    ])
    utils.book_append_sheet(wb, ws, 'Sheet1')
    const buf = write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer

    const result = parseOccupancyXlsx(buf)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/header row/i)
  })
})

// ---------------------------------------------------------------------------
// Parent context / title-row isolation tests
// ---------------------------------------------------------------------------

describe('parseOccupancyXlsx — parent context isolation', () => {
  it('new format: title+subtitle above group row — group row used, subtitle ignored', () => {
    // The subtitle "Kapacitet: … | Superior: 23 | Executive: 17 | Suite: 4" contains
    // room-type keywords. With the old multi-row scan it polluted combined[0..2] and
    // broke the "dan" matcher. With the fix only the immediate group row is used.
    const buf = makeXlsxNavis([validRowMerged('2026-05-01')])
    const result = parseOccupancyXlsx(buf)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const row = result.rows[0]
    expect(row.date).toBe('2026-05-01')
    expect(row.day).toBe('Pon')
    expect(row.free_sup).toBe(8)
    expect(row.occ_sup).toBe(15)
    expect(row.free_exe).toBe(7)
    expect(row.occ_exe).toBe(10)
    expect(row.free_sui).toBe(1)
    expect(row.occ_sui).toBe(3)
    expect(row.occ_total).toBe(28)
    expect(row.pct).toBeCloseTo(0.636)
  })

  it('old format: no grouping row above header — parent context is empty, columns matched by own labels', () => {
    // makeXlsxOld has a blank row immediately above its header row.
    // isGroupingRow([]) → false → parentCells all empty → combined = header labels only.
    const buf = makeXlsxOld([validRowOld('2026-06-01')])
    const result = parseOccupancyXlsx(buf)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const row = result.rows[0]
    expect(row.date).toBe('2026-06-01')
    expect(row.free_sup).toBe(8)
    expect(row.occ_sup).toBe(15)
    expect(row.occ_total).toBe(28)
  })

  it('multiple title/subtitle rows above header — all ignored, only immediate prev row considered', () => {
    // Build a file with 5 rows of titles/subtitles before the plain header row.
    // None of those rows are grouping rows → parentCells all empty → columns matched by own labels.
    const wb = utils.book_new()
    const allRows: unknown[][] = [
      ['Report Title'],
      ['Subtitle line 1 — Superior Executive Suite'],  // room keywords but only 1 non-empty cell
      ['Subtitle line 2'],
      ['Generated: 2026-01-01'],
      [],
      // Header row at 0-based index 5 — findHeaderRowIdx picks this via 'datum'
      ['Datum', 'Dan', 'Free Superior', 'Free Executive', 'Free Suite', 'Free Total',
       'Occ Superior', 'Occ Executive', 'Occ Suite', 'Occ Total', 'Pct'],
      validRowOld('2026-07-01'),
    ]
    utils.book_append_sheet(wb, utils.aoa_to_sheet(allRows), 'Sheet1')
    const buf = write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer

    const result = parseOccupancyXlsx(buf)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.rows[0].date).toBe('2026-07-01')
    expect(result.rows[0].free_sup).toBe(8)
    expect(result.rows[0].occ_sup).toBe(15)
    expect(result.rows[0].occ_total).toBe(28)
  })
})
