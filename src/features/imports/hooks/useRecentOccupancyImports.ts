import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import type { Import } from '@/types/database'

export function useRecentOccupancyImports() {
  return useQuery({
    queryKey: ['imports', 'recent', 'occupancy'],
    queryFn: async (): Promise<Import[]> => {
      const { data, error } = await supabase
        .from('imports')
        .select('*')
        .eq('source', 'occupancy_excel')
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      return data ?? []
    },
  })
}
