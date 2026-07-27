import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'https://khxbabotbvnyjwvqtumt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_K8aR5y8E8FjOC--Lf10nXw_MFWKUcEA';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
    console.log("Checking invite codes...");
    const { data: invite, error: iErr } = await supabase.from('invite_codes').select('*').eq('code', 'INDSURE2026');
    console.log("INVITE CODE INDSURE2026:", invite);

    console.log("Checking agents...");
    const { data: agents, error: aErr } = await supabase.from('agents').select('*').order('created_at', { ascending: false }).limit(3);
    console.log("RECENT AGENTS:", agents);

    console.log("Checking empanelments...");
    const { data: emp, error: eErr } = await supabase.from('empanelments').select('*').limit(3);
    console.log("RECENT EMPANELMENTS:", emp);
}
test();
