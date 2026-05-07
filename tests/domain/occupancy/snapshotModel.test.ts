import { describe, it, expect } from 'vitest'
import { deduplicateByLatestSnapshot } from '@/features/calendar/lib/deduplicateOverrides'
import type { DailyOccupancyOverride } from '@/types/database'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RT_SUP = 'room-type-superior'
const RT_EXE = 'room-type-executive'
const RT_SUI = 'room-type-suite'

function makeOverride(
  date: string,
  room_type_id: string,
  snapshot_date: string,
  sold_rooms: number = 10
): DailyOccupancyOverride {
  return {
    id: `${date}-${room_type_id}-${snapshot_date}`,
    date,
    room_type_id,
    sold_rooms,
    capacity: 23,
    source: 'occupancy_excel',
    snapshot_date,
    import_id: null,
    notes: null,
    created_at: snapshot_date,
    updated_at: snapshot_date,
  }
}

// ---------------------------------------------------------------------------
// Snapshot deduplication tests
// ---------------------------------------------------------------------------

describe('deduplicateByLatestSnapshot — single date, multiple snapshots', () => {
  it('returns the row with the latest snapshot_date for a given (date, room_type_id)', () => {
    const rows = [
      makeOverride('2026-05-01', RT_SUP, '2026-05-01T08:00:00.000Z', 10),
      makeOverride('2026-05-01', RT_SUP, '2026-05-02T08:00:00.000Z', 18), // ← latest
      makeOverride('2026-05-01', RT_SUP, '2026-04-30T08:00:00.000Z', 5),
    ]

    const result = deduplicateByLatestSnapshot(rows)
    expect(result).toHaveLength(1)
    expect(result[0].sold_rooms).toBe(18)
    expect(result[0].snapshot_date).toBe('2026-05-02T08:00:00.000Z')
  })

  it('handles exactly one snapshot per (date, room_type_id) without change', () => {
    const rows = [
      makeOverride('2026-05-01', RT_SUP, '2026-05-01T08:00:00.000Z', 15),
    ]
    const result = deduplicateByLatestSnapshot(rows)
    expect(result).toHaveLength(1)
    expect(result[0].sold_rooms).toBe(15)
  })
})

describe('deduplicateByLatestSnapshot — multiple dates, mixed snapshot counts', () => {
  it('returns latest snapshot for each (date, room_type_id) independently', () => {
    const rows = [
      // Date 2026-05-01, Superior: 3 snapshots
      makeOverride('2026-05-01', RT_SUP, '2026-04-28T10:00:00.000Z', 10),
      makeOverride('2026-05-01', RT_SUP, '2026-05-01T10:00:00.000Z', 15),
      makeOverride('2026-05-01', RT_SUP, '2026-05-02T10:00:00.000Z', 20), // latest for this key

      // Date 2026-05-01, Executive: 1 snapshot
      makeOverride('2026-05-01', RT_EXE, '2026-05-01T10:00:00.000Z', 8),

      // Date 2026-05-02, Superior: 5 snapshots
      makeOverride('2026-05-02', RT_SUP, '2026-04-25T00:00:00.000Z', 5),
      makeOverride('2026-05-02', RT_SUP, '2026-04-26T00:00:00.000Z', 6),
      makeOverride('2026-05-02', RT_SUP, '2026-04-27T00:00:00.000Z', 7),
      makeOverride('2026-05-02', RT_SUP, '2026-04-28T00:00:00.000Z', 8),
      makeOverride('2026-05-02', RT_SUP, '2026-04-29T00:00:00.000Z', 9), // latest for this key
    ]

    const result = deduplicateByLatestSnapshot(rows)

    // 3 unique (date, room_type_id) keys
    expect(result).toHaveLength(3)

    const may1Sup = result.find((r) => r.date === '2026-05-01' && r.room_type_id === RT_SUP)
    const may1Exe = result.find((r) => r.date === '2026-05-01' && r.room_type_id === RT_EXE)
    const may2Sup = result.find((r) => r.date === '2026-05-02' && r.room_type_id === RT_SUP)

    expect(may1Sup?.sold_rooms).toBe(20)
    expect(may1Exe?.sold_rooms).toBe(8)
    expect(may2Sup?.sold_rooms).toBe(9)
  })

  it('returns empty array for empty input', () => {
    expect(deduplicateByLatestSnapshot([])).toHaveLength(0)
  })
})

describe('deduplicateByLatestSnapshot — latest snapshot wins after re-upload', () => {
  it('simulates two uploads of the same file — second snapshot (different timestamp) wins', () => {
    // Simulate upload 1 at T1 and upload 2 at T2 > T1 for the same dates
    const upload1Date = '2026-05-07T09:00:00.000Z'
    const upload2Date = '2026-05-07T14:00:00.000Z'

    const rows = [
      makeOverride('2026-06-01', RT_SUP, upload1Date, 10),
      makeOverride('2026-06-01', RT_EXE, upload1Date, 8),
      makeOverride('2026-06-01', RT_SUI, upload1Date, 2),
      // Second upload — same dates, different values
      makeOverride('2026-06-01', RT_SUP, upload2Date, 12),
      makeOverride('2026-06-01', RT_EXE, upload2Date, 9),
      makeOverride('2026-06-01', RT_SUI, upload2Date, 3),
    ]

    const result = deduplicateByLatestSnapshot(rows)
    expect(result).toHaveLength(3)

    // All results should come from upload 2 (latest)
    for (const r of result) {
      expect(r.snapshot_date).toBe(upload2Date)
    }

    const sup = result.find((r) => r.room_type_id === RT_SUP)
    const exe = result.find((r) => r.room_type_id === RT_EXE)
    const sui = result.find((r) => r.room_type_id === RT_SUI)

    expect(sup?.sold_rooms).toBe(12)
    expect(exe?.sold_rooms).toBe(9)
    expect(sui?.sold_rooms).toBe(3)
  })
})
