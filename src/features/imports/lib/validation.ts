import type { PhobsParsedRow } from '../types'

// ---------------------------------------------------------------------------
// Per-row validation — runs before room-type and status mapping.
// Returns null if valid, or a human-readable error string.
// ---------------------------------------------------------------------------

function isValidDate(str: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return false
  const d = new Date(str)
  return !isNaN(d.getTime())
}

export type ValidationResult = { ok: true } | { ok: false; reason: string }

export function validatePhobsRow(
  row: PhobsParsedRow,
  totalAmount: number | null,
): ValidationResult {
  if (!row.code.trim()) {
    return { ok: false, reason: 'Missing reservation code (Code)' }
  }
  if (!isValidDate(row.dolazak)) {
    return { ok: false, reason: `Invalid check-in date: "${row.dolazak}"` }
  }
  if (!isValidDate(row.odlazak)) {
    return { ok: false, reason: `Invalid check-out date: "${row.odlazak}"` }
  }
  if (row.odlazak <= row.dolazak) {
    return { ok: false, reason: 'Check-out date must be after check-in date' }
  }
  if (!row.smjestaj.trim()) {
    return { ok: false, reason: 'Missing room type (Smještaj)' }
  }
  if (totalAmount === null || totalAmount <= 0) {
    return { ok: false, reason: `Invalid total amount: "${row.ukupno}"` }
  }
  return { ok: true }
}
