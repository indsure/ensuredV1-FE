import pkg from 'pg';
const { Client } = pkg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Export it or add it to the repo-root .env before running this script.');
  process.exit(1);
}

const connectionString = DATABASE_URL;

async function testNotify() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    // Replace with a valid agent_id if known, or just pick the first one from agents table
    const agentRes = await client.query('SELECT id FROM agents LIMIT 1');
    if (agentRes.rows.length === 0) {
      console.error('No agents found to notify.');
      return;
    }
    const agentId = agentRes.rows[0].id;

    await client.query(
      'INSERT INTO notifications (agent_id, message, type, link, is_read) VALUES ($1, $2, $3, $4, $5)',
      [agentId, 'Verification Test: Phase 5 Notifications are LIVE! 🚀', 'success', '/agent/dashboard', false]
    );
    console.log(`Sent test notification to agent ${agentId}`);
  } catch (err) {
    console.error('Error sending test notification:', err);
  } finally {
    await client.end();
  }
}

testNotify();
