import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
const SUPABASE_URL = 'https://khxbabotbvnyjwvqtumt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_K8aR5y8E8FjOC--Lf10nXw_MFWKUcEA';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
    const { data: invite } = await supabase.from('invite_codes').select('*').eq('code', 'INDSURE2026');
    const { data: agents } = await supabase.from('agents').select('*').order('created_at', { ascending: false }).limit(3);
    const { data: emp } = await supabase.from('empanelments').select('*').limit(3);
    fs.writeFileSync('output.json', JSON.stringify({ invite, agents, emp }, null, 2));
}
test();
