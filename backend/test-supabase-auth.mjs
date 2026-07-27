import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Testing Supabase Auth Configuration...\n');
console.log('SUPABASE_URL:', SUPABASE_URL);
console.log('SERVICE_KEY (first 50 chars):', SUPABASE_SERVICE_KEY?.substring(0, 50) + '...');

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Test with a sample token (you'll need to provide a real token from the frontend)
const testToken = process.argv[2];

if (!testToken) {
  console.log('\n❌ No token provided. Usage: node test-supabase-auth.mjs <token>');
  console.log('\nTo get a token:');
  console.log('1. Open browser console on http://127.0.0.1:5412/agent/uploads');
  console.log('2. Run: (await supabase.auth.getSession()).data.session.access_token');
  console.log('3. Copy the token and run: node backend/test-supabase-auth.mjs <token>');
  process.exit(1);
}

console.log('\nTesting token:', testToken.substring(0, 30) + '...');

try {
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(testToken);
  
  if (error) {
    console.log('\n❌ Supabase auth error:', error.message);
    console.log('Error details:', JSON.stringify(error, null, 2));
  } else if (!user) {
    console.log('\n❌ No user returned (but no error either)');
  } else {
    console.log('\n✅ Token is valid!');
    console.log('User ID:', user.id);
    console.log('User email:', user.email);
  }
} catch (err) {
  console.log('\n❌ Unexpected error:', err.message);
  console.log(err.stack);
}
