import { describe, it, expect } from 'vitest'
import {
  mapChannel,
  matchRoomType,
  mapStatus,
  parseHrDecimal,
  mapPhobsRow,
} from '@/features/imports/lib/mapPhobsRow'
import { buildUpsertPayload } from '@/features/imports/lib/buildUpsertPayload'
import type { RoomType } from '@/types/database'
import type { PreviewRow, PhobsParsedRow } from '@/features/imports/types'

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const MOCK_ROOM_TYPES: RoomType[] = [
  {
    id: 'rt-superior',
    name: 'Superior',
    code: 'SUP',
    default_room_count: 20,
    sort_order: 1,
    notes: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    deleted_at: null,
  },
  {
    id: 'rt-executive',
    name: 'Executive',
    code: 'EXE',
    default_room_count: 10,
    sort_order: 2,
    notes: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    deleted_at: null,
  },
  {
    id: 'rt-suite',
    name: 'Suite',
    code: 'STE',
    default_room_count: 4,
    sort_order: 3,
    notes: null,
    created_at: '2024-01-01',
    updated_at: '2024-01-01',
    deleted_at: null,
  },
]

const BASE_PREVIEW_ROW: PreviewRow = {
  rowIndex: 3,
  action: 'new',
  phobs_reservation_id: 'RES-12345',
  channel: 'expedia',
  check_in_date: '2024-07-10',
  check_out_date: '2024-07-14',
  booked_date: '2024-05-01',
  guest_name: 'TEST GUEST',
  guest_country: 'ES',
  room_type_id: 'rt-superior',
  room_type_name: 'Superior',
  adults: 2,
  children: 0,
  guest_count: 2,
  currency: 'EUR',
  total_amount: 1200,
  nights: 4,
  adr_per_night: 300,
  status: 'confirmed',
  cancellation_date: null,
  smjestaj_raw: 'Superior Room 101',
  status_raw: 'ok',
  raw_payload: {},
}

// ---------------------------------------------------------------------------
// mapChannel
// ---------------------------------------------------------------------------

describe('mapChannel', () => {
  it('maps Expedia.com to expedia', () => {
    expect(mapChannel('Expedia.com')).toBe('expedia')
  })

  it('maps Booking.com to booking_com', () => {
    expect(mapChannel('Booking.com')).toBe('booking_com')
  })

  it('maps Object to direct', () => {
    expect(mapChannel('Object')).toBe('direct')
  })

  it('maps Airbnb to airbnb', () => {
    expect(mapChannel('Airbnb')).toBe('airbnb')
  })

  it('is case-insensitive for all known channels', () => {
    expect(mapChannel('EXPEDIA.COM')).toBe('expedia')
    expect(mapChannel('booking.com')).toBe('booking_com')
    expect(mapChannel('OBJECT')).toBe('direct')
    expect(mapChannel('AIRBNB')).toBe('airbnb')
  })

  it('lowercases and replaces spaces for unknown channels', () => {
    expect(mapChannel('My Channel')).toBe('my_channel')
    expect(mapChannel('VRBO')).toBe('vrbo')
    expect(mapChannel('Trip Advisor')).toBe('trip_advisor')
  })
})

// ---------------------------------------------------------------------------
// matchRoomType
// ---------------------------------------------------------------------------

