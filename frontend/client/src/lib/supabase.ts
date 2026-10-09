import { createClient } from '@supabase/supabase-js'
import { isPlaygroundMode } from './playground/mode'
type PlaygroundModule = typeof import('./playground/mockClient')

// Supabase configuration - Updated 2026-04-27
const SUPABASE_URL = 'https://khxbabotbvnyjwvqtumt.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoeGJhYm90YnZueWp3dnF0dW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMDc1OTIsImV4cCI6MjA4ODc4MzU5Mn0.H7mVu4EUWLTzzUN4DhA_xWk2bi4LR8vFFN2NT1jIs08'

const realClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// In playground (demo) mode the whole portal runs offline against an in-memory
// mock — see ./playground. We expose ONE `supabase` symbol that every page
// already imports and transparently route it to the mock when the flag is set,
// so no page, link or query has to change. Real mode is untouched.
//
// The mock and its seed data are a separate chunk, so ordinary visitors never
// download the demo. loadPlayground() fetches it; main.tsx awaits it before the
// first render when the flag is already set, and PlaygroundEntry awaits it
// before turning the flag on, so no query can run against the real client while
// the mock is still on its way.
let playground: PlaygroundModule | null = null

export async function loadPlayground(): Promise<void> {
  if (!playground) playground = await import('./playground/mockClient')
  playground.installPlaygroundFetch()
}

export const supabase = new Proxy(realClient, {
  get(target, prop, receiver) {
    if (playground && isPlaygroundMode()) {
      const mock = playground.getMockClient()
      const mv = mock[prop as keyof typeof mock]
      if (mv !== undefined) return typeof mv === 'function' ? mv.bind(mock) : mv
    }
    const rv = Reflect.get(target, prop, receiver)
    return typeof rv === 'function' ? rv.bind(target) : rv
  },
}) as typeof realClient

export type Database = {
    agents: {
        id: string; full_name: string; email: string; phone: string;
        city: string; experience_years: number; invite_code: string;
        is_admin: boolean; created_at: string;
    }
    clients: {
        id: string; agent_id: string; name: string; insurer: string;
        sum_insured: number; expiry_date: string; pdf_url: string;
        score: number; flaws: any[]; report_data: any;
        status: 'pending' | 'processing' | 'done' | 'error';
        error_message: string; created_at: string;
    }
}
