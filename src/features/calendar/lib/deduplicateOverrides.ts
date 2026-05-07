import type { DailyOccupancyOverride } from '@/types/database'

/**
 * Given a flat list of daily_occupancy_override rows (potentially containing
 * multiple snapshots per (date, room_type_id)), return only the row with the
 * latest snapshot_date for each unique (date, room_type_id) pair.
 *
 * ISO 8601 timestamps sort lexicographically, so string comparison is safe.
 */
export function deduplicateByLatestSnapshot(
  rows: DailyOccupancyOverride[]
): DailyOccupancyOverride[] {
  const latestMap = new Map<string, DailyOccupancyOverride>()

  for (const row of rows) {
    const key = `${row.date}::${row.room_type_id}`
    const existing = latestMap.get(key)
    if (!existing || row.snapshot_date > existing.snapshot_date) {
      latestMap.set(key, row)
    }
  }

  return Array.from(latestMap.values())
}
