import type { PhobsParsedRow, PreviewRow, SkipReason } from '../types'
import type { RoomType } from '@/types/database'

// ---------------------------------------------------------------------------
// Channel mapping
// ---------------------------------------------------------------------------

export function mapChannel(origin: string): string {
  const lower = origin.toLowerCase().trim()
  if (lower === 'object') return 'direct'
  if (lower === 'expedia.com') return 'expedia'
  if (lower === 'booking.com') return 'booking_com'
  if (lower === 'airbnb') return 'airbnb'
  return lower.replace(/\s+/g, '_')
}

// ---------------------------------------------------------------------------
// Room type mapping
// ---------------------------------------------------------------------------

export type RoomTypeMatch =
  | { ok: true; id: string; name: string }
  | { ok: false; reason: string }

export function matchRoomType(smjestaj: string, roomTypes: RoomType[]): RoomTypeMatch {
  const lower = smjestaj.toLowerCase()

  let keyword: string | null = null
  if (lower.includes('superior')) keyword = 'superior'
  else if (lower.includes('executive')) keyword = 'executive'
  else if (lower.includes('suite')) keyword = 'suite'

  if (!keyword) {
    return {
      ok: false,
      reason: `Smještaj '${smjestaj}' did not match any known room type`,
    }
  }

  const found = roomTypes.find(
    (rt) => rt.deleted_at === null && rt.name.toLowerCase().includes(keyword!)
  )

  if (!found) {
    return {
      ok: false,
      reason: `No active room type in database matches '${keyword}'`,
    }
  }

  return { ok: true, id: found.id, name: found.name }
}

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

export type StatusMapping =
  | { action: 'confirmed' | 'cancelled' }
  | { action: 'skip'; reason: 'pending_status' | 'unknown_status'; detail: string }

export function mapStatus(statusRaw: string): StatusMapping {
  const lower = statusRaw.toLowerCase().trim()
  if (lower === 'ok') return { action: 'confirmed' }
  if (lower === 'izmjena') return { action: 'confirmed' }
  if (lower === 'poništena') return { action: 'cancelled' }
  if (lower === 'na čekanju') {
    return { action: 'skip', reason: 'pending_status', detail: 'Pending reservation — not imported' }
  }
  return {
    action: 'skip',
    reason: 'unknown_status',
    detail: `Unknown status: "${statusRaw}"`,
  }
}

// ---------------------------------------------------------------------------
// HR decimal parser: "1.293,12" → 1293.12
// ---------------------------------------------------------------------------

export function parseHrDecimal(value: string): number | null {
  const cleaned = value.trim().replace(/\./g, '').replace(',', '.')
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? null : parsed
}

// ---------------------------------------------------------------------------
// ISO timestamp → date portion only
// ---------------------------------------------------------------------------

export function parseDatePortion(value: string): string {
  return value.trim().slice(0, 10)
}

// ---------------------------------------------------------------------------
// Main row mapper
// ---------------------------------------------------------------------------

export function mapPhobsRow(
  raw: PhobsParsedRow,
  roomTypes: RoomType[],
  today: string,
): PreviewRow {
  const channel = mapChannel(raw.origin)
  const totalAmount = parseHrDecimal(raw.ukupno)
  const adultsN = parseInt(raw.odraslih, 10)
  const childrenN = parseInt(raw.djeca, 10)
  const adults = isNaN(adultsN) ? 0 : adultsN
  const children = isNaN(childrenN) ? 0 : childrenN
  const guestCount = adults + children

  const checkIn = raw.dolazak.trim()
  const checkOut = raw.odlazak.trim()
  const bookedDate = parseDatePortion(raw.datumNastanka)

  let nights: number | null = null
  let adrPerNight: number | null = null
  if (checkIn && checkOut) {
    const n =
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86_400_000
    if (n > 0) {
      nights = n
      if (totalAmount !== null) adrPerNight = totalAmount / n
    }
  }

  const rawPayload: Record<string, string> = { bookirano_unaprijed: raw.bookiranoUnaprijed }
  raw.allCells.forEach((cell, idx) => {
    rawPayload[`col_${idx}`] = cell
  })

  // Compose a unique ID per room row. Multi-room bookings share the same Code
  // but have distinct internalIds in column 0, so we combine them to prevent
  // ON CONFLICT collisions when N rooms arrive in the same import batch.
  let phobsReservationId: string
  if (raw.internalId) {
    phobsReservationId = `${raw.code}-${raw.internalId}`
  } else {
    console.warn(
      `[mapPhobsRow] row ${raw.rowIndex}: internalId (col 0) is empty — falling back to code only ("${raw.code}")`
    )
    phobsReservationId = raw.code
  }

  const base = {
    phobs_reservation_id: phobsReservationId,
    channel,
    check_in_date: checkIn,
    check_out_date: checkOut,
    booked_date: bookedDate,
    guest_name: raw.nositeljRezervacije,
    guest_country: raw.drzava || null,
    adults,
    children,
    guest_count: guestCount,
    currency: raw.valuta || 'EUR',
    total_amount: totalAmount,
    nights,
    adr_per_night: adrPerNight,
    smjestaj_raw: raw.smjestaj,
    status_raw: raw.status,
    raw_payload: rawPayload,
  }

  // 1. Status check first
  const statusMap = mapStatus(raw.status)
  if (statusMap.action === 'skip') {
    return {
      rowIndex: raw.rowIndex,
      action: 'skip',
      skipReason: statusMap.reason satisfies SkipReason,
      skipDetail: statusMap.detail,
      ...base,
      room_type_id: null,
      room_type_name: null,
      status: null,
      cancellation_date: null,
    }
  }

  // 2. Room type mapping
  const roomTypeMatch = matchRoomType(raw.smjestaj, roomTypes)
  if (!roomTypeMatch.ok) {
    return {
      rowIndex: raw.rowIndex,
      action: 'skip',
      skipReason: 'unmapped_room_type' satisfies SkipReason,
      skipDetail: roomTypeMatch.reason,
      ...base,
      room_type_id: null,
      room_type_name: null,
      status: statusMap.action,
      cancellation_date: statusMap.action === 'cancelled' ? today : null,
    }
  }

  const status = statusMap.action

  return {
    rowIndex: raw.rowIndex,
    // action is 'cancel' for Poništena, 'new' for confirmed — hook overrides to
    // 'update' after DB lookup if phobs_reservation_id already exists
    action: status === 'cancelled' ? 'cancel' : 'new',
    ...base,
    room_type_id: roomTypeMatch.id,
    room_type_name: roomTypeMatch.name,
    status,
    cancellation_date: status === 'cancelled' ? today : null,
  }
}
