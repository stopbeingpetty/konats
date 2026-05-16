import { useQuery } from '@tanstack/react-query'
import { format, endOfMonth } from 'date-fns'
import { supabase } from '@/lib/supabase/client'
import type { Reservation, RoomInventory, DemandMarker, Restriction, DailyOccupancyOverride } from '@/types/database'
import { deduplicateByLatestSnapshot } from '../lib/deduplicateOverrides'

// ============================================================================
// Internal helpers
// ============================================================================

function monthRange(year: number, month: number): { startDate: string; endDate: string } {
  const first = new Date(year, month - 1, 1)
  return {
    startDate: format(first, 'yyyy-MM-dd'),
    endDate: format(endOfMonth(first), 'yyyy-MM-dd'),
  }
}

// ============================================================================
// Hooks — one per data shape, per spec
// ============================================================================

/**
 * All active reservations (non-deleted, non-cancelled, non-no_show)
 * with at least one stay-night in the requested month.
 */
export function useMonthReservations(year: number, month: number) {
  const { startDate, endDate } = monthRange(year, month)

  return useQuery({
    queryKey: ['calendar', 'reservations', year, month],
    queryFn: async (): Promise<Reservation[]> => {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .is('deleted_at', null)
        // Fetch all statuses (including cancelled) so the hybrid-occupancy logic can
        // subtract cancellations that occurred after the Excel snapshot.
        // Metric functions (computeHybridDayMetrics, computeMonthKpis, etc.) filter
        // to active statuses internally for ADR / revenue / pickup denominators.
        // Has at least one night in the month:
        // check_in_date <= monthLastDay  AND  check_out_date > monthFirstDay
        .lte('check_in_date', endDate)
        .gt('check_out_date', startDate)
        .order('check_in_date', { ascending: true })

      if (error) throw new Error(error.message)
      return data
    },
  })
}

/**
 * Room inventory overrides for every day in the requested month.
 * Used to resolve OOO rooms; falls back to room_types.default_room_count when absent.
 */
export function useMonthInventory(year: number, month: number) {
  const { startDate, endDate } = monthRange(year, month)

  return useQuery({
    queryKey: ['calendar', 'inventory', year, month],
    queryFn: async (): Promise<RoomInventory[]> => {
      const { data, error } = await supabase
        .from('room_inventory')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)

      if (error) throw new Error(error.message)
      return data
    },
  })
}

/**
 * Active demand markers that overlap the requested month.
 */
export function useMonthDemandMarkers(year: number, month: number) {
  const { startDate, endDate } = monthRange(year, month)

  return useQuery({
    queryKey: ['calendar', 'demandMarkers', year, month],
    queryFn: async (): Promise<DemandMarker[]> => {
      const { data, error } = await supabase
        .from('demand_markers')
        .select('*')
        .is('deleted_at', null)
        // Marker overlaps month: date_from <= monthLastDay AND date_to >= monthFirstDay
        .lte('date_from', endDate)
        .gte('date_to', startDate)

      if (error) throw new Error(error.message)
      return data
    },
  })
}

/**
 * Restrictions for every room type active in the requested month.
 */
export function useMonthRestrictions(year: number, month: number) {
  const { startDate, endDate } = monthRange(year, month)

  return useQuery({
    queryKey: ['calendar', 'restrictions', year, month],
    queryFn: async (): Promise<Restriction[]> => {
      const { data, error } = await supabase
        .from('restrictions')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)

      if (error) throw new Error(error.message)
      return data
    },
  })
}

/**
 * Occupancy overrides for every day in the requested month.
 * When a (date, room_type_id) row exists here, sold_rooms from this table
 * overrides the reservation-derived count in metric calculations.
 */
export function useMonthOccupancyOverrides(year: number, month: number) {
  const { startDate, endDate } = monthRange(year, month)

  return useQuery({
    queryKey: ['calendar', 'occupancyOverrides', year, month],
    queryFn: async (): Promise<DailyOccupancyOverride[]> => {
      const { data, error } = await supabase
        .from('daily_occupancy_override')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('snapshot_date', { ascending: false })

      if (error) throw new Error(error.message)
      // Keep only the latest snapshot per (date, room_type_id)
      return deduplicateByLatestSnapshot(data ?? [])
    },
  })
}
