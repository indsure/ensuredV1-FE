import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'https://khxbabotbvnyjwvqtumt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_K8aR5y8E8FjOC--Lf10nXw_MFWKUcEA';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
    console.log("Checking batch_uploads...");
    const { error: bErr } = await supabase.from('batch_uploads').select('id').limit(1);
    console.log("batch_uploads error:", bErr?.message || "none");

    console.log("Checking clients...");
    const { error: cErr } = await supabase.from('clients').select('id').limit(1);
    console.log("clients error:", cErr?.message || "none");
}
test();
