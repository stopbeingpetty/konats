import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import type { RoomType } from '@/types/database'
import type { RoomTypeFormValues } from '../schemas/roomType.schema'

const ROOM_TYPES_KEY = ['roomTypes', 'list'] as const

function parsePostgresError(code: string | undefined): string {
  if (code === '23505') return 'A room type with this code already exists.'
  if (code === '23503') return 'This record is referenced by other data and cannot be modified.'
  return 'An unexpected database error occurred. Please try again.'
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export function useRoomTypesList() {
  return useQuery({
    queryKey: ROOM_TYPES_KEY,
    queryFn: async (): Promise<RoomType[]> => {
      const { data, error } = await supabase
        .from('room_types')
        .select('*')
        .is('deleted_at', null)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })

      if (error) throw new Error(parsePostgresError(error.code))
      return data
    },
  })
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export function useCreateRoomType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: RoomTypeFormValues): Promise<RoomType> => {
      const { data, error } = await supabase
        .from('room_types')
        .insert({
          name: values.name,
          code: values.code,
          default_room_count: values.default_room_count,
          sort_order: values.sort_order,
          notes: values.notes || null,
          deleted_at: null,
        })
        .select()
        .single()

      if (error) throw new Error(parsePostgresError(error.code))
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['roomTypes'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Update (with optimistic update)
// ---------------------------------------------------------------------------

export function useUpdateRoomType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string
      values: RoomTypeFormValues
    }): Promise<RoomType> => {
      const { data, error } = await supabase
        .from('room_types')
        .update({
          name: values.name,
          code: values.code,
          default_room_count: values.default_room_count,
          sort_order: values.sort_order,
          notes: values.notes || null,
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw new Error(parsePostgresError(error.code))
      return data
    },
    onMutate: async ({ id, values }) => {
      await queryClient.cancelQueries({ queryKey: ROOM_TYPES_KEY })
      const previous = queryClient.getQueryData<RoomType[]>(ROOM_TYPES_KEY)

      queryClient.setQueryData<RoomType[]>(ROOM_TYPES_KEY, (old) =>
        old?.map((rt) =>
          rt.id === id
            ? {
                ...rt,
                name: values.name,
                code: values.code,
                default_room_count: values.default_room_count,
                sort_order: values.sort_order,
                notes: values.notes || null,
              }
            : rt
        ) ?? []
      )

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(ROOM_TYPES_KEY, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['roomTypes'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Soft delete (with optimistic remove)
// ---------------------------------------------------------------------------

export function useSoftDeleteRoomType() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('room_types')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw new Error(parsePostgresError(error.code))
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ROOM_TYPES_KEY })
      const previous = queryClient.getQueryData<RoomType[]>(ROOM_TYPES_KEY)

      queryClient.setQueryData<RoomType[]>(ROOM_TYPES_KEY, (old) =>
        old?.filter((rt) => rt.id !== id) ?? []
      )

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(ROOM_TYPES_KEY, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['roomTypes'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Reservation count check (for delete confirmation)
// ---------------------------------------------------------------------------

export function useRoomTypeReservationCount(id: string | null) {
  return useQuery({
    queryKey: ['roomTypes', 'reservationCount', id],
    enabled: id !== null,
    queryFn: async (): Promise<number> => {
      if (!id) return 0

      const today = new Date().toISOString().split('T')[0]

      const { count, error } = await supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('room_type_id', id)
        .is('deleted_at', null)
        .gte('check_out_date', today)

      if (error) throw new Error(parsePostgresError(error.code))
      return count ?? 0
    },
  })
}
