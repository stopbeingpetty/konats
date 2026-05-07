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
// Column indices (0-based, per Navis Popunjenost format)
// ---------------------------------------------------------------------------
const COL = {
  datum: 0,
  dan: 1,
  free_sup: 2,
  free_exe: 3,
  free_sui: 4,
  // free_total: 5 — not used
  occ_sup: 6,
  occ_exe: 7,
  occ_sui: 8,
  occ_total: 9,
  pct: 10,
} as const

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type ParseOccupancyResult =
  | { ok: true; rows: OccupancyParsedRow[] }
  | { ok: false; error: string }

/**
 * Parse a Navis Popunjenost .xlsx file.
 *
 * File structure:
 *   Rows 1–4: title / metadata (skipped)
 *   Row 5+: data rows with 11 columns
 *
 * Returns `{ ok: false }` only on fatal parse errors (corrupt file, missing sheet).
 * Per-row validation errors (capacity mismatches, missing fields) are handled
 * separately by `validateOccupancyRow` — this parser returns ALL parseable rows.
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

    // Skip the 4 header rows (rows 1–4, indices 0–3)
    const dataRows = allRows.slice(4)

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
        rowIndex: i + 5, // 1-based, accounting for 4 skipped header rows
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
