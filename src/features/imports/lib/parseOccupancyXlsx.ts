import { read, utils } from 'xlsx'
import type { OccupancyParsedRow } from '../types'

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/**
 * Convert an Excel serial date number to YYYY-MM-DD.
 * Excel epoch: Dec 30, 1899 (UTC), with the well-known 1900 leap-year bug.
 */
function excelSerialToISO(serial: number): string {
  const excelEpochMs = Date.UTC(1899, 11, 30) // -2209161600000
  const utcMs = excelEpochMs + serial * 86400000
  const d = new Date(utcMs)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDateCell(raw: unknown): string | null {
  if (raw == null) return null
  if (raw instanceof Date) {
    // SheetJS with cellDates: true returns local-time Date objects
    const y = raw.getFullYear()
    const m = String(raw.getMonth() + 1).padStart(2, '0')
    const d = String(raw.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof raw === 'number') {
    return excelSerialToISO(raw)
  }
  if (typeof raw === 'string') {
    // Croatian DD.MM.YYYY format
    const match = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
    if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  }
  return null
}

function toInt(raw: unknown): number | null {
  if (raw == null) return null
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10)
  return isNaN(n) ? null : n
}

function toFloat(raw: unknown): number | null {
  if (raw == null) return null
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw))
  return isNaN(n) ? null : n
}

// ---------------------------------------------------------------------------
// Header-driven column detection
// ---------------------------------------------------------------------------

function cellStr(c: unknown): string {
  if (c == null) return ''
  return String(c).trim().toLowerCase()
}

// Keywords that appear in occupancy report header rows
const HEADER_KEYWORDS = [
  'datum', 'slobodno', 'zauzeto', 'popunjenost',
  'superior', 'executive', 'suite', 'free', 'occ', 'pct',
]

// Value-column keywords that appear in sub-header rows but NOT in merged group
// header rows (which only contain room-type names like "SUPERIOR ROOM (23)").
const VALUE_KEYWORDS = ['slobodno', 'zauzeto', 'popunjenost', 'free', 'occ', 'pct']

/**
 * Scan the first 10 rows for the data header row.
 *
 * Primary signal: a row containing a cell with "datum" (the date column label).
 * This correctly skips group-header rows like "SUPERIOR ROOM (23)" that might
 * score high on room-type keywords but never contain "datum".
 *
 * Fallback: a row with 3+ header keywords AND at least 2 value-type keywords
 * (free/occ/slobodno/zauzeto/pct/popunjenost). The fallback handles exotic
 * layouts where the date column has a non-standard label, while still
 * rejecting pure room-type group rows.
 *
 * Returns the 0-based row index, or -1 if not found.
 */
function findHeaderRowIdx(allRows: unknown[][]): number {
  const limit = Math.min(10, allRows.length)

  // First pass: prefer datum + at least one value keyword in the same row.
  // This correctly skips group-header rows that use "DATUM" as a category label
  // (e.g. "DATUM | _ | _ | SUPERIOR ROOM (23) | …") since those rows have no
  // value keywords (slobodno/zauzeto/free/occ/pct/popunjenost).
  for (let i = 0; i < limit; i++) {
    const row = allRows[i]
    if (!Array.isArray(row)) continue
    const cells = row.map(cellStr)
    if (
      cells.some((c) => c.includes('datum')) &&
      cells.some((c) => VALUE_KEYWORDS.some((k) => c.includes(k)))
    ) return i
    // Fallback: 3+ header keywords AND 2+ value keywords (handles exotic layouts)
    const kwCount = cells.filter((c) => HEADER_KEYWORDS.some((k) => c.includes(k))).length
    const vkCount = cells.filter((c) => VALUE_KEYWORDS.some((k) => c.includes(k))).length
    if (kwCount >= 3 && vkCount >= 2) return i
  }

  // Second pass: datum alone (no value keywords in the row), but only accept
  // rows that are NOT column-grouping rows.  This handles simple/exotic formats
  // where the header row has "Datum" plus unrecognised column names.
  for (let i = 0; i < limit; i++) {
    const row = allRows[i]
    if (!Array.isArray(row)) continue
    const cells = row.map(cellStr)
    if (cells.some((c) => c.includes('datum')) && !isGroupingRow(row)) return i
  }

  return -1
}

