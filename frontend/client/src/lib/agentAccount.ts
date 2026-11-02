import { supabase } from '@/lib/supabase'

/**
 * What a signed-in login is, as far as the two portals are concerned.
 *
 * Advisor and personal accounts share one Supabase auth pool, so a login on
 * its own says nothing. 'unfinished' is a login with neither profile: an
 * advisor signup whose create-profile call failed after signUp succeeded
 * (or a personal signup that never opened /app). It used to be told "this is
 * a client account" and signed out, which left it with no way back in.
 *
 * Any read error is 'unknown', never "no row": treating a network blip as
 * "no profile" would put a real advisor on the finish-setup form, asking for
 * an invite code they no longer have.
 *
 * Both reads run as the user under RLS (own row only: agents, and
 * individual_profiles via individuals_read_own_profile from migration 026).
 */
export type AccountKind = 'agent' | 'personal' | 'unfinished' | 'unknown'

export async function getAccountKind(userId: string): Promise<AccountKind> {
    const agent = await supabase.from('agents').select('id').eq('id', userId).maybeSingle()
    if (agent.error) return 'unknown'
    if (agent.data) return 'agent'
    const personal = await supabase.from('individual_profiles').select('id').eq('id', userId).maybeSingle()
    if (personal.error) return 'unknown'
    return personal.data ? 'personal' : 'unfinished'
}

/**
 * Advisor signup answers, kept on the auth user so a failed signup can be
 * finished later without retyping. Nested under `agent_signup` on purpose:
 * /api/me/bootstrap builds a PERSONAL profile from top-level `full_name` and
 * `phone` metadata, so storing them at the top level would let one visit to
 * /app silently turn a stranded advisor into a personal account.
 *
 * user_metadata is writable by the user. Nothing here is trusted: the server
 * re-checks every field, including the invite code.
 */
export type AgentSignupMeta = {
    full_name?: string
    phone?: string
    city?: string
    invite_code?: string
    marketing_consent?: boolean
    account_type?: 'individual' | 'agency'
    agency_name?: string | null
    seats_wanted?: number | null
}

export function agentSignupFromMetadata(meta: unknown): AgentSignupMeta {
    const raw = (meta as { agent_signup?: unknown } | null)?.agent_signup
    return raw && typeof raw === 'object' ? (raw as AgentSignupMeta) : {}
}
