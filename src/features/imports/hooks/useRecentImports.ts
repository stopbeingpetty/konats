import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import type { Import } from '@/types/database'

export function useRecentImports() {
  return useQuery({
    queryKey: ['imports', 'recent'],
    queryFn: async (): Promise<Import[]> => {
      const { data, error } = await supabase
        .from('imports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) throw error
      return data ?? []
    },
  })
}
