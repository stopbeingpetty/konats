import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import type { Reservation } from '@/types/database'

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
