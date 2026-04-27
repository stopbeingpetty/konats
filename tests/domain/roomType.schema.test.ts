import { describe, it, expect } from 'vitest'
import { roomTypeSchema } from '@/features/settings/schemas/roomType.schema'

const validBase = {
  name: 'Superior',
  code: 'SUP',
  default_room_count: 23,
  sort_order: 1,
  notes: '',
}

describe('roomTypeSchema', () => {
  // -------------------------------------------------------------------------
  // Valid cases
  // -------------------------------------------------------------------------

  it('accepts a complete valid object', () => {
    const result = roomTypeSchema.safeParse(validBase)
    expect(result.success).toBe(true)
  })

  it('accepts notes as undefined (optional field)', () => {
    const { notes: _, ...withoutNotes } = validBase
    const result = roomTypeSchema.safeParse(withoutNotes)
    expect(result.success).toBe(true)
  })

  it('accepts notes as empty string', () => {
    const result = roomTypeSchema.safeParse({ ...validBase, notes: '' })
    expect(result.success).toBe(true)
  })

  it('accepts notes up to 500 characters', () => {
    const result = roomTypeSchema.safeParse({ ...validBase, notes: 'a'.repeat(500) })
    expect(result.success).toBe(true)
  })

  it('accepts code with digits (e.g. SU1)', () => {
    const result = roomTypeSchema.safeParse({ ...validBase, code: 'SU1' })
    expect(result.success).toBe(true)
  })

  it('accepts minimum valid name (2 chars)', () => {
    const result = roomTypeSchema.safeParse({ ...validBase, name: 'AB' })
    expect(result.success).toBe(true)
  })

  it('accepts maximum valid name (50 chars)', () => {
    const result = roomTypeSchema.safeParse({ ...validBase, name: 'A'.repeat(50) })
    expect(result.success).toBe(true)
  })

  it('accepts minimum valid code (2 chars)', () => {
    const result = roomTypeSchema.safeParse({ ...validBase, code: 'AB' })
    expect(result.success).toBe(true)
  })

  it('accepts maximum valid code (10 chars)', () => {
    const result = roomTypeSchema.safeParse({ ...validBase, code: 'ABCDEFGHIJ' })
    expect(result.success).toBe(true)
  })

  it('accepts sort_order of 0', () => {
    const result = roomTypeSchema.safeParse({ ...validBase, sort_order: 0 })
    expect(result.success).toBe(true)
  })

  it('accepts default_room_count of 500', () => {
    const result = roomTypeSchema.safeParse({ ...validBase, default_room_count: 500 })
    expect(result.success).toBe(true)
  })

  it('trims whitespace from name', () => {
    const result = roomTypeSchema.safeParse({ ...validBase, name: '  Superior  ' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Superior')
    }
  })

  // -------------------------------------------------------------------------
  // Invalid: name
  // -------------------------------------------------------------------------

  it('rejects name shorter than 2 characters', () => {
    const result = roomTypeSchema.safeParse({ ...validBase, name: 'A' })
    expect(result.success).toBe(false)
  })

  it('rejects name longer than 50 characters', () => {
    const result = roomTypeSchema.safeParse({ ...validBase, name: 'A'.repeat(51) })
    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const result = roomTypeSchema.safeParse({ ...validBase, name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects name that is only whitespace', () => {
    const result = roomTypeSchema.safeParse({ ...validBase, name: '   ' })
    expect(result.success).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Invalid: code
  // -------------------------------------------------------------------------

  it('rejects code shorter than 2 characters', () => {
    const result = roomTypeSchema.safeParse({ ...validBase, code: 'A' })
    expect(result.success).toBe(false)
  })

  it('rejects code longer than 10 characters', () => {
    const result = roomTypeSchema.safeParse({ ...validBase, code: 'ABCDEFGHIJK' })
    expect(result.success).toBe(false)
  })

  it('rejects code with lowercase letters', () => {
    const result = roomTypeSchema.safeParse({ ...validBase, code: 'sup' })
    expect(result.success).toBe(false)
  })

  it('rejects code with special characters', () => {
    const result = roomTypeSchema.safeParse({ ...validBase, code: 'SU-P' })
    expect(result.success).toBe(false)
  })

  it('rejects code with spaces', () => {
    const result = roomTypeSchema.safeParse({ ...validBase, code: 'SU P' })
    expect(result.success).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Invalid: default_room_count
  // -------------------------------------------------------------------------

  it('rejects default_room_count of 0', () => {
    const result = roomTypeSchema.safeParse({ ...validBase, default_room_count: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects default_room_count above 500', () => {
    const result = roomTypeSchema.safeParse({ ...validBase, default_room_count: 501 })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer default_room_count', () => {
    const result = roomTypeSchema.safeParse({ ...validBase, default_room_count: 2.5 })
    expect(result.success).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Invalid: sort_order
  // -------------------------------------------------------------------------

  it('rejects negative sort_order', () => {
    const result = roomTypeSchema.safeParse({ ...validBase, sort_order: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer sort_order', () => {
    const result = roomTypeSchema.safeParse({ ...validBase, sort_order: 1.5 })
    expect(result.success).toBe(false)
  })

  // -------------------------------------------------------------------------
  // Invalid: notes
  // -------------------------------------------------------------------------

  it('rejects notes longer than 500 characters', () => {
    const result = roomTypeSchema.safeParse({ ...validBase, notes: 'a'.repeat(501) })
    expect(result.success).toBe(false)
  })
})
