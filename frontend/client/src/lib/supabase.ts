import { createClient } from '@supabase/supabase-js'

// Supabase configuration - Updated 2026-04-27
const SUPABASE_URL = 'https://khxbabotbvnyjwvqtumt.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoeGJhYm90YnZueWp3dnF0dW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMDc1OTIsImV4cCI6MjA4ODc4MzU5Mn0.H7mVu4EUWLTzzUN4DhA_xWk2bi4LR8vFFN2NT1jIs08'

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