describe('matchRoomType', () => {
  it('matches "Junior Suite" to Suite room type', () => {
    const result = matchRoomType('Junior Suite 301', MOCK_ROOM_TYPES)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.id).toBe('rt-suite')
    expect(result.name).toBe('Suite')
  })

  it('matches bare "Suite" to Suite room type', () => {
    const result = matchRoomType('Suite', MOCK_ROOM_TYPES)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.id).toBe('rt-suite')
  })

  it('matches "Family Suite 401" to Suite room type', () => {
    const result = matchRoomType('Family Suite 401', MOCK_ROOM_TYPES)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.id).toBe('rt-suite')
  })

  it('matches "Superior Room 101" to Superior room type', () => {
    const result = matchRoomType('Superior Room 101', MOCK_ROOM_TYPES)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.id).toBe('rt-superior')
  })

  it('matches "Executive Suite" to Executive (superior match takes priority: "executive" keyword found first)', () => {
    // Both "executive" and "suite" present — spec says check superior, then executive, then suite
    // "Executive Suite" → contains "executive" → Executive
    const result = matchRoomType('Executive Suite', MOCK_ROOM_TYPES)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.id).toBe('rt-executive')
  })

  it('returns unmapped for Penthouse', () => {
    const result = matchRoomType('Penthouse', MOCK_ROOM_TYPES)
    expect(result.ok).toBe(false)
  })

  it('returns unmapped for empty string', () => {
    const result = matchRoomType('', MOCK_ROOM_TYPES)
    expect(result.ok).toBe(false)
  })

  it('is case-insensitive', () => {
    const result = matchRoomType('SUPERIOR DELUXE', MOCK_ROOM_TYPES)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.id).toBe('rt-superior')
  })

  it('ignores deleted room types', () => {
    const deletedSuperior: RoomType = {
      ...MOCK_ROOM_TYPES[0],
      id: 'rt-superior',
      deleted_at: '2024-06-01',
    }
    const roomTypesWithDeleted = [deletedSuperior, ...MOCK_ROOM_TYPES.slice(1)]
    // Superior is deleted, so "Superior Room" should be unmapped
    const result = matchRoomType('Superior Room', roomTypesWithDeleted)
    expect(result.ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// mapStatus
// ---------------------------------------------------------------------------

describe('mapStatus', () => {
  it('maps "ok" to confirmed', () => {
    expect(mapStatus('ok').action).toBe('confirmed')
  })

  it('maps "OK" (uppercase) to confirmed', () => {
    expect(mapStatus('OK').action).toBe('confirmed')
  })

  it('maps "Izmjena" to confirmed', () => {
    expect(mapStatus('Izmjena').action).toBe('confirmed')
  })

  it('maps "Poništena" to cancelled', () => {
    expect(mapStatus('Poništena').action).toBe('cancelled')
  })

  it('maps "Na čekanju" to skip with pending_status reason', () => {
    const result = mapStatus('Na čekanju')
    expect(result.action).toBe('skip')
    if (result.action !== 'skip') return
    expect(result.reason).toBe('pending_status')
  })

  it('maps unknown status to skip with unknown_status reason', () => {
    const result = mapStatus('some random status')
    expect(result.action).toBe('skip')
    if (result.action !== 'skip') return
    expect(result.reason).toBe('unknown_status')
  })

  it('maps empty string to skip with unknown_status', () => {
    const result = mapStatus('')
    expect(result.action).toBe('skip')
    if (result.action !== 'skip') return
    expect(result.reason).toBe('unknown_status')
  })
})

// ---------------------------------------------------------------------------
// parseHrDecimal — Croatian number format
// ---------------------------------------------------------------------------

describe('parseHrDecimal', () => {
  it('parses "1.293,12" to 1293.12', () => {
    expect(parseHrDecimal('1.293,12')).toBeCloseTo(1293.12, 2)
  })

  it('parses "467,42" to 467.42', () => {
    expect(parseHrDecimal('467,42')).toBeCloseTo(467.42, 2)
  })

  it('parses "1.200,00" to 1200.00', () => {
    expect(parseHrDecimal('1.200,00')).toBeCloseTo(1200.0, 2)
  })

  it('parses integer string "1200" to 1200', () => {
    expect(parseHrDecimal('1200')).toBe(1200)
  })

  it('parses large amount "12.345.678,90"', () => {
    expect(parseHrDecimal('12.345.678,90')).toBeCloseTo(12345678.9, 1)
  })

  it('returns null for non-parseable input', () => {
    expect(parseHrDecimal('invalid')).toBeNull()
    expect(parseHrDecimal('')).toBeNull()
    expect(parseHrDecimal('—')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// buildUpsertPayload — idempotency + cancellation_date preservation
// ---------------------------------------------------------------------------

describe('buildUpsertPayload — idempotency', () => {
  it('first import: produces a valid payload for a new row', () => {
    const payload = buildUpsertPayload(BASE_PREVIEW_ROW, undefined)
    expect(payload.phobs_reservation_id).toBe('RES-12345')
    expect(payload.status).toBe('confirmed')
    expect(payload.cancellation_date).toBeNull()
    expect(payload.source).toBe('phobs_excel')
    expect(payload.rooms_count).toBe(1)
  })

  it('second import of same Code produces identical key fields (idempotent)', () => {
    const updateRow: PreviewRow = { ...BASE_PREVIEW_ROW, action: 'update' }
    const first = buildUpsertPayload(BASE_PREVIEW_ROW, undefined)
    const second = buildUpsertPayload(updateRow, { cancellation_date: null })
    // Key identifying fields must be identical
    expect(second.phobs_reservation_id).toBe(first.phobs_reservation_id)
    expect(second.status).toBe(first.status)
    expect(second.check_in_date).toBe(first.check_in_date)
    expect(second.check_out_date).toBe(first.check_out_date)
  })

  it('cancellation_date is preserved when already set on existing row', () => {
    const cancelRow: PreviewRow = {
      ...BASE_PREVIEW_ROW,
      action: 'cancel',
      status: 'cancelled',
      // mapPhobsRow would set this to today, but we simulate today as 2024-06-15
      cancellation_date: '2024-06-15',
    }
    const existingOriginalDate = '2024-05-20'
    const payload = buildUpsertPayload(cancelRow, {
      cancellation_date: existingOriginalDate,
    })
    // Must preserve the original date, NOT use the re-import date
    expect(payload.cancellation_date).toBe('2024-05-20')
    expect(payload.cancellation_date).not.toBe('2024-06-15')
  })

  it('cancellation_date is set to the row value when row is newly cancelled', () => {
    const cancelRow: PreviewRow = {
      ...BASE_PREVIEW_ROW,
      action: 'cancel',
      status: 'cancelled',
      cancellation_date: '2024-06-15',
    }
    // No existing record for this ID
    const payload = buildUpsertPayload(cancelRow, { cancellation_date: null })
    expect(payload.cancellation_date).toBe('2024-06-15')
  })

  it('cancellation_date is set when there is no existing row at all', () => {
    const cancelRow: PreviewRow = {
      ...BASE_PREVIEW_ROW,
      action: 'cancel',
      status: 'cancelled',
      cancellation_date: '2024-06-15',
    }
    const payload = buildUpsertPayload(cancelRow, undefined)
    expect(payload.cancellation_date).toBe('2024-06-15')
  })
})

// ---------------------------------------------------------------------------
// mapPhobsRow — composite phobs_reservation_id
// ---------------------------------------------------------------------------

function makeRawRow(overrides: Partial<PhobsParsedRow> = {}): PhobsParsedRow {
  return {
    rowIndex: 3,
    internalId: '27759512',
    code: '6413243407',
    origin: 'Expedia.com',
    dolazak: '2024-07-10',
    odlazak: '2024-07-14',
    nositeljRezervacije: 'ERNEST DEBRESLIOSKI',
    drzava: 'HR',
    smjestaj: 'Superior Room 101',
    odraslih: '2',
    djeca: '0',
    valuta: 'EUR',
    ukupno: '1.200,00',
    status: 'ok',
    datumNastanka: '2024-05-01T10:00:00',
    bookiranoUnaprijed: '70',
    allCells: [],
    ...overrides,
  }
}

describe('mapPhobsRow — composite phobs_reservation_id', () => {
  it('single-room reservation: phobs_reservation_id is Code-internalId', () => {
    const row = makeRawRow({ internalId: '27759512', code: '6413243407' })
    const result = mapPhobsRow(row, MOCK_ROOM_TYPES, '2024-07-01')
    expect(result.phobs_reservation_id).toBe('6413243407-27759512')
  })

  it('two-room reservation: same Code + different internalIds → 2 distinct composite IDs', () => {
    const row1 = makeRawRow({ internalId: '27759512', code: '6413243407' })
    const row2 = makeRawRow({ internalId: '27759513', code: '6413243407' })
    const res1 = mapPhobsRow(row1, MOCK_ROOM_TYPES, '2024-07-01')
    const res2 = mapPhobsRow(row2, MOCK_ROOM_TYPES, '2024-07-01')
    expect(res1.phobs_reservation_id).toBe('6413243407-27759512')
    expect(res2.phobs_reservation_id).toBe('6413243407-27759513')
    expect(res1.phobs_reservation_id).not.toBe(res2.phobs_reservation_id)
  })

  it('re-importing the same row produces the identical composite ID (idempotent)', () => {
    const row = makeRawRow({ internalId: '27759512', code: '6413243407' })
    const first  = mapPhobsRow(row, MOCK_ROOM_TYPES, '2024-07-01')
    const second = mapPhobsRow(row, MOCK_ROOM_TYPES, '2024-07-02')
    expect(first.phobs_reservation_id).toBe(second.phobs_reservation_id)
  })

  it('same Code with different internalId (Phobs row recreated) → distinct ID, old row unaffected', () => {
    const original  = makeRawRow({ internalId: '27759512', code: '6413243407' })
    const recreated = makeRawRow({ internalId: '99999999', code: '6413243407' })
    const resOriginal  = mapPhobsRow(original,  MOCK_ROOM_TYPES, '2024-07-01')
    const resRecreated = mapPhobsRow(recreated, MOCK_ROOM_TYPES, '2024-07-01')
    expect(resOriginal.phobs_reservation_id).toBe('6413243407-27759512')
    expect(resRecreated.phobs_reservation_id).toBe('6413243407-99999999')
    // Different keys → upsert inserts new row, original row in DB is untouched
    expect(resOriginal.phobs_reservation_id).not.toBe(resRecreated.phobs_reservation_id)
  })

  it('falls back to Code-only when internalId is empty (edge case)', () => {
    const row = makeRawRow({ internalId: '', code: '6413243407' })
    const result = mapPhobsRow(row, MOCK_ROOM_TYPES, '2024-07-01')
    expect(result.phobs_reservation_id).toBe('6413243407')
  })
})