// Keywords that identify a column-grouping row (room type names / aggregates)
const GROUPING_KEYWORDS = ['superior', 'executive', 'suite', 'ukupno', 'total']

/**
 * Returns true only if the row looks like a column-grouping row:
 *  - 3+ non-empty cells distributed across columns
 *  - 2+ cells contain room-type keywords
 * This rejects title/subtitle rows that have a single value (possibly merged).
 */
function isGroupingRow(row: unknown[]): boolean {
  const cells = row.map(cellStr).filter(Boolean)
  if (cells.length < 3) return false
  const roomCount = cells.filter((c) => GROUPING_KEYWORDS.some((k) => c.includes(k))).length
  return roomCount >= 2
}

type ColMap = {
  datum: number
  dan: number
  free_sup: number
  free_exe: number
  free_sui: number
  occ_sup: number
  occ_exe: number
  occ_sui: number
  occ_total: number
  pct: number
}

/**
 * Build a column index map from the header row.
 *
 * Handles two layouts:
 *
 * 1. Single-row headers with full names, e.g.:
 *    "Free Superior", "Occ Superior", "Pct Superior", …, "Occ Total", "Pct"
 *
 * 2. Merged-cell "group header" rows above the sub-header row, e.g.:
 *    Row above: [null, null, "SUPERIOR ROOM (23)", null, null, "EXECUTIVE…", …]
 *    Header row: ["Datum", "Dan", "Slobodno", "Zauzeto", "Popunjenost", …]
 *    In this case "Slobodno" alone isn't enough — we carry forward the parent
 *    label from the row above so each sub-header gets a composite key like
 *    "superior room (23) slobodno", which then matches isSup + isFree.
 *
 * Returns a string (error message) when required columns cannot be mapped.
 */
