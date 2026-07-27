import fetch from 'node-fetch';
import pkg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function test() {
  try {
    // Get a client with a valid agent_id
    const clientResult = await pool.query(`
      SELECT id, agent_id, share_token, share_enabled
      FROM clients 
      WHERE agent_id IS NOT NULL 
      AND status = 'done'
      LIMIT 1
    `);
    
    if (clientResult.rows.length === 0) {
      console.log('❌ No clients found with agent_id');
      return;
    }
    
    const client = clientResult.rows[0];
    console.log('\n=== Testing Share Toggle API ===');
    console.log(`Client ID: ${client.id}`);
    console.log(`Agent ID: ${client.agent_id}`);
    console.log(`Current share_token: ${client.share_token}`);
    console.log(`Current share_enabled: ${client.share_enabled}`);
    
    // We need a valid JWT token for the agent
    // For testing, let's just check what the API would return
    console.log('\n⚠️  Note: This test requires a valid JWT token');
    console.log('The API endpoint is: POST /api/agent/clients/:id/share/toggle');
    console.log('\nExpected response format:');
    console.log('{');
    console.log('  "shareToken": "<uuid>",');
    console.log('  "shareEnabled": true,');
    console.log('  "shareUrl": "http://localhost:5000/shared/report/<uuid>"');
    console.log('}');
    
    console.log('\n=== Manual Test ===');
    console.log('To test manually:');
    console.log('1. Log in to the agent dashboard');
    console.log('2. Open DevTools → Network tab');
    console.log('3. Click "Share Report" on a policy');
    console.log('4. Check the response from /api/agent/clients/:id/share/toggle');
    console.log('5. Verify the shareUrl format is correct');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

test();
