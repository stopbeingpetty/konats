import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import type { Reservation, DailyOccupancyOverride } from '@/types/database'
import { deduplicateByLatestSnapshot } from '../lib/deduplicateOverrides'

/**
 * All active reservations (non-deleted, non-cancelled, non-no_show)
 * staying on a specific date (check_in <= date < check_out).
 *
 * Pass null to disable the query (e.g. when the drawer is closed).
 */
export function useDayReservations(date: string | null) {
  return useQuery({
    queryKey: ['calendar', 'day', date],
    enabled: date !== null,
    queryFn: async (): Promise<Reservation[]> => {
      if (date === null) return []

      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .is('deleted_at', null)
        .neq('status', 'cancelled')
        .neq('status', 'no_show')
        .lte('check_in_date', date)
        .gt('check_out_date', date)
        .order('channel', { ascending: true })
        .order('guest_name', { ascending: true })

      if (error) throw new Error(error.message)
      return data
    },
  })
}

/**
 * Occupancy overrides for a specific date across all room types.
 * When a row exists for a (date, room_type_id) combination, sold_rooms from
 * this table overrides the reservation-derived count for drawer KPIs.
 *
 * Pass null to disable the query (e.g. when the drawer is closed).
 */
export function useDayOccupancyOverrides(date: string | null) {
  return useQuery({
    queryKey: ['calendar', 'day', 'occupancyOverrides', date],
    enabled: date !== null,
    queryFn: async (): Promise<DailyOccupancyOverride[]> => {
      if (date === null) return []

      const { data, error } = await supabase
        .from('daily_occupancy_override')
        .select('*')
        .eq('date', date)
        .order('snapshot_date', { ascending: false })

      if (error) throw new Error(error.message)
      // Keep only the latest snapshot per (date, room_type_id)
      return deduplicateByLatestSnapshot(data ?? [])
    },
  })
}
