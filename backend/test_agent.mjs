import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve('d:/ensuredV1-FE/backend/.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email: 'agent_test_ui@docs.com',
    password: 'password123',
    email_confirm: true
  });
  if (authErr) { console.log('Auth error:', authErr); }
  
  if (authData?.user) {
    const { error: dbErr } = await supabase.from('agents').insert({
      id: authData.user.id,
      email: 'agent_test_ui@docs.com',
      full_name: 'UI Test Agent',
      status: 'active'
    });
    if (dbErr) { console.log('DB error:', dbErr); }
    else { console.log('CREATED'); }
  }
}
run();
