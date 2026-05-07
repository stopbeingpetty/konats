import type { OccupancyParsedRow, OccupancyValidationError } from '../types'

// ---------------------------------------------------------------------------
// Room capacities (fixed for this hotel)
// ---------------------------------------------------------------------------

export const ROOM_CAPACITY = {
  sup: 23,
  exe: 17,
  sui: 4,
} as const

export type OccupancyRowInput = Pick<
  OccupancyParsedRow,
  'occ_sup' | 'free_sup' | 'occ_exe' | 'free_exe' | 'occ_sui' | 'free_sui'
>

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: string }

/**
 * Validate a single occupancy row for required fields and capacity constraints.
 *
 * Capacity checks:
 *   occ_sup + free_sup === 23
 *   occ_exe + free_exe === 17
 *   occ_sui + free_sui === 4
 *
 * Returns `{ ok: false, reason }` on the first failing check.
 */
export function validateOccupancyRow(row: OccupancyRowInput): ValidationResult {
  // Required: all values must be non-negative numbers
  const fields: [string, number][] = [
    ['occ_sup', row.occ_sup],
    ['free_sup', row.free_sup],
    ['occ_exe', row.occ_exe],
    ['free_exe', row.free_exe],
    ['occ_sui', row.occ_sui],
    ['free_sui', row.free_sui],
  ]
  for (const [name, val] of fields) {
    if (!Number.isFinite(val) || val < 0) {
      return { ok: false, reason: `Invalid value for ${name}: ${val}` }
    }
  }

  // Capacity checks
  if (row.occ_sup + row.free_sup !== ROOM_CAPACITY.sup) {
    return {
      ok: false,
      reason: `Capacity mismatch for Superior: ${row.occ_sup} + ${row.free_sup} ≠ ${ROOM_CAPACITY.sup}`,
    }
  }
  if (row.occ_exe + row.free_exe !== ROOM_CAPACITY.exe) {
    return {
      ok: false,
      reason: `Capacity mismatch for Executive: ${row.occ_exe} + ${row.free_exe} ≠ ${ROOM_CAPACITY.exe}`,
    }
  }
  if (row.occ_sui + row.free_sui !== ROOM_CAPACITY.sui) {
    return {
      ok: false,
      reason: `Capacity mismatch for Suite: ${row.occ_sui} + ${row.free_sui} ≠ ${ROOM_CAPACITY.sui}`,
    }
  }

  return { ok: true }
}

/**
 * Validate all parsed rows, returning valid rows and validation errors separately.
 */
export function validateOccupancyRows(rows: OccupancyParsedRow[]): {
  validRows: OccupancyParsedRow[]
  errors: OccupancyValidationError[]
} {
  const validRows: OccupancyParsedRow[] = []
  const errors: OccupancyValidationError[] = []

  for (const row of rows) {
    const result = validateOccupancyRow(row)
    if (result.ok) {
      validRows.push(row)
    } else {
      errors.push({ rowIndex: row.rowIndex, date: row.date, reason: result.reason })
    }
  }

  return { validRows, errors }
}