function buildColMap(allRows: unknown[][], headerIdx: number): ColMap | string {
  const headerRow = allRows[headerIdx] as unknown[]
  const len = headerRow.length

  // Only use the immediately previous row as parent context, and only if it
  // looks like a column-grouping row (e.g. "SUPERIOR ROOM (23) | …").
  // Title/subtitle rows that span the sheet in a single merged cell are ignored,
  // preventing their content from polluting the combined column labels.
  const parentCells: string[] = new Array(len).fill('')
  if (headerIdx > 0) {
    const prevRow = allRows[headerIdx - 1]
    if (Array.isArray(prevRow) && isGroupingRow(prevRow)) {
      let lastSeen = ''
      for (let col = 0; col < len; col++) {
        const v = cellStr(prevRow[col])
        if (v) {
          // Only start a carry-forward from room-type group labels.
          // Non-room structural labels (e.g. "DATUM") are ignored so they
          // don't pollute the columns that fall under them.
          lastSeen = GROUPING_KEYWORDS.some((k) => v.includes(k)) ? v : ''
        }
        if (lastSeen) parentCells[col] = lastSeen
      }
    }
  }

  // Combined label per column: parent context + the cell's own label.
  const combined = headerRow.map((cell, i) => {
    const c = cellStr(cell)
    const p = parentCells[i]
    return p ? `${p} ${c}` : c
  })

  // --- Matchers ---
  const isFree = (s: string) => s.includes('free') || s.includes('slobodno')
  const isOcc = (s: string) => s.includes('occ') || s.includes('zauzeto')
  const isPct = (s: string) => s.includes('pct') || s.includes('popunjenost')
  const isSup = (s: string) => s.includes('sup') // "superior", "sup"
  const isExe = (s: string) => s.includes('exe') // "executive", "exe"
  const isSui = (s: string) => s.includes('sui') || s.includes('šui') // "suite"
  const isTotal = (s: string) => s.includes('total') || s.includes('ukupno')

  const find = (pred: (s: string) => boolean): number => combined.findIndex(pred)
  const findLast = (pred: (s: string) => boolean): number => {
    for (let i = combined.length - 1; i >= 0; i--) {
      if (pred(combined[i])) return i
    }
    return -1
  }

  const datum = find((s) => s.includes('datum'))
  const dan = find((s) => s.includes('dan') && !s.includes('datum'))
  const free_sup = find((s) => isFree(s) && isSup(s))
  const free_exe = find((s) => isFree(s) && isExe(s))
  const free_sui = find((s) => isFree(s) && isSui(s))
  const occ_sup = find((s) => isOcc(s) && isSup(s))
  const occ_exe = find((s) => isOcc(s) && isExe(s))
  const occ_sui = find((s) => isOcc(s) && isSui(s))
  const occ_total = find((s) => isOcc(s) && isTotal(s))

  // For pct: prefer the column also matching "total"/"ukupno"; otherwise take
  // the last pct column (old format has a single trailing "Pct" column).
  const pct_total = find((s) => isPct(s) && isTotal(s))
  const pct = pct_total !== -1 ? pct_total : findLast(isPct)

  const cols = { datum, dan, free_sup, free_exe, free_sui, occ_sup, occ_exe, occ_sui, occ_total, pct }
  const missing = (Object.entries(cols) as [string, number][])
    .filter(([, v]) => v === -1)
    .map(([k]) => k)

  if (missing.length > 0) {
    return (
      `Could not map required columns: ${missing.join(', ')}. ` +
      `Headers detected: [${combined.filter(Boolean).join(' | ')}]`
    )
  }

  return cols
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type ParseOccupancyResult =
  | { ok: true; rows: OccupancyParsedRow[] }
  | { ok: false; error: string }

/**
 * Parse a Navis / Hotel Navis Popunjenost .xlsx file.
 *
 * Uses header-driven column detection so it works with both the old 11-column
 * layout (all Free columns first, then all Occ) and the new 15-column layout
 * (Free → Occ → Pct per room type, plus a "Mjesec" column).  Also handles
 * merged-cell group headers where sub-headers like "Slobodno"/"Zauzeto" appear
 * below a parent row like "SUPERIOR ROOM (23)".
 *
 * Returns `{ ok: false }` only on fatal parse errors (corrupt file, missing
 * sheet, unmappable headers).  Per-row validation errors are handled separately
 * by `validateOccupancyRow`.
 */
export function parseOccupancyXlsx(buffer: ArrayBuffer): ParseOccupancyResult {
  try {
    const wb = read(buffer, { type: 'array', cellDates: true })

    if (!wb.SheetNames.length) {
      return { ok: false, error: 'The file contains no worksheets.' }
    }

    const ws = wb.Sheets[wb.SheetNames[0]]
    // header: 1 → returns array-of-arrays; defval: null → empty cells are null
    const allRows = utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })

    // --- Locate the header row ---
    const headerIdx = findHeaderRowIdx(allRows)
    if (headerIdx === -1) {
      return {
        ok: false,
        error:
          'Could not find the header row. ' +
          'Expected a row containing "Datum" within the first 10 rows.',
      }
    }

    // --- Map column indices from header labels ---
    const colMapOrError = buildColMap(allRows, headerIdx)
    if (typeof colMapOrError === 'string') {
      return { ok: false, error: colMapOrError }
    }
    const COL = colMapOrError

    // --- Parse data rows ---
    const dataRows = allRows.slice(headerIdx + 1)
    const rows: OccupancyParsedRow[] = []

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i]

      // Skip completely empty rows (trailing blank rows in some exports)
      if (!row || !Array.isArray(row) || row.every((c) => c == null || c === '')) continue

      const date = parseDateCell(row[COL.datum])
      if (!date) continue // row without a parseable date → skip silently

      const day = row[COL.dan] != null ? String(row[COL.dan]) : ''

      const free_sup = toInt(row[COL.free_sup]) ?? 0
      const free_exe = toInt(row[COL.free_exe]) ?? 0
      const free_sui = toInt(row[COL.free_sui]) ?? 0
      const occ_sup = toInt(row[COL.occ_sup]) ?? 0
      const occ_exe = toInt(row[COL.occ_exe]) ?? 0
      const occ_sui = toInt(row[COL.occ_sui]) ?? 0
      const occ_total = toInt(row[COL.occ_total]) ?? 0
      const pct = toFloat(row[COL.pct]) ?? 0

      rows.push({
        // 1-based row number in the xlsx (headerIdx is 0-based, add 2: one for
        // the header row itself, one for 1-based indexing)
        rowIndex: headerIdx + i + 2,
        date,
        day,
        free_sup,
        free_exe,
        free_sui,
        occ_sup,
        occ_exe,
        occ_sui,
        occ_total,
        pct,
      })
    }

    return { ok: true, rows }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to parse the xlsx file.',
    }
  }
}
