import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://khxbabotbvnyjwvqtumt.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_K8aR5y8E8FjOC--Lf10nXw_MFWKUcEA'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

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
