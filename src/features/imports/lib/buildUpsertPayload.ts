import type { PreviewRow } from '../types'

// ---------------------------------------------------------------------------
// Builds the Supabase upsert payload for a single preview row.
//
// This is a pure function — no DB calls. Extracted so it can be unit-tested
// for idempotency and cancellation_date preservation rules.
// ---------------------------------------------------------------------------

export type UpsertPayload = {
  source: 'phobs_excel'
  phobs_reservation_id: string
  external_reservation_id: null
  booked_date: string
  check_in_date: string
  check_out_date: string
  cancellation_date: string | null
  room_type_id: string
  rooms_count: 1
  guest_name: string | null
  guest_country: string | null
  guest_count: number | null
  channel: string
  total_amount: number
  currency: string
  status: 'confirmed' | 'cancelled'
  notes: null
  raw_payload: Record<string, string>
  deleted_at: null
}

export type ExistingReservationSnap = {
  cancellation_date: string | null
}

export function buildUpsertPayload(
  row: PreviewRow,
  existing: ExistingReservationSnap | undefined,
): UpsertPayload {
  // Cancellation_date idempotency rule:
  //   If the row is a cancellation AND an existing row already has
  //   cancellation_date set, preserve the original date (don't overwrite
  //   with today's date on re-import).
  let cancellation_date = row.cancellation_date
  if (row.action === 'cancel' && existing?.cancellation_date) {
    cancellation_date = existing.cancellation_date
  }

  return {
    source: 'phobs_excel',
    phobs_reservation_id: row.phobs_reservation_id,
    external_reservation_id: null,
    booked_date: row.booked_date,
    check_in_date: row.check_in_date,
    check_out_date: row.check_out_date,
    cancellation_date,
    room_type_id: row.room_type_id!,
    rooms_count: 1,
    guest_name: row.guest_name || null,
    guest_country: row.guest_country,
    guest_count: row.guest_count > 0 ? row.guest_count : null,
    channel: row.channel,
    total_amount: row.total_amount ?? 0,
    currency: row.currency || 'EUR',
    status: row.status ?? 'confirmed',
    notes: null,
    raw_payload: row.raw_payload,
    deleted_at: null,
  }
}
