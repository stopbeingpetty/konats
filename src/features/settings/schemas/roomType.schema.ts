import { z } from 'zod'

export const roomTypeSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(50, 'Name must be 50 characters or less'),
  code: z
    .string()
    .regex(/^[A-Z0-9]{2,10}$/, 'Code must be 2–10 uppercase letters or digits (e.g. SUP, EXE)'),
  default_room_count: z
    .number({ error: 'Room count must be a number' })
    .int('Room count must be a whole number')
    .min(1, 'Must have at least 1 room')
    .max(500, 'Room count cannot exceed 500'),
  sort_order: z
    .number({ error: 'Sort order must be a number' })
    .int('Sort order must be a whole number')
    .min(0, 'Sort order cannot be negative'),
  notes: z.string().max(500, 'Notes must be 500 characters or less').optional().or(z.literal('')),
})

export type RoomTypeFormValues = z.infer<typeof roomTypeSchema>
