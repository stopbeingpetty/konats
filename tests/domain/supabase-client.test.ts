import { describe, it, expect } from 'vitest'

describe('Supabase client', () => {
  it('imports without throwing', async () => {
    // Set env vars before import so createClient doesn't throw
    // (actual values don't matter for this smoke test)
    import.meta.env.VITE_SUPABASE_URL = 'https://placeholder.supabase.co'
    import.meta.env.VITE_SUPABASE_ANON_KEY = 'placeholder-anon-key'

    const { supabase } = await import('@/lib/supabase/client')
    expect(supabase).toBeDefined()
    expect(typeof supabase.auth.signInWithPassword).toBe('function')
  })
})
