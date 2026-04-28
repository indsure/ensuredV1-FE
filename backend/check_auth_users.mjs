import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkAuthUsers() {
  console.log('Checking Supabase auth users...\n');
  
  // List all users
  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`Total users: ${users.length}\n`);
  
  users.forEach(user => {
    console.log(`Email: ${user.email}`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Created: ${user.created_at}`);
    console.log(`  Last sign in: ${user.last_sign_in_at}`);
    console.log(`  App metadata:`, user.app_metadata);
    console.log('');
  });
}

checkAuthUsers().catch(console.error);
