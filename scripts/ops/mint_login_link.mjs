// Dev helper: mint a magic-link verify URL for the test agent so the local
// preview browser can sign in without a password. Prints the URL to stdout.
import path from 'node:path';
import { config } from 'dotenv';
import { fileURLToPath } from "node:url";
// scripts/ops/<this file>  ->  repo root. Resolved from the file, not the
// working directory, so these run correctly from anywhere.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

import { createClient } from '@supabase/supabase-js';

config({ path: path.resolve(REPO_ROOT, '.env.local') });
config({ path: path.resolve(REPO_ROOT, '.env') });
config();

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = process.argv[2] || 'deepshah399@gmail.com';
const redirectTo = process.argv[3] || 'http://127.0.0.1:5412/agent/dashboard';

const { data, error } = await admin.auth.admin.generateLink({
  type: 'magiclink',
  email,
  options: { redirectTo },
});
if (error) {
  console.error('generateLink failed:', error.message);
  process.exit(1);
}

const { hashed_token } = data.properties;
const url = `${process.env.SUPABASE_URL}/auth/v1/verify?token=${hashed_token}&type=magiclink&redirect_to=${encodeURIComponent(redirectTo)}`;
console.log(url);
process.exit(0);
