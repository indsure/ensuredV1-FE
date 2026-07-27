import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'https://khxbabotbvnyjwvqtumt.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_K8aR5y8E8FjOC--Lf10nXw_MFWKUcEA';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function debug() {
  // Check 1: Can we SELECT from agents?
  const { data: selectData, error: selectErr } = await supabase.from('agents').select('id').limit(1);
  console.log('SELECT agents:', selectErr ? `ERROR: ${selectErr.message} (code: ${selectErr.code})` : `OK, rows: ${selectData?.length}`);
  
  // Check 2: Can we INSERT into agents (simulating signup)?
  // This will fail at policy level if RLS blocks anon inserts
  const { data: insertData, error: insertErr } = await supabase.from('agents').insert({
    id: '00000000-0000-0000-0000-000000000099',
    email: 'debug_test@indsure.com',
    full_name: 'Debug Test',
    city: 'Test',
    phone: '1234567890',
    experience_years: 1,
    invite_code: 'INDSURE2026',
  }).select();
  
  console.log('INSERT agents:', insertErr ? `ERROR: ${insertErr.message} (code: ${insertErr.code})` : `OK, inserted: ${JSON.stringify(insertData)}`);
  
  // Clean up if it succeeded
  if (!insertErr) {
    await supabase.from('agents').delete().eq('id', '00000000-0000-0000-0000-000000000099');
    console.log('Cleaned up test row');
  }
}

debug();
